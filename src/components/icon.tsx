import {
  Atom,
  BookOpen,
  Calculator,
  Code2,
  FlaskConical,
  Globe2,
  Leaf,
  PenLine,
} from "lucide-react";
const icons = {
  book: BookOpen,
  math: Calculator,
  atom: Atom,
  flask: FlaskConical,
  globe: Globe2,
  pen: PenLine,
  leaf: Leaf,
  code: Code2,
};
export default function TopicIcon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name as keyof typeof icons] ?? BookOpen;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
