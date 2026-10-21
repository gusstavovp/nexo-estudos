import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { newTopic } from "../src/lib/graph";
import type { MapContent } from "../src/lib/types";

test("PostgreSQL: migração, RLS, persistência, ciclos, duplicatas e conflitos", async (t) => {
  const db = new PGlite();
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid$$;
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  await db.query("insert into auth.users values ($1), ($2)", [a, b]);
  await db.exec(
    await readFile("supabase/migrations/202610210001_nexo.sql", "utf8"),
  );
  const asUser = async <T>(uid: string, fn: () => Promise<T>) => {
    await db.exec("begin; set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    try {
      const result = await fn();
      await db.exec("commit");
      return result;
    } catch (e) {
      await db.exec("rollback");
      throw e;
    }
  };
  const map = crypto.randomUUID(),
    secondMap = crypto.randomUUID();
  const root = { ...newTopic(map, []), title: "Matemática" };
  const child = {
    ...newTopic(map, [root], root.id),
    title: "Função afim",
    tags: ["linear"],
    notes: [{ id: crypto.randomUUID(), title: "Resumo", body: "**Texto**" }],
    links: [
      {
        id: crypto.randomUUID(),
        title: "Material",
        url: "https://example.org",
      },
    ],
  };
  const other = { ...newTopic(map, []), title: "Física" };
  const content: MapContent = {
    topics: [root, child, other],
    relations: [
      {
        id: crypto.randomUUID(),
        map_id: map,
        source_id: child.id,
        target_id: other.id,
      },
    ],
    viewport: { x: 43, y: 20, zoom: 0.8 },
  };
  const persist = (uid: string, rev: number, payload: MapContent = content) =>
    asUser(uid, () =>
      db.query<{ revision: number }>(
        "select public.save_study_map($1,$2,$3::jsonb) as revision",
        [map, rev, JSON.stringify(payload)],
      ),
    );
  await t.test(
    "usuário cria mapa e salva conteúdo real em uma transação",
    async () => {
      await asUser(a, () =>
        db.query(
          "insert into public.study_maps(id,title) values ($1,$2),($3,$4)",
          [map, "Meus estudos", secondMap, "Outro mapa"],
        ),
      );
      const result = await persist(a, 0);
      assert.equal(Number(result.rows[0].revision), 1);
      const loaded = await asUser(a, () =>
        db.query<{
          data: {
            topics: typeof content.topics;
            relations: typeof content.relations;
            map: { viewport: typeof content.viewport };
          };
        }>("select public.load_study_map($1) as data", [map]),
      );
      const data = loaded.rows[0].data;
      assert.equal(data.topics.length, 3);
      assert.equal(data.relations.length, 1);
      assert.equal(
        data.topics.find((x) => x.id === child.id)?.notes[0].body,
        "**Texto**",
      );
      assert.equal(
        data.topics.find((x) => x.id === child.id)?.parent_id,
        root.id,
      );
      assert.equal(data.topics.find((x) => x.id === child.id)?.x, child.x);
      assert.equal(
        data.topics.find((x) => x.id === child.id)?.links[0].title,
        "Material",
      );
      assert.deepEqual(data.map.viewport, content.viewport);
    },
  );
  await t.test(
    "outro usuário não lê nem altera os dados do primeiro",
    async () => {
      for (const table of ["study_maps", "topics", "topic_relations"]) {
        const rows = await asUser(b, () =>
          db.query(`select * from public.${table}`),
        );
        assert.equal(rows.rows.length, 0);
      }
      await assert.rejects(persist(b, 1), /Mapa indisponível/);
      const update = await asUser(b, () =>
        db.query("update public.topics set title=$1 where id=$2 returning id", [
          "Invadido",
          child.id,
        ]),
      );
      assert.equal(update.rows.length, 0);
      await assert.rejects(
        asUser(b, () =>
          db.query("insert into public.topics(map_id,title) values ($1,$2)", [
            map,
            "Invasor",
          ]),
        ),
        /row-level security/,
      );
      await assert.rejects(
        asUser(a, () =>
          db.query("update public.study_maps set user_id=$1 where id=$2", [
            b,
            map,
          ]),
        ),
        /row-level security/,
      );
    },
  );
  await t.test(
    "sessão anônima não acessa tabelas nem operações de salvamento",
    async () => {
      await db.exec("begin; set local role anon");
      await assert.rejects(
        db.query("select * from public.study_maps"),
        /permission denied/,
      );
      await db.exec("rollback");
      await db.exec("begin; set local role anon");
      await assert.rejects(
        db.query("select public.save_study_map($1,1,$2::jsonb)", [
          map,
          JSON.stringify(content),
        ]),
        /permission denied/,
      );
      await db.exec("rollback");
    },
  );
  await t.test("ciclo reverte integralmente a transação", async () => {
    await assert.rejects(
      persist(a, 1, {
        ...content,
        topics: content.topics.map((x) =>
          x.id === root.id ? { ...x, parent_id: child.id } : x,
        ),
      }),
      /ciclos/,
    );
    const rev = await asUser(a, () =>
      db.query<{ revision: number }>(
        "select revision from public.study_maps where id=$1",
        [map],
      ),
    );
    assert.equal(Number(rev.rows[0].revision), 1);
    await assert.rejects(
      asUser(a, () =>
        db.query("update public.topics set parent_id=$1 where id=$2", [
          child.id,
          root.id,
        ]),
      ),
      /ciclos/,
    );
  });
  await t.test(
    "relações reversas duplicadas e conexões entre mapas são rejeitadas",
    async () => {
      await assert.rejects(
        persist(a, 1, {
          ...content,
          relations: [
            ...content.relations,
            {
              ...content.relations[0],
              id: crypto.randomUUID(),
              source_id: other.id,
              target_id: child.id,
            },
          ],
        }),
        /duplicate key/,
      );
      const outside = { ...newTopic(secondMap, []), title: "Externo" };
      await asUser(a, () =>
        db.query(
          "insert into public.topics(id,map_id,title) values ($1,$2,$3)",
          [outside.id, secondMap, outside.title],
        ),
      );
      await assert.rejects(
        persist(a, 1, {
          ...content,
          relations: [{ ...content.relations[0], target_id: outside.id }],
        }),
        /foreign key/,
      );
      await assert.rejects(
        persist(a, 1, {
          ...content,
          topics: [...content.topics, { ...outside, map_id: map }],
        }),
        /outro mapa/,
      );
    },
  );
  await t.test(
    "revisão desatualizada não sobrescreve a versão confirmada",
    async () => {
      await assert.rejects(persist(a, 0), /CONFLICT/);
      const updated = {
        ...content,
        topics: content.topics.map((x) =>
          x.id === child.id ? { ...x, x: 912, y: 314 } : x,
        ),
      };
      await persist(a, 1, updated);
      const rows = await asUser(a, () =>
        db.query<{ x: number; y: number; parent_id: string }>(
          "select x,y,parent_id from public.topics where id=$1",
          [child.id],
        ),
      );
      assert.equal(rows.rows[0].x, 912);
      assert.equal(rows.rows[0].y, 314);
      assert.equal(rows.rows[0].parent_id, root.id);
    },
  );
  await t.test(
    "excluir ramo remove materiais e relações mantendo outros ramos",
    async () => {
      await persist(a, 2, { ...content, topics: [other], relations: [] });
      const rows = await asUser(a, () =>
        db.query<{ id: string }>(
          "select id from public.topics where map_id=$1",
          [map],
        ),
      );
      assert.deepEqual(
        rows.rows.map((x) => x.id),
        [other.id],
      );
      const rels = await asUser(a, () =>
        db.query("select * from public.topic_relations where map_id=$1", [map]),
      );
      assert.equal(rels.rows.length, 0);
    },
  );
  await db.close();
});
