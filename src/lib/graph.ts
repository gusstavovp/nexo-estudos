import type { MapContent, Topic, Relation } from "./types";
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
export function descendants(id: string, topics: Topic[]): Set<string> {
  const found = new Set<string>();
  const walk = (parent: string) => {
    for (const t of topics)
      if (t.parent_id === parent && !found.has(t.id)) {
        found.add(t.id);
        walk(t.id);
      }
  };
  walk(id);
  return found;
}
export function ancestors(id: string, topics: Topic[]): Topic[] {
  const path: Topic[] = [];
  const seen = new Set<string>();
  let current = topics.find((t) => t.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = topics.find((t) => t.id === current?.parent_id);
  }
  return path;
}
export function canParent(id: string, parent: string | null, topics: Topic[]) {
  return (
    parent === null ||
    (parent !== id &&
      topics.some((t) => t.id === parent) &&
      !descendants(id, topics).has(parent))
  );
}
export function visibleTopics(topics: Topic[]) {
  return topics.filter(
    (t) =>
      !ancestors(t.id, topics)
        .slice(0, -1)
        .some((a) => a.collapsed),
  );
}
export function matches(t: Topic, query: string) {
  return normalize(
    [
      t.title,
      t.description,
      ...t.tags,
      ...t.notes.flatMap((n) => [n.title, n.body]),
      ...t.links.map((l) => l.title),
    ].join(" "),
  ).includes(normalize(query.trim()));
}
export function safeUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
export function relationExists(a: string, b: string, relations: Relation[]) {
  return relations.some(
    (r) =>
      (r.source_id === a && r.target_id === b) ||
      (r.source_id === b && r.target_id === a),
  );
}
export function suggestions(topics: Topic[], relations: Relation[]) {
  const result: { a: Topic; b: Topic; reason: string; score: number }[] = [];
  const words = (s: string) =>
    normalize(s)
      .split(/\W+/)
      .filter((w) => w.length > 3);
  for (let i = 0; i < topics.length; i++)
    for (let j = i + 1; j < topics.length; j++) {
      const a = topics[i],
        b = topics[j];
      if (
        a.parent_id === b.id ||
        b.parent_id === a.id ||
        relationExists(a.id, b.id, relations)
      )
        continue;
      const shared = a.tags.filter((t) =>
        b.tags.some((bt) => normalize(bt) === normalize(t)),
      );
      const overlap = words(a.title).filter((w) => words(b.title).includes(w));
      if (shared.length || overlap.length)
        result.push({
          a,
          b,
          score: shared.length * 2 + overlap.length,
          reason: shared.length
            ? `Tag em comum: ${shared.join(", ")}`
            : `Termo em comum no título: ${overlap.join(", ")}`,
        });
    }
  return result.sort((a, b) => b.score - a.score).slice(0, 6);
}
export function newTopic(
  mapId: string,
  topics: Topic[],
  parentId: string | null = null,
): Topic {
  const p = topics.find((t) => t.id === parentId);
  const siblings = topics.filter((t) => t.parent_id === parentId).length;
  const x = p ? p.x + 320 : 80;
  let y = p ? p.y + siblings * 200 : 100 + siblings * 220;
  while (topics.some((t) => Math.abs(t.x - x) < 270 && Math.abs(t.y - y) < 195))
    y += 210;
  return {
    id: crypto.randomUUID(),
    map_id: mapId,
    parent_id: parentId,
    title: parentId ? "Novo assunto" : "Nova matéria",
    description: "",
    color:
      p?.color ?? ["#5b8a68", "#648bc0", "#bc8b46", "#ad7596"][siblings % 4],
    icon: p?.icon ?? "book",
    status: "not_started",
    tags: [],
    notes: [],
    links: [],
    x,
    y,
    collapsed: false,
  };
}
export function deleteBranch(content: MapContent, id: string): MapContent {
  const removed = descendants(id, content.topics);
  removed.add(id);
  return {
    ...content,
    topics: content.topics.filter((t) => !removed.has(t.id)),
    relations: content.relations.filter(
      (r) => !removed.has(r.source_id) && !removed.has(r.target_id),
    ),
  };
}
