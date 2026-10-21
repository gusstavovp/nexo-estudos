import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ancestors,
  canParent,
  deleteBranch,
  descendants,
  matches,
  newTopic,
  relationExists,
  safeUrl,
  suggestions,
  visibleTopics,
} from "../src/lib/graph";
import type { MapContent } from "../src/lib/types";
const root = { ...newTopic("map", []), id: "root", title: "Matemática" };
const algebra = {
  ...newTopic("map", [root], "root"),
  id: "algebra",
  title: "Álgebra",
};
const leaf = {
  ...newTopic("map", [root, algebra], "algebra"),
  id: "leaf",
  title: "Função afim",
  tags: ["velocidade"],
  notes: [{ id: "n", title: "Resumo", body: "Variação linear" }],
  links: [{ id: "l", title: "Aula do professor", url: "https://example.org" }],
};
const physics = {
  ...newTopic("map", []),
  id: "physics",
  title: "Movimento uniforme",
  tags: ["velocidade"],
};
const topics = [root, algebra, leaf, physics];
test("hierarquia profunda preserva contexto e impede pais cíclicos", () => {
  assert.deepEqual(
    ancestors("leaf", topics).map((t) => t.id),
    ["root", "algebra", "leaf"],
  );
  assert.equal(canParent("root", "leaf", topics), false);
  assert.equal(canParent("root", "root", topics), false);
  assert.equal(canParent("leaf", "physics", topics), true);
  assert.equal(canParent("leaf", null, topics), true);
  assert.deepEqual([...descendants("root", topics)], ["algebra", "leaf"]);
});
test("arrastar só altera posição e recolher oculta toda a descendência", () => {
  const moved = topics.map((t) => (t.id === "leaf" ? { ...t, x: 900 } : t));
  assert.equal(moved[2].parent_id, "algebra");
  assert.deepEqual(
    visibleTopics(
      topics.map((t) => (t.id === "root" ? { ...t, collapsed: true } : t)),
    ).map((t) => t.id),
    ["root", "physics"],
  );
});
test("busca ignora acentos e cobre anotações, tags e títulos de links", () => {
  for (const q of ["funcao", "variacao", "velocidade", "professor", "resumo"])
    assert.equal(matches(leaf, q), true);
  assert.equal(matches(leaf, "inexistente"), false);
});
test("sugestões explicam tags e não recriam relações reversas", () => {
  assert.match(
    suggestions(topics, []).find(
      (s) => s.a.id === "leaf" && s.b.id === "physics",
    )!.reason,
    /velocidade/,
  );
  const relation = {
    id: "rel",
    map_id: "map",
    source_id: "physics",
    target_id: "leaf",
  };
  assert.equal(relationExists("leaf", "physics", [relation]), true);
  assert.equal(
    suggestions(topics, [relation]).some(
      (s) => s.a.id === "leaf" && s.b.id === "physics",
    ),
    false,
  );
});
test("exclusão remove descendentes, materiais e relações envolvidas", () => {
  const c: MapContent = {
    topics,
    viewport: null,
    relations: [
      { id: "r", map_id: "map", source_id: "leaf", target_id: "physics" },
    ],
  };
  const next = deleteBranch(c, "root");
  assert.deepEqual(
    next.topics.map((t) => t.id),
    ["physics"],
  );
  assert.equal(next.relations.length, 0);
  assert.equal(c.topics.length, 4);
});
test("links bloqueiam execução e protocolos não permitidos", () => {
  assert.equal(safeUrl("javascript:alert(1)"), null);
  assert.equal(safeUrl("data:text/html,abc"), null);
  assert.equal(safeUrl("/path"), null);
  assert.equal(safeUrl("https://example.org"), "https://example.org/");
});
test("novos tópicos evitam sobreposição em uma mesma coluna", () => {
  const first = newTopic("map", [], null);
  const childA = newTopic("map", [first], first.id);
  const second = newTopic("map", [first, childA], null);
  const childB = newTopic("map", [first, childA, second], second.id);
  assert.equal(childB.parent_id, second.id);
  assert.ok(Math.abs(childB.y - childA.y) >= 195);
});
