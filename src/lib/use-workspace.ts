"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import type { MapContent, StudyMap } from "./types";

const empty = (): MapContent => ({ topics: [], relations: [], viewport: null });
export type SaveState = "saved" | "pending" | "saving" | "error";
export function useWorkspace(userId: string) {
  const [maps, setMaps] = useState<StudyMap[]>([]);
  const [active, setActive] = useState<StudyMap | null>(null);
  const [content, setContent] = useState<MapContent>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const current = useRef({
    active: null as StudyMap | null,
    content: empty(),
    version: 0,
    saved: 0,
  });
  const flight = useRef<Promise<boolean> | null>(null);
  const paused = useRef(false);
  const navigating = useRef(false);

  const save = useCallback(async function persist(): Promise<boolean> {
    if (flight.current) {
      const ok = await flight.current;
      return ok ? persist() : false;
    }
    const c = current.current;
    if (!c.active || c.version === c.saved) return true;
    const map = c.active,
      snapshot = c.content,
      version = c.version;
    setSaveState("saving");
    flight.current = (async () => {
      try {
        const { data, error } = await getSupabase()!.rpc("save_study_map", {
          p_map_id: map.id,
          p_expected_revision: map.revision,
          p_content: snapshot,
        });
        if (error) throw error;
        c.active = { ...map, revision: Number(data) };
        c.saved = version;
        setActive(c.active);
        setMaps((ms) => ms.map((m) => (m.id === map.id ? c.active! : m)));
        setSaveState(c.version === version ? "saved" : "pending");
        setError("");
        paused.current = false;
        return true;
      } catch (e) {
        paused.current = true;
        setSaveState("error");
        setError(message(e));
        return false;
      } finally {
        flight.current = null;
      }
    })();
    const ok = await flight.current;
    return ok && c.version !== c.saved ? persist() : ok;
  }, []);

  const change = useCallback((fn: (c: MapContent) => MapContent) => {
    if (navigating.current) return;
    const c = current.current;
    const next = fn(c.content);
    if (next === c.content) return;
    c.content = next;
    c.version++;
    setContent(c.content);
    if (!paused.current) setSaveState("pending");
  }, []);

  useEffect(() => {
    if (saveState !== "pending" || paused.current) return;
    const timer = setTimeout(() => void save(), 750);
    return () => clearTimeout(timer);
  }, [content, saveState, save]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (current.current.version !== current.current.saved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);

  const openMap = useCallback(
    async (map: StudyMap) => {
      if (navigating.current) return false;
      navigating.current = true;
      setLoading(true);
      try {
        if (!(await save())) return false;
        setError("");
        const db = getSupabase()!;
        const { data, error } = await db.rpc("load_study_map", {
          p_map_id: map.id,
        });
        if (error) throw error;
        if (!data)
          throw new Error("Mapa indisponível ou sem permissão de acesso.");
        const next = {
          topics: data.topics,
          relations: data.relations,
          viewport: data.map.viewport,
        } as MapContent;
        current.current = {
          active: data.map,
          content: next,
          version: 0,
          saved: 0,
        };
        setActive(data.map);
        setContent(next);
        setSaveState("saved");
        paused.current = false;
        return true;
      } catch (e) {
        setError(message(e));
        return false;
      } finally {
        navigating.current = false;
        setLoading(false);
      }
    },
    [save],
  );

  const loadMaps = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error } = await getSupabase()!
        .from("study_maps")
        .select("*")
        .order("created_at");
      if (error) throw error;
      setMaps(data ?? []);
      if (data?.length) await openMap(data[0]);
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, [openMap]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void loadMaps();
    });
    return () => {
      cancelled = true;
    };
  }, [userId, loadMaps]);

  const createMap = async (title: string) => {
    if (!title.trim()) {
      setError("Dê um nome ao seu mapa antes de continuar.");
      return false;
    }
    if (!(await save())) return false;
    const { data, error } = await getSupabase()!
      .from("study_maps")
      .insert({ title: title.trim(), user_id: userId })
      .select()
      .single();
    if (error) {
      setError(message(error));
      return false;
    }
    setMaps((ms) => [...ms, data]);
    return openMap(data);
  };
  const retry = () => {
    paused.current = false;
    setError("");
    if (current.current.version !== current.current.saved) void save();
    else if (active) void openMap(active);
    else void loadMaps();
  };
  return {
    maps,
    active,
    content,
    change,
    loading,
    error,
    saveState,
    openMap,
    createMap,
    save,
    retry,
  };
}
export function message(e: unknown) {
  const raw =
    e && typeof e === "object" && "message" in e
      ? String(e.message)
      : String(e);
  if (raw.includes("CONFLICT"))
    return "Este mapa mudou em outra janela. Exporte seu rascunho antes de recarregar para abrir a versão mais recente.";
  if (raw.includes("Failed to fetch") || raw.includes("fetch failed"))
    return "Sem conexão com o banco. Suas alterações ainda não foram salvas. Verifique a internet e tente novamente.";
  if (raw.includes("schema cache") || raw.includes("does not exist"))
    return "O banco ainda não está configurado. Execute a migração SQL conforme o README.";
  if (raw.includes("row-level security") || raw.includes("permission denied"))
    return "Sua sessão expirou ou este mapa não está disponível para sua conta. Entre novamente.";
  if (raw.includes("duplicate key"))
    return "Essa relação já existe. Remova a duplicata antes de tentar salvar novamente.";
  if (raw.includes("violates check constraint"))
    return "Confira os campos: cada tópico precisa de um título e os materiais devem respeitar os limites do mapa.";
  return `Não foi possível concluir: ${raw}`;
}
