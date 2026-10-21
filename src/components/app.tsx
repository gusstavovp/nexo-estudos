"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudOff,
  Download,
  GitBranch,
  LayoutGrid,
  Library,
  List,
  LogOut,
  Maximize,
  Menu,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import {
  ancestors,
  deleteBranch,
  descendants,
  matches,
  newTopic,
  relationExists,
  suggestions,
} from "@/lib/graph";
import { STATUS, type Topic } from "@/lib/types";
import { useWorkspace } from "@/lib/use-workspace";
import Auth from "./auth";
import Modal from "./modal";
import TopicIcon from "./icon";
import TopicEditor from "./topic-editor";
const StudyCanvas = dynamic(() => import("./study-canvas"), {
  ssr: false,
  loading: () => (
    <div className="center-state" role="status">
      Abrindo o mapa…
    </div>
  ),
});

export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [authError, setAuthError] = useState(""),
    [recovering, setRecovering] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    queueMicrotask(() => {
      try {
        setDark(localStorage.getItem("nexo.theme.v1") === "dark");
      } catch {
        /* Preferência opcional. */
      }
    });
    const db = getSupabase();
    if (!db) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let mounted = true;
    db.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error)
          setAuthError(
            "Não foi possível recuperar sua sessão. Recarregue para tentar novamente.",
          );
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) {
          setAuthError("Não foi possível conectar. Verifique sua internet.");
          setLoading(false);
        }
      });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
        if (event === "PASSWORD_RECOVERY") setRecovering(true);
      }
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  const toggleTheme = () =>
    setDark((d) => {
      try {
        localStorage.setItem("nexo.theme.v1", d ? "light" : "dark");
      } catch {}
      return !d;
    });
  if (loading)
    return (
      <main className="center-state" role="status">
        <span className="brand-mark">n</span>
        <p>Abrindo seu universo de estudos…</p>
      </main>
    );
  if (!getSupabase()) return <Setup />;
  if (authError)
    return (
      <main className="center-state">
        <h1>Vamos reconectar.</h1>
        <p role="alert">{authError}</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
      </main>
    );
  if (recovering && user)
    return <PasswordRecovery done={() => setRecovering(false)} />;
  if (!user) return <Auth />;
  return (
    <Workspace
      key={user.id}
      user={user}
      dark={dark}
      toggleTheme={toggleTheme}
    />
  );
}
function Setup() {
  return (
    <main className="setup-page">
      <Link className="brand" href="/">
        <span className="brand-mark">n</span>nexo.
      </Link>
      <section className="setup-card">
        <span className="eyebrow">UM NOVO COMEÇO</span>
        <h1>Seu espaço está quase pronto.</h1>
        <p>
          Conecte seu projeto Supabase para começar a criar, organizar e
          conectar seus estudos.
        </p>
        <ol>
          <li>
            <b>Crie um projeto separado no Supabase.</b>
            <span>Ative o acesso por e-mail e senha em Authentication.</span>
          </li>
          <li>
            <b>Prepare o banco de dados.</b>
            <span>
              Execute o arquivo de migração da pasta supabase/migrations no SQL
              Editor.
            </span>
          </li>
          <li>
            <b>Configure a conexão.</b>
            <span>
              Copie .env.example para .env.local e preencha a URL e a chave
              pública do projeto. Reinicie a aplicação.
            </span>
          </li>
        </ol>
        <div className="setup-note">
          <BookOpen size={18} />
          <span>O passo a passo completo está no README do projeto.</span>
        </div>
        <a
          className="primary"
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir Supabase <ArrowRight size={17} />
        </a>
      </section>
      <span className="setup-caption">CADA IDEIA ENCONTRA SEU LUGAR.</span>
    </main>
  );
}
function PasswordRecovery({ done }: { done: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { error } = await getSupabase()!.auth.updateUser({
      password: String(new FormData(e.currentTarget).get("password")),
    });
    setBusy(false);
    if (error)
      setError(
        "Não foi possível alterar a senha. Peça um novo link e tente novamente.",
      );
    else done();
  }
  return (
    <main className="center-state">
      <form className="setup-card" onSubmit={submit}>
        <h1>Uma nova senha.</h1>
        <label>
          Nova senha
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}

function Workspace({
  user,
  dark,
  toggleTheme,
}: {
  user: User;
  dark: boolean;
  toggleTheme: () => void;
}) {
  const w = useWorkspace(user.id);
  const [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState<"map" | "list" | "library">("map");
  const [query, setQuery] = useState(""),
    [subject, setSubject] = useState(""),
    [tag, setTag] = useState(""),
    [status, setStatus] = useState("");
  const [modal, setModal] = useState<"map" | "delete" | "help" | null>(null),
    [mobileNav, setMobileNav] = useState(false),
    [showSuggestions, setShowSuggestions] = useState(false);
  const [focus, setFocus] = useState<{ id: string; nonce: number } | null>(
      null,
    ),
    [fitToken, setFitToken] = useState(0),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { content, change } = w;
  const patch = useCallback(
    (id: string, patch: Partial<Topic>) =>
      change((c) => ({
        ...c,
        topics: c.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    [change],
  );
  const select = useCallback(
    (id: string) => {
      change((c) => {
        const path = new Set(
          ancestors(id, c.topics)
            .slice(0, -1)
            .map((t) => t.id),
        );
        if (!c.topics.some((t) => path.has(t.id) && t.collapsed)) return c;
        return {
          ...c,
          topics: c.topics.map((t) =>
            path.has(t.id) ? { ...t, collapsed: false } : t,
          ),
        };
      });
      setSelected(id);
      setFocus({ id, nonce: Date.now() });
      setMobileNav(false);
    },
    [change],
  );
  const add = useCallback(
    (parent?: string) => {
      if (!w.active) return;
      const t = newTopic(w.active.id, content.topics, parent ?? null);
      change((c) => ({
        ...c,
        topics: [
          ...c.topics.map((x) =>
            x.id === parent ? { ...x, collapsed: false } : x,
          ),
          t,
        ],
      }));
      setSelected(t.id);
      setFocus({ id: t.id, nonce: Date.now() });
    },
    [w.active, content.topics, change],
  );
  const connect = useCallback(
    (a: string, b: string) => {
      if (a === b) return;
      change((c) =>
        relationExists(a, b, c.relations)
          ? c
          : {
              ...c,
              relations: [
                ...c.relations,
                {
                  id: crypto.randomUUID(),
                  map_id: w.active!.id,
                  source_id: a,
                  target_id: b,
                },
              ],
            },
      );
    },
    [change, w.active],
  );
  const selectedTopic = content.topics.find((t) => t.id === selected);
  const roots = content.topics.filter((t) => !t.parent_id);
  const allTags = [...new Set(content.topics.flatMap((t) => t.tags))].sort();
  const filtered = content.topics.filter(
    (t) =>
      matches(t, query) &&
      (!subject || ancestors(t.id, content.topics)[0]?.id === subject) &&
      (!tag || t.tags.includes(tag)) &&
      (!status || t.status === status),
  );
  const hasFilter = Boolean(query || subject || tag || status);
  const matchIds = hasFilter ? new Set(filtered.map((t) => t.id)) : null;
  const suggested = suggestions(content.topics, content.relations).filter(
    (s) => !dismissed.has([s.a.id, s.b.id].sort().join(":")),
  );
  const reviewed = content.topics.filter((t) => t.status === "reviewed").length;
  const progress = content.topics.length
    ? Math.round((reviewed / content.topics.length) * 100)
    : 0;
  const exportDraft = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ map: w.active, ...content }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexo-rascunho.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const clearFilters = () => {
    setQuery("");
    setSubject("");
    setTag("");
    setStatus("");
  };
  async function switchMap(id: string) {
    const m = w.maps.find((m) => m.id === id);
    if (m && (await w.openMap(m))) {
      setSelected(null);
      clearFilters();
    }
  }
  async function signOut() {
    if (!(await w.save())) return;
    const { error } = await getSupabase()!.auth.signOut();
    if (error) setActionError("Não foi possível sair. Tente novamente.");
  }
  return (
    <div className={`workspace ${selectedTopic ? "with-detail" : ""}`}>
      <a className="skip-link" href="#main-content">
        Ir para conteúdo
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
        <Link className="brand" href="/">
          <span className="brand-mark">n</span>nexo
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            <BookOpen size={17} />
          </span>
          <div>
            <strong>Meu espaço</strong>
            <span>Conhecimento em conexão</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-caption">BIBLIOTECA PESSOAL</span>
        <nav className="main-nav" aria-label="Visualizações">
          <button
            className={view === "map" ? "active" : ""}
            onClick={() => {
              setView("map");
              setMobileNav(false);
            }}
          >
            <GitBranch size={18} /> Mapa de estudos{" "}
            <span>{content.topics.length}</span>
          </button>
          <button
            className={view === "list" ? "active" : ""}
            onClick={() => {
              setView("list");
              setMobileNav(false);
            }}
          >
            <List size={18} /> Todos os tópicos
          </button>
          <button
            className={view === "library" ? "active" : ""}
            onClick={() => {
              setView("library");
              setMobileNav(false);
            }}
          >
            <Library size={18} /> Meus materiais{" "}
            <span>
              {content.topics.reduce(
                (a, t) => a + t.links.length + t.notes.length,
                0,
              )}
            </span>
          </button>
        </nav>
        <div className="nav-section-heading">
          <span className="nav-caption">SEUS MAPAS</span>
          <button
            className="icon-button"
            aria-label="Criar mapa"
            onClick={() => setModal("map")}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="map-select">
          <select
            aria-label="Mapa de estudos atual"
            value={w.active?.id ?? ""}
            onChange={(e) => void switchMap(e.target.value)}
          >
            {!w.maps.length && <option value="">Nenhum mapa ainda</option>}
            {w.maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
        <div className="nav-section-heading">
          <span className="nav-caption">MATÉRIAS E ASSUNTOS</span>
          {w.active && (
            <button
              className="icon-button"
              aria-label="Adicionar matéria"
              onClick={() => add()}
            >
              <Plus size={15} />
            </button>
          )}
        </div>
        <nav className="tree" aria-label="Árvore de tópicos">
          {roots.length ? (
            roots.map((t) => (
              <Tree
                key={t.id}
                topic={t}
                topics={content.topics}
                selected={selected}
                select={select}
                toggle={(id) =>
                  patch(id, {
                    collapsed: !content.topics.find((x) => x.id === id)
                      ?.collapsed,
                  })
                }
              />
            ))
          ) : (
            <p className="tree-empty">
              Suas matérias vão
              <br />
              encontrar um lugar aqui.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="progress-card">
            <div>
              <span>Um passo de cada vez</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <small>
              {reviewed} de {content.topics.length} tópicos revisados
            </small>
          </div>
          <div className="sidebar-tools">
            <button onClick={toggleTheme}>
              {dark ? <Sun size={17} /> : <Moon size={17} />}
              {dark ? "Tema claro" : "Tema escuro"}
            </button>
            <button
              className="icon-button"
              aria-label="Ajuda"
              onClick={() => setModal("help")}
            >
              <CircleHelp size={17} />
            </button>
          </div>
          <div className="profile">
            <span className="user-avatar">
              {user.email?.[0].toUpperCase() ?? "E"}
            </span>
            <div>
              <strong>Meu cantinho de estudos</strong>
              <small>{user.email}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Sair da conta"
              onClick={() => void signOut()}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content" id="main-content">
        <header className="topbar">
          <div className="inline">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir navegação"
              onClick={() => setMobileNav(true)}
            >
              <Menu size={21} />
            </button>
            <span className="topbar-breadcrumb">
              Meu espaço <ChevronRight size={13} />{" "}
              <b>{w.active?.title ?? "Novo mapa"}</b>
            </span>
          </div>
          <div className="inline">
            <span className={`save-state ${w.saveState}`} role="status">
              {w.saveState === "error" ? (
                <CloudOff size={15} />
              ) : w.saveState === "saved" ? (
                <Check size={15} />
              ) : (
                <Cloud size={15} />
              )}
              {
                {
                  saved: "Tudo salvo",
                  pending: "Alterações pendentes",
                  saving: "Salvando…",
                  error: "Não salvo",
                }[w.saveState]
              }
            </span>
            <button
              className="icon-button"
              aria-label="Exportar rascunho"
              title="Exportar rascunho"
              onClick={exportDraft}
            >
              <Download size={17} />
            </button>
          </div>
        </header>
        <section className="page-heading">
          <div>
            <span className="eyebrow">
              CONECTE IDEIAS. EXPANDA POSSIBILIDADES.
            </span>
            <h1>
              {view === "library"
                ? "Sua biblioteca viva"
                : view === "list"
                  ? "Cada assunto, um novo caminho"
                  : "Seu universo de estudos"}
              <span className="heading-dot">.</span>
            </h1>
            <p>
              {view === "library"
                ? "Seus links e anotações, sempre perto de uma boa ideia."
                : "Um lugar para organizar o que você aprende e descobrir o que conecta tudo."}
            </p>
          </div>
          <button
            className="primary"
            onClick={() => (w.active ? add() : setModal("map"))}
          >
            <Plus size={18} />
            {w.active ? "Novo tópico" : "Criar mapa"}
          </button>
        </section>
        <div className="workspace-toolbar">
          <div className="view-tabs">
            <button
              className={view === "map" ? "active" : ""}
              onClick={() => setView("map")}
            >
              <GitBranch size={16} /> Mapa
            </button>
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              <List size={16} /> Lista
            </button>
          </div>
          <div className="toolbar-actions">
            <button
              className={`suggestion-button ${showSuggestions ? "chosen" : ""}`}
              onClick={() => setShowSuggestions((s) => !s)}
            >
              <Sparkles size={15} />
              <span>Descobrir conexões</span>
              {suggested.length > 0 && <b>{suggested.length}</b>}
            </button>
            {view === "map" && (
              <button
                className="icon-button"
                title="Enquadrar todo o mapa"
                aria-label="Enquadrar todo o mapa"
                onClick={() => setFitToken((t) => t + 1)}
              >
                <Maximize size={17} />
              </button>
            )}
          </div>
        </div>
        <div className="filterbar">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label="Buscar conteúdos"
              placeholder="Buscar ideias, tags, anotações…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                className="icon-button"
                aria-label="Limpar busca"
                onClick={() => setQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="filter-selects">
            <select
              aria-label="Filtrar por matéria"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">Todas as matérias</option>
              {roots.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">Todas as tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {hasFilter && (
              <button className="text-button" onClick={clearFilters}>
                Limpar
              </button>
            )}
          </div>
        </div>
        {(w.error || actionError) && (
          <div className="error-banner" role="alert">
            <CloudOff size={18} />
            <span>{w.error || actionError}</span>
            <button
              onClick={() => {
                w.retry();
                setActionError("");
              }}
            >
              Tentar novamente
            </button>
            <button onClick={exportDraft}>Exportar rascunho</button>
          </div>
        )}
        {hasFilter && (
          <div className="search-results">
            <span>
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
            {filtered.slice(0, 20).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  select(t.id);
                  setView("map");
                }}
              >
                <span style={{ color: t.color }}>
                  <TopicIcon name={t.icon} size={14} />
                </span>
                {t.title}
                <ChevronRight size={12} />
              </button>
            ))}
            {filtered.length > 20 && (
              <button onClick={() => setView("list")}>
                Ver todos na lista
              </button>
            )}
          </div>
        )}
        {showSuggestions && (
          <section className="suggestions">
            <div className="section-heading">
              <div>
                <h3>
                  <Sparkles size={16} /> Pontes entre suas ideias
                </h3>
                <p>
                  Sugestões locais por tags e palavras em comum. Você decide o
                  que conectar.
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Fechar sugestões"
                onClick={() => setShowSuggestions(false)}
              >
                <X size={17} />
              </button>
            </div>
            {suggested.length ? (
              <div className="suggestion-grid">
                {suggested.map((s) => (
                  <article key={`${s.a.id}-${s.b.id}`}>
                    <div>
                      <b>{s.a.title}</b>
                      <span>↔</span>
                      <b>{s.b.title}</b>
                    </div>
                    <p>{s.reason}</p>
                    <div className="inline">
                      <button
                        className="text-button"
                        onClick={() => connect(s.a.id, s.b.id)}
                      >
                        <Plus size={13} /> Conectar
                      </button>
                      <button
                        className="text-button muted"
                        onClick={() =>
                          setDismissed(
                            (d) =>
                              new Set([
                                ...d,
                                [s.a.id, s.b.id].sort().join(":"),
                              ]),
                          )
                        }
                      >
                        Dispensar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-hint">
                Nenhuma sugestão por enquanto. Adicione tags aos seus tópicos
                para descobrir conexões.
              </p>
            )}
          </section>
        )}
        <div className="workspace-body">
          {w.loading ? (
            <div className="center-state" role="status">
              <span className="loading-orbit" />
              <p>Buscando seus conhecimentos…</p>
            </div>
          ) : !w.active ? (
            <div className="center-state new-map-state">
              <span className="large-empty-icon">
                <LayoutGrid size={34} />
              </span>
              <span className="eyebrow">SEU PRÓXIMO CAPÍTULO</span>
              <h2>Uma ideia pode levar muito longe.</h2>
              <p>Crie um mapa e transforme seus estudos em conexões.</p>
              <button className="primary" onClick={() => setModal("map")}>
                <Plus size={17} /> Criar meu primeiro mapa
              </button>
            </div>
          ) : view === "map" ? (
            <StudyCanvas
              key={w.active.id}
              content={content}
              selected={selected}
              select={select}
              patch={patch}
              add={add}
              connect={connect}
              viewport={(v) => change((c) => ({ ...c, viewport: v }))}
              focus={focus}
              matchIds={matchIds}
              fitToken={fitToken}
              dark={dark}
            />
          ) : view === "list" ? (
            <div className="topic-list">
              <div className="list-header">
                <span>ASSUNTO</span>
                <span>CAMINHO</span>
                <span>STATUS</span>
              </div>
              {filtered.map((t) => (
                <button
                  key={t.id}
                  className={`topic-list-row ${selected === t.id ? "selected" : ""}`}
                  onClick={() => select(t.id)}
                >
                  <span>
                    <i style={{ color: t.color, background: `${t.color}12` }}>
                      <TopicIcon name={t.icon} />
                    </i>
                    <b>{t.title}</b>
                  </span>
                  <span>
                    {ancestors(t.id, content.topics)
                      .slice(0, -1)
                      .map((a) => a.title)
                      .join(" / ") || "Matéria"}
                  </span>
                  <span className={`study-badge ${t.status}`}>
                    <i />
                    {STATUS[t.status]}
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!filtered.length && (
                <div className="center-state">
                  <BookOpen size={30} />
                  <h2>
                    {hasFilter
                      ? "Nenhum tópico encontrado."
                      : "Seu mapa está pronto para começar."}
                  </h2>
                  <p>
                    {hasFilter
                      ? "Experimente outros termos ou filtros."
                      : "Adicione uma matéria pelo botão Novo tópico."}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="library-grid">
              {filtered.flatMap((t) => [
                ...t.links.map((l) => (
                  <button
                    className="library-card"
                    key={l.id}
                    onClick={() => select(t.id)}
                  >
                    <span className="material-type">LINK DE ESTUDO</span>
                    <h3>{l.title}</h3>
                    <p>{l.url}</p>
                    <footer>
                      <TopicIcon name={t.icon} size={14} />
                      {t.title}
                      <ArrowRight size={14} />
                    </footer>
                  </button>
                )),
                ...t.notes.map((n) => (
                  <button
                    className="library-card note-card"
                    key={n.id}
                    onClick={() => select(t.id)}
                  >
                    <span className="material-type">ANOTAÇÃO</span>
                    <h3>{n.title}</h3>
                    <p>
                      {n.body.slice(0, 160) || "Continue escrevendo sua ideia…"}
                    </p>
                    <footer>
                      <TopicIcon name={t.icon} size={14} />
                      {t.title}
                      <ArrowRight size={14} />
                    </footer>
                  </button>
                )),
              ])}
              {!filtered.some((t) => t.notes.length || t.links.length) && (
                <div className="center-state">
                  <Library size={32} />
                  <h2>Boas referências merecem um lugar.</h2>
                  <p>Abra um tópico para adicionar links e anotações.</p>
                </div>
              )}
            </div>
          )}
        </div>
        <footer className="workspace-footer">
          <span>
            <span className="tiny-dot" /> {content.topics.length} tópicos{" "}
            <span className="footer-divider">/</span> {content.relations.length}{" "}
            conexões
          </span>
          <span>Aprender é conectar.</span>
        </footer>
      </main>
      {selectedTopic && !w.loading && (
        <TopicEditor
          key={selectedTopic.id}
          topic={selectedTopic}
          content={content}
          patch={(p) => patch(selectedTopic.id, p)}
          select={select}
          add={add}
          close={() => setSelected(null)}
          duplicate={() => {
            const t = {
              ...selectedTopic,
              id: crypto.randomUUID(),
              title: `${selectedTopic.title.slice(0, 150)} (cópia)`,
              x: selectedTopic.x + 50,
              y: selectedTopic.y + 70,
              notes: selectedTopic.notes.map((n) => ({
                ...n,
                id: crypto.randomUUID(),
              })),
              links: selectedTopic.links.map((l) => ({
                ...l,
                id: crypto.randomUUID(),
              })),
            };
            change((c) => ({ ...c, topics: [...c.topics, t] }));
            setSelected(t.id);
          }}
          remove={() => setModal("delete")}
          connect={connect}
          disconnect={(id) =>
            change((c) => ({
              ...c,
              relations: c.relations.filter((r) => r.id !== id),
            }))
          }
        />
      )}
      {modal === "map" && (
        <Modal
          title="Um novo mapa, novas possibilidades."
          close={() => setModal(null)}
        >
          <p className="muted">
            Separe seus estudos por ano, objetivo ou projeto.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const ok = await w.createMap(
                  String(new FormData(e.currentTarget).get("title")),
                );
                if (ok) {
                  setSelected(null);
                  clearFilters();
                  setModal(null);
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nome do mapa
              <input
                name="title"
                autoFocus
                required
                maxLength={120}
                placeholder="Ex.: Meus estudos de 2026"
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Criando…" : "Criar mapa"}
              <ArrowRight size={16} />
            </button>
            {w.error && (
              <p className="form-error" role="alert">
                {w.error}
              </p>
            )}
          </form>
        </Modal>
      )}
      {modal === "delete" && selectedTopic && (
        <Modal
          title={`Excluir “${selectedTopic.title}”?`}
          close={() => setModal(null)}
        >
          <p>
            Isso removerá este tópico,{" "}
            <b>
              {descendants(selectedTopic.id, content.topics).size} subtópico(s)
            </b>{" "}
            e todos os seus links, anotações e relações. A exclusão será salva
            automaticamente e não poderá ser desfeita.
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button
              className="danger"
              onClick={() => {
                change((c) => deleteBranch(c, selectedTopic.id));
                setSelected(null);
                setModal(null);
              }}
            >
              Excluir tópico e descendentes
            </button>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Faça conexões, no seu ritmo."
          close={() => setModal(null)}
        >
          <div className="help-content">
            <p>
              <b>Organize.</b> Crie matérias e use o + de cada cartão para
              adicionar subtópicos. A árvore à esquerda acompanha a hierarquia.
            </p>
            <p>
              <b>Conecte.</b> Arraste entre os pontos laterais dos cartões ou
              use a aba Conexões. Linhas tracejadas são relações; linhas
              contínuas mostram hierarquia.
            </p>
            <p>
              <b>Estude.</b> Selecione um tópico para editar anotações, links,
              tags e status. Em Ajustes, altere o pai ou a posição por
              formulário.
            </p>
            <p>
              <b>Encontre.</b> Busque pelo conteúdo e clique no resultado para
              abrir seu contexto. No celular, use a visualização em lista.
            </p>
            <p>
              <b>Salve.</b> Aguarde “Tudo salvo” antes de fechar. Em caso de
              erro, tente novamente ou exporte o rascunho. Alterações
              simultâneas em outra janela exigem recarregar.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Tree({
  topic: t,
  topics,
  selected,
  select,
  toggle,
  depth = 0,
}: {
  topic: Topic;
  topics: Topic[];
  selected: string | null;
  select: (id: string) => void;
  toggle: (id: string) => void;
  depth?: number;
}) {
  const children = topics.filter((x) => x.parent_id === t.id);
  return (
    <div className="tree-branch">
      <div
        className={`tree-row ${selected === t.id ? "selected" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <button
          className="tree-chevron"
          aria-label={`${t.collapsed ? "Expandir" : "Recolher"} ${t.title}`}
          disabled={!children.length}
          onClick={() => toggle(t.id)}
        >
          {children.length ? (
            t.collapsed ? (
              <ChevronRight size={13} />
            ) : (
              <ChevronDown size={13} />
            )
          ) : (
            <span className="tree-leaf" />
          )}
        </button>
        <button className="tree-topic" onClick={() => select(t.id)}>
          <span style={{ color: t.color }}>
            <TopicIcon name={t.icon} size={15} />
          </span>
          <span>{t.title}</span>
          {depth === 0 && <small>{children.length}</small>}
        </button>
      </div>
      {!t.collapsed &&
        children.map((c) => (
          <Tree
            key={c.id}
            topic={c}
            topics={topics}
            selected={selected}
            select={select}
            toggle={toggle}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
