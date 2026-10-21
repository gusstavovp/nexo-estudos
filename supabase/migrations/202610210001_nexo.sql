-- Nexo. Execute uma vez no SQL Editor de um projeto Supabase separado.
begin;
create table public.study_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  revision bigint not null default 0,
  viewport jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_maps_user_idx on public.study_maps(user_id);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.study_maps(id) on delete cascade,
  parent_id uuid,
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 20000),
  color text not null default '#5b8a68' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon text not null default 'book' check (icon in ('book','math','atom','flask','globe','pen','leaf','code')),
  status text not null default 'not_started' check (status in ('not_started','studying','reviewed')),
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  notes jsonb not null default '[]' check (jsonb_typeof(notes) = 'array' and jsonb_array_length(notes) <= 100),
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 100),
  x double precision not null default 0 check (x between -1000000 and 1000000),
  y double precision not null default 0 check (y between -1000000 and 1000000),
  collapsed boolean not null default false,
  unique (map_id, id),
  foreign key (map_id, parent_id) references public.topics(map_id, id) on delete cascade deferrable initially deferred,
  check (parent_id is distinct from id)
);
create index topics_parent_idx on public.topics(map_id, parent_id);

create table public.topic_relations (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.study_maps(id) on delete cascade,
  source_id uuid not null,
  target_id uuid not null,
  foreign key (map_id, source_id) references public.topics(map_id, id) on delete cascade,
  foreign key (map_id, target_id) references public.topics(map_id, id) on delete cascade,
  check (source_id < target_id),
  unique (map_id, source_id, target_id)
);
create index relations_target_idx on public.topic_relations(map_id, target_id);

alter table public.study_maps enable row level security;
alter table public.topics enable row level security;
alter table public.topic_relations enable row level security;
create policy maps_owned on public.study_maps for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy topics_owned on public.topics for all to authenticated
  using (exists (select 1 from public.study_maps m where m.id = map_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.study_maps m where m.id = map_id and m.user_id = (select auth.uid())));
create policy relations_owned on public.topic_relations for all to authenticated
  using (exists (select 1 from public.study_maps m where m.id = map_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.study_maps m where m.id = map_id and m.user_id = (select auth.uid())));
revoke all on public.study_maps, public.topics, public.topic_relations from anon;
grant select, insert, update, delete on public.study_maps, public.topics, public.topic_relations to authenticated;

-- Serializa edições estruturais por mapa inclusive por clientes REST diretos.
create function public.lock_topic_map() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.map_id <> old.map_id or new.id <> old.id) then
    raise exception 'Não é permitido transferir registros entre mapas.';
  end if;
  perform 1 from public.study_maps where id = coalesce(new.map_id, old.map_id) for update;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
create trigger lock_topics before insert or update or delete on public.topics for each row execute function public.lock_topic_map();
create trigger lock_relations before insert or update or delete on public.topic_relations for each row execute function public.lock_topic_map();

-- Verificação diferida permite trocar pais em uma transação, sem aceitar ciclos.
create function public.check_topic_tree() returns trigger language plpgsql security invoker set search_path = '' as $$
declare has_cycle boolean;
begin
  with recursive chain as (
    select id, parent_id, array[id] as path, false as cycle from public.topics where map_id = new.map_id and id = new.id
    union all
    select t.id, t.parent_id, c.path || t.id, t.id = any(c.path)
    from chain c join public.topics t on t.id = c.parent_id and t.map_id = new.map_id
    where not c.cycle
  ) select exists (select 1 from chain where cycle) into has_cycle;
  if has_cycle then raise exception 'A hierarquia não pode conter ciclos.'; end if;
  return null;
end; $$;
create constraint trigger topics_acyclic after insert or update on public.topics
  deferrable initially deferred for each row execute function public.check_topic_tree();

-- Operação atômica com revisão: falhas não deixam um mapa parcialmente salvo.
create function public.save_study_map(p_map_id uuid, p_expected_revision bigint, p_content jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; t jsonb; r jsonb; result_revision bigint;
begin
  select revision into current_revision from public.study_maps
    where id = p_map_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Mapa indisponível.'; end if;
  if current_revision <> p_expected_revision then
    raise exception 'CONFLICT: este mapa foi alterado em outra janela. Exporte seu rascunho e recarregue.';
  end if;
  if jsonb_typeof(p_content->'topics') <> 'array' or jsonb_typeof(p_content->'relations') <> 'array'
    or not (p_content ? 'topics') or not (p_content ? 'relations') then raise exception 'Conteúdo inválido.'; end if;
  if jsonb_array_length(p_content->'topics') > 1000 then raise exception 'Limite de 1.000 tópicos por mapa nesta versão.'; end if;
  -- Nunca aceite um ID existente em outro mapa, mesmo se for do mesmo usuário.
  if exists (select 1 from public.topics where map_id <> p_map_id and id in
    (select (value->>'id')::uuid from jsonb_array_elements(p_content->'topics'))) then
    raise exception 'Tópico pertence a outro mapa.';
  end if;
  delete from public.topic_relations where map_id = p_map_id;
  for t in select value from jsonb_array_elements(p_content->'topics') loop
    insert into public.topics (id,map_id,parent_id,title,description,color,icon,status,tags,notes,links,x,y,collapsed)
    values ((t->>'id')::uuid,p_map_id,(t->>'parent_id')::uuid,t->>'title',coalesce(t->>'description',''),t->>'color',t->>'icon',t->>'status',
      array(select jsonb_array_elements_text(t->'tags')),t->'notes',t->'links',(t->>'x')::double precision,(t->>'y')::double precision,(t->>'collapsed')::boolean)
    on conflict (id) do update set parent_id=excluded.parent_id,title=excluded.title,description=excluded.description,
      color=excluded.color,icon=excluded.icon,status=excluded.status,tags=excluded.tags,notes=excluded.notes,
      links=excluded.links,x=excluded.x,y=excluded.y,collapsed=excluded.collapsed;
  end loop;
  delete from public.topics where map_id = p_map_id and id not in
    (select (value->>'id')::uuid from jsonb_array_elements(p_content->'topics'));
  for r in select value from jsonb_array_elements(p_content->'relations') loop
    insert into public.topic_relations(id,map_id,source_id,target_id)
    values ((r->>'id')::uuid,p_map_id,least((r->>'source_id')::uuid,(r->>'target_id')::uuid),greatest((r->>'source_id')::uuid,(r->>'target_id')::uuid));
  end loop;
  update public.study_maps set revision = revision+1, viewport = p_content->'viewport', updated_at = now()
    where id = p_map_id returning revision into result_revision;
  return result_revision;
end; $$;
revoke execute on function public.save_study_map(uuid,bigint,jsonb) from public, anon;
grant execute on function public.save_study_map(uuid,bigint,jsonb) to authenticated;
-- Uma única consulta usa um único snapshot, mesmo com outra janela salvando.
create function public.load_study_map(p_map_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('map',to_jsonb(m),
    'topics',coalesce((select jsonb_agg(t) from public.topics t where t.map_id = m.id),'[]'::jsonb),
    'relations',coalesce((select jsonb_agg(r) from public.topic_relations r where r.map_id = m.id),'[]'::jsonb))
  from public.study_maps m where m.id = p_map_id and m.user_id = (select auth.uid());
$$;
revoke execute on function public.load_study_map(uuid) from public, anon;
grant execute on function public.load_study_map(uuid) to authenticated;
revoke execute on function public.lock_topic_map(), public.check_topic_tree() from public, anon, authenticated;
commit;
