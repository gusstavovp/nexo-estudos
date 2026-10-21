"use client";
import { memo, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeProps,
  type Edge,
} from "@xyflow/react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Link2,
  Plus,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import {
  STATUS,
  type MapContent,
  type Topic,
  type Viewport,
} from "@/lib/types";
import { visibleTopics } from "@/lib/graph";
import TopicIcon from "./icon";
type TopicData = {
  topic: Topic;
  childCount: number;
  toggle: (id: string) => void;
  add: (id: string) => void;
};
const TopicNode = memo(function TopicNode({
  data,
  selected,
}: NodeProps<Node<TopicData>>) {
  const t = data.topic;
  return (
    <div
      className={`topic-node ${selected ? "is-selected" : ""}`}
      style={{ "--topic-color": t.color } as React.CSSProperties}
    >
      <Handle
        type="target"
        position={Position.Left}
        aria-label="Receber relação"
      />
      <div className="node-heading">
        <span className="node-icon">
          <TopicIcon name={t.icon} size={19} />
        </span>
        <span className="node-kind">{t.parent_id ? "ASSUNTO" : "MATÉRIA"}</span>
        <button
          className="nodrag node-add"
          aria-label={`Adicionar subtópico em ${t.title}`}
          onClick={(e) => {
            e.stopPropagation();
            data.add(t.id);
          }}
        >
          <Plus size={15} />
        </button>
      </div>
      <h3>{t.title}</h3>
      {t.description && <p>{t.description}</p>}
      <div className="node-footer">
        <span className={`study-badge ${t.status}`}>
          <i />
          {STATUS[t.status]}
        </span>
        <div className="inline">
          {t.notes.length > 0 && (
            <span title="Anotações">
              <FileText size={12} />
              {t.notes.length}
            </span>
          )}
          {t.links.length > 0 && (
            <span title="Links">
              <Link2 size={12} />
              {t.links.length}
            </span>
          )}
        </div>
      </div>
      {data.childCount > 0 && (
        <button
          className="nodrag branch-toggle"
          aria-label={`${t.collapsed ? "Expandir" : "Recolher"} ${t.title}`}
          onClick={(e) => {
            e.stopPropagation();
            data.toggle(t.id);
          }}
        >
          {t.collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          {data.childCount} subtópico{data.childCount > 1 ? "s" : ""}
        </button>
      )}
      <Handle
        type="source"
        position={Position.Right}
        aria-label="Criar relação"
      />
    </div>
  );
});
const nodeTypes = { topic: TopicNode };
type Props = {
  content: MapContent;
  selected: string | null;
  select: (id: string) => void;
  patch: (id: string, patch: Partial<Topic>) => void;
  add: (parent?: string) => void;
  connect: (a: string, b: string) => void;
  viewport: (v: Viewport) => void;
  focus: { id: string; nonce: number } | null;
  matchIds: Set<string> | null;
  fitToken: number;
  dark: boolean;
};
function Canvas(props: Props) {
  const {
    content,
    selected,
    select,
    patch,
    add,
    connect,
    viewport,
    focus,
    matchIds,
    fitToken,
    dark,
  } = props;
  const flow = useReactFlow();
  const visible = useMemo(
    () => visibleTopics(content.topics),
    [content.topics],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TopicData>>([]);
  useEffect(() => {
    setNodes((previous) =>
      visible.map((t) => ({
        id: t.id,
        type: "topic",
        position: previous.find((n) => n.id === t.id)?.dragging
          ? previous.find((n) => n.id === t.id)!.position
          : { x: t.x, y: t.y },
        dragging: previous.find((n) => n.id === t.id)?.dragging,
        selected: selected === t.id,
        style: { opacity: !matchIds || matchIds.has(t.id) ? 1 : 0.25 },
        data: {
          topic: t,
          childCount: content.topics.filter((c) => c.parent_id === t.id).length,
          toggle: (id: string) =>
            patch(id, {
              collapsed: !content.topics.find((x) => x.id === id)?.collapsed,
            }),
          add,
        },
      })),
    );
  }, [visible, selected, matchIds, content.topics, patch, add, setNodes]);
  useEffect(() => {
    if (focus) {
      const timer = setTimeout(
        () =>
          void flow.fitView({
            nodes: [{ id: focus.id }],
            duration: 350,
            maxZoom: 1.15,
            padding: 0.5,
          }),
        60,
      );
      return () => clearTimeout(timer);
    }
  }, [focus, flow]);
  useEffect(() => {
    if (fitToken) void flow.fitView({ duration: 350, padding: 0.2 });
  }, [fitToken, flow]);
  const edges: Edge[] = useMemo(() => {
    const ids = new Set(visible.map((t) => t.id));
    return [
      ...visible
        .filter((t) => t.parent_id && ids.has(t.parent_id))
        .map((t) => ({
          id: `parent-${t.id}`,
          source: t.parent_id!,
          target: t.id,
          type: "smoothstep",
          style: { stroke: t.color, strokeWidth: 1.7, opacity: 0.65 },
          selectable: false,
        })),
      ...content.relations
        .filter((r) => ids.has(r.source_id) && ids.has(r.target_id))
        .map((r) => ({
          id: r.id,
          source: r.source_id,
          target: r.target_id,
          type: "default",
          label: "relação",
          className: "concept-edge",
          style: {
            stroke: "#ac8b55",
            strokeWidth: 1.7,
            strokeDasharray: "6 5",
          },
          labelStyle: { fill: "#8c7047", fontSize: 10 },
          labelBgStyle: { fill: dark ? "#222823" : "#faf9f5" },
          selectable: false,
        })),
    ];
  }, [visible, content.relations, dark]);
  return (
    <div className="canvas-shell">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes) => {
          onNodesChange(changes);
          for (const c of changes)
            if (c.type === "position" && c.position && c.dragging === false)
              patch(c.id, { x: c.position.x, y: c.position.y });
        }}
        onNodeClick={(_, n) => select(n.id)}
        onNodeDragStop={(_, n) =>
          patch(n.id, { x: n.position.x, y: n.position.y })
        }
        onConnect={(c) => connect(c.source, c.target)}
        defaultViewport={content.viewport ?? undefined}
        fitView={!content.viewport}
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.12}
        maxZoom={2}
        onMoveEnd={(_, v) => viewport(v)}
        deleteKeyCode={null}
        colorMode={dark ? "dark" : "light"}
        aria-label="Mapa visual de estudos"
        ariaLabelConfig={{
          "node.a11yDescription.default":
            "Pressione Enter ou espaço para selecionar. Edite a posição pelo painel Ajustes.",
          "node.a11yDescription.keyboardDisabled":
            "Pressione Enter ou espaço para selecionar este tópico.",
          "node.a11yDescription.ariaLiveMessage": ({ x, y }) =>
            `Posição do tópico: horizontal ${x}, vertical ${y}.`,
          "edge.a11yDescription.default":
            "Conexão entre tópicos. Gerencie relações pelo painel Conexões.",
          "controls.ariaLabel": "Controles do mapa",
          "controls.zoomIn.ariaLabel": "Aproximar",
          "controls.zoomOut.ariaLabel": "Afastar",
          "controls.fitView.ariaLabel": "Enquadrar todo o mapa",
          "controls.interactive.ariaLabel": "Alternar interação",
          "minimap.ariaLabel": "Visão geral do mapa",
          "handle.ariaLabel": "Ponto de conexão",
        }}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color={dark ? "#3d483f" : "#d5dcd3"}
        />
        <Controls
          showInteractive={false}
          position="bottom-left"
          aria-label="Controles do mapa"
        />
        <MiniMap
          position="bottom-right"
          nodeColor={(n) => (n.data as TopicData).topic.color}
          maskColor={dark ? "#1d241d99" : "#eef1eb88"}
          pannable
          zoomable
          aria-label="Visão geral do mapa"
        />
      </ReactFlow>
      {!content.topics.length && (
        <div className="canvas-empty">
          <div className="empty-illustration">
            <BookOpen size={33} strokeWidth={1.4} />
            <span />
            <span />
          </div>
          <span className="eyebrow">GRANDES IDEIAS COMEÇAM PEQUENAS</span>
          <h2>O que vamos aprender?</h2>
          <p>
            Adicione sua primeira matéria.
            <br />
            Depois, deixe as conexões acontecerem.
          </p>
          <button className="primary" onClick={() => add()}>
            <Plus size={17} /> Criar primeira matéria
          </button>
        </div>
      )}
      <div className="canvas-legend">
        <span>
          <i className="hierarchy-line" />
          Hierarquia
        </span>
        <span>
          <i className="relation-line" />
          Relação conceitual
        </span>
      </div>
      <div className="canvas-instruction">
        Arraste para organizar · Conecte pelas laterais dos cartões
      </div>
    </div>
  );
}
export default function StudyCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
