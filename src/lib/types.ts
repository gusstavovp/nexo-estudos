export type StudyStatus = "not_started" | "studying" | "reviewed";
export type MaterialLink = { id: string; title: string; url: string };
export type Note = { id: string; title: string; body: string };
export type Topic = {
  id: string;
  map_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  color: string;
  icon: string;
  status: StudyStatus;
  tags: string[];
  notes: Note[];
  links: MaterialLink[];
  x: number;
  y: number;
  collapsed: boolean;
};
export type Relation = {
  id: string;
  map_id: string;
  source_id: string;
  target_id: string;
};
export type Viewport = { x: number; y: number; zoom: number };
export type StudyMap = {
  id: string;
  user_id: string;
  title: string;
  revision: number;
  viewport: Viewport | null;
  created_at: string;
};
export type MapContent = {
  topics: Topic[];
  relations: Relation[];
  viewport: Viewport | null;
};
export const STATUS: Record<StudyStatus, string> = {
  not_started: "Não iniciado",
  studying: "Estudando",
  reviewed: "Revisado",
};
export const COLORS = [
  "#5b8a68",
  "#648bc0",
  "#bc8b46",
  "#ad7596",
  "#7d75b6",
  "#4f9694",
];
export const ICONS = [
  "book",
  "math",
  "atom",
  "flask",
  "globe",
  "pen",
  "leaf",
  "code",
];
export const ICON_LABELS: Record<string, string> = {
  book: "livro",
  math: "matemática",
  atom: "átomo",
  flask: "química",
  globe: "globo",
  pen: "escrita",
  leaf: "natureza",
  code: "programação",
};
