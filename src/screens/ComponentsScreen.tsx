// Living component gallery: every reusable piece and its variants, rendered from real code.
import { useMemo, useState, type ReactNode } from "react";
import { useStore } from "../store/useStore";
import { Button, Kbd, Segmented, SourceChip } from "../components/ui";
import { BranchCard } from "../components/tree/BranchCard";
import { SelectionToolbar } from "../components/reader/SelectionToolbar";
import { ThreadLayer } from "../components/reader/ThreadLayer";
import { TreeSilhouette } from "../components/TreeSilhouette";

const noop = () => {};
function Spec({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <section className="spec"><div className="spec-head"><h2 className="serif">{title}</h2>{note && <p className="muted small">{note}</p>}</div><div className="spec-body">{children}</div></section>;
}

export function ComponentsScreen() {
  const nodesMap = useStore((s) => s.nodes);
  const nodes = useMemo(() => Object.values(nodesMap), [nodesMap]);
  const [seg, setSeg] = useState<"cards" | "map">("cards");
  const pick = (k: string) => nodes.find((n) => n.kind === k && n.parentId);
  const examples = ["source", "note", "definition", "explanation", "clipping"].map(pick).filter(Boolean);
  const payments = nodes.filter((n) => n.treeId === "tr-payments");
  return (
    <div className="workspace">
      <header className="ws-bar"><h1 className="serif ws-title">Components</h1><span className="muted small">Rendered from the real code. See docs/DESIGN_SYSTEM.md.</span></header>
      <div className="ws-scroll"><div className="ws-inner gallery">
        <Spec title="Buttons"><Button variant="primary">New tree</Button><Button>Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Delete</Button><Button size="sm" variant="primary">Small</Button></Spec>
        <Spec title="Segmented control"><Segmented label="View" value={seg} onChange={setSeg} options={[{ value: "cards", label: "Cards" }, { value: "map", label: "Map" }]} /><Kbd>⌘K</Kbd></Spec>
        <Spec title="Source chip"><SourceChip source={{ url: "https://en.wikipedia.org/wiki/Chargeback", site: "Wikipedia", title: "Chargeback" }} /><SourceChip source={{}} /></Spec>
        <Spec title="Selection toolbar" note="Shown above any selection. Keys: H N D B E A. ✦ actions call Claude."><div className="spec-stage" style={{ height: 70 }}><SelectionToolbar x={330} y={10} onAction={noop} /></div></Spec>
        <Spec title="Thread" note="Rest, hover and dragging. The handle is a 12px accent dot."><div className="spec-stage" style={{ height: 120 }}>
          <ThreadLayer threads={[{ key: "a", annId: "a", x1: 20, y1: 30, x2: 260, y2: 70 }, { key: "b", annId: "b", x1: 20, y1: 80, x2: 260, y2: 100 }]} hotId="b" drag={{ x1: 320, y1: 30, x2: 560, y2: 90 }} />
          <span className="thread-handle show" style={{ position: "absolute", left: 600, top: 40 }} />
        </div></Spec>
        <Spec title="Tree silhouette"><div className="spec-sil"><TreeSilhouette nodes={payments} seedId="n-stripe" /></div></Spec>
        <Spec title="Branch cards" note="Source, note, definition, Claude explanation, clipping.">
          <div className="spec-cards">{examples.map((n) => <div key={n!.id}><BranchCard node={n!} inline editing={false} focused={false} hot={false} childCount={0} onOpen={noop} onHover={noop} onEdit={noop} onDone={noop} onAsk={noop} onThreadStart={noop} onJump={noop} onResize={noop} /></div>)}</div>
        </Spec>
      </div></div>
    </div>
  );
}
