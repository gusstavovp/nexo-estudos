// Integração opt-in contra Supabase real: duas contas de teste confirmadas.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { newTopic } from "../src/lib/graph";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
];
for (const key of required)
  if (!process.env[key])
    throw new Error(
      `Configure ${key} no .env.local. Use apenas contas de teste.`,
    );
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const a = createClient(url, key, { auth: { persistSession: false } }),
  b = createClient(url, key, { auth: { persistSession: false } });
let mapId: string | undefined;
try {
  const [sa, sb] = await Promise.all([
    a.auth.signInWithPassword({
      email: process.env.TEST_USER_A_EMAIL!,
      password: process.env.TEST_USER_A_PASSWORD!,
    }),
    b.auth.signInWithPassword({
      email: process.env.TEST_USER_B_EMAIL!,
      password: process.env.TEST_USER_B_PASSWORD!,
    }),
  ]);
  assert.ifError(sa.error);
  assert.ifError(sb.error);
  assert.notEqual(sa.data.user?.id, sb.data.user?.id);
  const map = await a
    .from("study_maps")
    .insert({ title: "Teste automatizado Nexo" })
    .select()
    .single();
  assert.ifError(map.error);
  mapId = map.data!.id;
  const root = newTopic(mapId!, []),
    child = newTopic(mapId!, [root], root.id);
  const payload = {
    topics: [root, child],
    relations: [],
    viewport: { x: 20, y: 30, zoom: 0.9 },
  };
  const saved = await a.rpc("save_study_map", {
    p_map_id: mapId,
    p_expected_revision: 0,
    p_content: payload,
  });
  assert.ifError(saved.error);
  assert.equal(Number(saved.data), 1);
  const loaded = await a.rpc("load_study_map", { p_map_id: mapId });
  assert.ifError(loaded.error);
  assert.equal(loaded.data.topics.length, 2);
  const hidden = await b.from("topics").select("*").eq("map_id", mapId);
  assert.ifError(hidden.error);
  assert.equal(hidden.data?.length, 0);
  const denied = await b.rpc("save_study_map", {
    p_map_id: mapId,
    p_expected_revision: 1,
    p_content: payload,
  });
  assert.ok(denied.error);
  const stale = await a.rpc("save_study_map", {
    p_map_id: mapId,
    p_expected_revision: 0,
    p_content: payload,
  });
  assert.ok(stale.error?.message.includes("CONFLICT"));
  const cycle = await a.rpc("save_study_map", {
    p_map_id: mapId,
    p_expected_revision: 1,
    p_content: {
      ...payload,
      topics: [{ ...root, parent_id: child.id }, child],
    },
  });
  assert.ok(cycle.error);
  console.log(
    "OK: login de duas contas, persistência, RLS, conflito e ciclo no Supabase real.",
  );
} finally {
  if (mapId) {
    const result = await a.from("study_maps").delete().eq("id", mapId);
    if (result.error)
      console.error("Remova manualmente o mapa de teste:", mapId);
  }
  await Promise.all([a.auth.signOut(), b.auth.signOut()]);
}
