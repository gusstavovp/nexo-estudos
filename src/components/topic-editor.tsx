"use client";
import { useState } from "react";
import Markdown from "react-markdown";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ancestors, canParent, safeUrl } from "@/lib/graph";
import {
  COLORS,
  ICONS,
  ICON_LABELS,
  STATUS,
  type Topic,
  type MapContent,
} from "@/lib/types";
import TopicIcon from "./icon";

type Props = {
  topic: Topic;
  content: MapContent;
  patch: (patch: Partial<Topic>) => void;
  select: (id: string) => void;
  add: (parent: string) => void;
  duplicate: () => void;
  remove: () => void;
  connect: (a: string, b: string) => void;
  disconnect: (id: string) => void;
  close: () => void;
};
export default function TopicEditor({
  topic: t,
  content,
  patch,
  select,
  add,
  duplicate,
  remove,
  connect,
  disconnect,
  close,
}: Props) {
  const [tab, setTab] = useState("content"),
    [tag, setTag] = useState(""),
    [target, setTarget] = useState("");
  const [linkError, setLinkError] = useState(""),
    [preview, setPreview] = useState<string | null>(null);
  const children = content.topics.filter((x) => x.parent_id === t.id);
  const related = content.relations.filter(
    (r) => r.source_id === t.id || r.target_id === t.id,
  );
  const path = ancestors(t.id, content.topics);
  function addTag() {
    const next = tag.trim().slice(0, 40);
    if (next && !t.tags.includes(next) && t.tags.length < 30)
      patch({ tags: [...t.tags, next] });
    setTag("");
  }
  return (
    <aside className="detail-panel" aria-label="Detalhes do tópico">
      <div className="detail-top">
        <span className="eyebrow">SEU CONHECIMENTO</span>
        <div className="inline">
          <button
            className="icon-button"
            title="Duplicar tópico"
            aria-label="Duplicar tópico"
            onClick={duplicate}
          >
            <Copy size={16} />
          </button>
          <button
            className="icon-button"
            title="Excluir tópico"
            aria-label="Excluir tópico"
            onClick={remove}
          >
            <Trash2 size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Fechar detalhes"
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
      </div>
      <nav className="breadcrumbs" aria-label="Localização">
        {path.map((p, i) => (
          <span key={p.id}>
            {i > 0 && <ChevronRight size={11} />}
            <button onClick={() => select(p.id)}>{p.title}</button>
          </span>
        ))}
      </nav>
      <div className="topic-hero">
        <span
          className="topic-symbol"
          style={{ color: t.color, background: `${t.color}16` }}
        >
          <TopicIcon name={t.icon} size={26} />
        </span>
        <input
          className="title-input"
          aria-label="Título do tópico"
          maxLength={160}
          value={t.title}
          onChange={(e) => patch({ title: e.target.value })}
          onBlur={() => {
            if (!t.title.trim()) patch({ title: "Sem título" });
          }}
        />
        <select
          className={`status-select ${t.status}`}
          aria-label="Status de estudo"
          value={t.status}
          onChange={(e) => patch({ status: e.target.value as Topic["status"] })}
        >
          {Object.entries(STATUS).map(([v, l]) => (
            <option value={v} key={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="detail-tabs">
        <button
          className={tab === "content" ? "active" : ""}
          onClick={() => setTab("content")}
        >
          Conteúdo
        </button>
        <button
          className={tab === "connections" ? "active" : ""}
          onClick={() => setTab("connections")}
        >
          Conexões <span>{related.length + children.length}</span>
        </button>
        <button
          className={tab === "settings" ? "active" : ""}
          onClick={() => setTab("settings")}
        >
          Ajustes
        </button>
      </div>
      <div className="detail-body">
        {tab === "content" ? (
          <>
            <label className="field-heading">
              Sobre este tópico
              <textarea
                placeholder="O que você quer aprender sobre isso?"
                value={t.description}
                maxLength={20000}
                onChange={(e) => patch({ description: e.target.value })}
                rows={3}
              />
            </label>
            <section>
              <h3>
                Tags <span>para conectar ideias</span>
              </h3>
              <div className="tags">
                {t.tags.map((s) => (
                  <span className="tag" key={s}>
                    #{s}
                    <button
                      aria-label={`Remover tag ${s}`}
                      onClick={() =>
                        patch({ tags: t.tags.filter((x) => x !== s) })
                      }
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="inline tag-entry">
                <input
                  aria-label="Nova tag"
                  value={tag}
                  maxLength={40}
                  placeholder="Adicionar tag…"
                  onChange={(e) => setTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <button
                  className="icon-button"
                  aria-label="Adicionar tag"
                  onClick={addTag}
                >
                  <Plus size={16} />
                </button>
              </div>
            </section>
            <section>
              <div className="section-heading">
                <h3>
                  Anotações <span>{t.notes.length}</span>
                </h3>
                <button
                  className="text-button"
                  disabled={t.notes.length >= 100}
                  onClick={() =>
                    patch({
                      notes: [
                        ...t.notes,
                        {
                          id: crypto.randomUUID(),
                          title: "Nova anotação",
                          body: "",
                        },
                      ],
                    })
                  }
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>
              {t.notes.length === 0 && (
                <p className="empty-hint">
                  Ideias, resumos e aquela explicação que fez sentido.
                </p>
              )}
              {t.notes.map((n) => (
                <article className="note" key={n.id}>
                  <div className="inline">
                    <input
                      aria-label="Título da anotação"
                      maxLength={160}
                      value={n.title}
                      onChange={(e) =>
                        patch({
                          notes: t.notes.map((x) =>
                            x.id === n.id ? { ...x, title: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <button
                      className="icon-button"
                      aria-label="Excluir anotação"
                      onClick={() =>
                        patch({ notes: t.notes.filter((x) => x.id !== n.id) })
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="note-toolbar">
                    <button
                      className="text-button"
                      onClick={() => setPreview(preview === n.id ? null : n.id)}
                    >
                      {preview === n.id ? "Editar" : "Visualizar"}
                    </button>
                    <span>**negrito** · *itálico* · - lista</span>
                  </div>
                  {preview === n.id ? (
                    <div className="markdown">
                      <Markdown>{n.body || "*Ainda sem conteúdo.*"}</Markdown>
                    </div>
                  ) : (
                    <textarea
                      aria-label="Texto da anotação"
                      placeholder="Escreva com Markdown…"
                      maxLength={30000}
                      rows={5}
                      value={n.body}
                      onChange={(e) =>
                        patch({
                          notes: t.notes.map((x) =>
                            x.id === n.id ? { ...x, body: e.target.value } : x,
                          ),
                        })
                      }
                    />
                  )}
                </article>
              ))}
            </section>
            <section>
              <div className="section-heading">
                <h3>
                  Materiais e links <span>{t.links.length}</span>
                </h3>
              </div>
              {t.links.map((l) => (
                <article className="material" key={l.id}>
                  <div className="inline">
                    <Link2 size={16} />
                    <input
                      aria-label="Título do link"
                      placeholder="Título do material"
                      maxLength={160}
                      value={l.title}
                      onChange={(e) =>
                        patch({
                          links: t.links.map((x) =>
                            x.id === l.id ? { ...x, title: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <a
                      href={safeUrl(l.url) ?? undefined}
                      aria-label={`Abrir ${l.title}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ArrowUpRight size={16} />
                    </a>
                    <button
                      className="icon-button"
                      aria-label="Remover link"
                      onClick={() =>
                        patch({ links: t.links.filter((x) => x.id !== l.id) })
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    aria-label="URL do link"
                    value={l.url}
                    type="url"
                    onChange={(e) => {
                      setLinkError("");
                      patch({
                        links: t.links.map((x) =>
                          x.id === l.id ? { ...x, url: e.target.value } : x,
                        ),
                      });
                    }}
                    onBlur={() => {
                      if (!safeUrl(l.url))
                        setLinkError(
                          "Use um endereço completo com https:// ou http://.",
                        );
                    }}
                  />
                </article>
              ))}
              <form
                className="link-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const url = safeUrl(String(f.get("url")));
                  if (!url) {
                    setLinkError("Use uma URL válida com https:// ou http://.");
                    return;
                  }
                  patch({
                    links: [
                      ...t.links,
                      {
                        id: crypto.randomUUID(),
                        title: String(f.get("title")).trim(),
                        url,
                      },
                    ],
                  });
                  e.currentTarget.reset();
                  setLinkError("");
                }}
              >
                <input
                  name="title"
                  aria-label="Título do novo link"
                  placeholder="Título do material"
                  maxLength={160}
                  required
                />
                <div className="inline">
                  <input
                    name="url"
                    type="url"
                    aria-label="URL do novo link"
                    placeholder="https://…"
                    required
                  />
                  <button
                    className="icon-button"
                    aria-label="Adicionar link"
                    disabled={t.links.length >= 100}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </form>
              {linkError && (
                <p role="alert" className="form-error">
                  {linkError}
                </p>
              )}
            </section>
          </>
        ) : tab === "connections" ? (
          <>
            <section>
              <div className="section-heading">
                <h3>
                  Subtópicos <span>{children.length}</span>
                </h3>
                <button className="text-button" onClick={() => add(t.id)}>
                  <Plus size={14} /> Criar
                </button>
              </div>
              {children.map((c) => (
                <button
                  className="connection-item"
                  key={c.id}
                  onClick={() => select(c.id)}
                >
                  <TopicIcon name={c.icon} />
                  <span>{c.title}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
              {!children.length && (
                <p className="empty-hint">
                  Divida este assunto em partes menores.
                </p>
              )}
            </section>
            <section>
              <h3>Relações conceituais</h3>
              <p className="empty-hint">
                Conecte assuntos que ajudam a entender um ao outro.
              </p>
              {related.map((r) => {
                const other = content.topics.find(
                  (x) =>
                    x.id === (r.source_id === t.id ? r.target_id : r.source_id),
                );
                return other ? (
                  <div className="connection-item" key={r.id}>
                    <Link2 size={16} />
                    <button
                      className="connection-name"
                      onClick={() => select(other.id)}
                    >
                      {other.title}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remover relação com ${other.title}`}
                      onClick={() => disconnect(r.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : null;
              })}
              <div className="inline">
                <select
                  aria-label="Tópico para relacionar"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">Escolha um tópico…</option>
                  {content.topics
                    .filter(
                      (x) =>
                        x.id !== t.id &&
                        !related.some(
                          (r) => r.source_id === x.id || r.target_id === x.id,
                        ),
                    )
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.title}
                      </option>
                    ))}
                </select>
                <button
                  className="icon-button"
                  disabled={!target}
                  aria-label="Criar relação"
                  onClick={() => {
                    connect(t.id, target);
                    setTarget("");
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </section>
          </>
        ) : (
          <>
            <section>
              <h3>Cor do tópico</h3>
              <div className="color-options">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    aria-label={`Cor ${c}`}
                    aria-pressed={t.color === c}
                    style={{ background: c }}
                    onClick={() => patch({ color: c })}
                  >
                    {t.color === c && <Check size={15} />}
                  </button>
                ))}
                <input
                  aria-label="Cor personalizada"
                  type="color"
                  value={t.color}
                  onChange={(e) => patch({ color: e.target.value })}
                />
              </div>
            </section>
            <section>
              <h3>Ícone</h3>
              <div className="icon-options">
                {ICONS.map((i) => (
                  <button
                    key={i}
                    className={`icon-button ${t.icon === i ? "chosen" : ""}`}
                    aria-label={`Ícone ${ICON_LABELS[i]}`}
                    aria-pressed={t.icon === i}
                    onClick={() => patch({ icon: i })}
                  >
                    <TopicIcon name={i} />
                  </button>
                ))}
              </div>
            </section>
            <section>
              <label className="field-heading">
                Tópico pai
                <select
                  value={t.parent_id ?? ""}
                  onChange={(e) => patch({ parent_id: e.target.value || null })}
                >
                  <option value="">Sem pai (matéria)</option>
                  {content.topics
                    .filter((x) => canParent(t.id, x.id, content.topics))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {ancestors(x.id, content.topics)
                          .map((a) => a.title)
                          .join(" / ")}
                      </option>
                    ))}
                </select>
              </label>
              <p className="empty-hint">
                Mover um cartão no mapa não altera sua hierarquia.
              </p>
            </section>
            <section>
              <h3>Posição no mapa</h3>
              <div className="position-inputs">
                <label>
                  Horizontal
                  <input
                    type="number"
                    value={Math.round(t.x)}
                    min={-1000000}
                    max={1000000}
                    onChange={(e) => patch({ x: Number(e.target.value) })}
                  />
                </label>
                <label>
                  Vertical
                  <input
                    type="number"
                    value={Math.round(t.y)}
                    min={-1000000}
                    max={1000000}
                    onChange={(e) => patch({ y: Number(e.target.value) })}
                  />
                </label>
              </div>
            </section>
          </>
        )}
      </div>
      <footer className="detail-footer">
        <span className="tiny-dot" /> Cada ideia encontra seu lugar.
      </footer>
    </aside>
  );
}
