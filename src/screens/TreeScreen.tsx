// A tree: the trail as sliding cards (Read), the whole tree (Map), or everything you wrote (Notebook). Writing and Ask Claude open as drawers.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Lock, Maximize2, MessageCircle, Minimize2, PenLine, Plus, Sparkles } from "lucide-react";
import type { Anchor, TreeNode } from "../data/types";
import { useStore, useTree } from "../store/useStore";
import { CardStack } from "../components/tree/CardStack";
import { TreeMap } from "../components/tree/TreeMap";
import { AskDrawer, UnderstandingDrawer } from "../components/tree/Drawers";
import { TopicChips } from "../components/tree/TopicChips";
import { TrailsMenu, useTrailLabel } from "../components/tree/TrailsMenu";
import { TreeMenu } from "../components/tree/TreeMenu";
import { CoachMarks } from "../components/CoachMarks";
import { BranchPopup } from "../components/tree/BranchPopup";
import { ReaderPopup } from "../components/tree/ReaderPopup";
import { NotebookView } from "../components/tree/NotebookView";
import { AddDialog } from "../components/tree/AddDialog";
import { toast } from "../lib/toast";
import { EmptyState, IconButton, Segmented } from "../components/ui";
import { plural } from "../lib/util";
import { useMedia } from "../lib/hooks";

export function TreeScreen() {
  const { treeId } = useParams();
  const tree = useTree(treeId);
  const nodes = useStore((s) => s.nodes);
  const ui = useStore((s) => s.ui);
  const { setUI, updateTree, recordTrail, addBranch } = useStore.getState();
  const [params, setParams] = useSearchParams();
  const label = useTrailLabel();
  const compact = useMedia("(max-width: 760px)");

  const [adding, setAdding] = useState(false);
  const rawView = params.get("view");
  const view: "cards" | "map" | "notebook" = rawView === "map" || rawView === "notebook" ? rawView : "cards";
  const path = useMemo(() => {
    if (!tree) return [];
    const raw = (params.get("path") || "").split(",").filter((id) => nodes[id]?.treeId === tree.id);
    // A valid path starts at the seed and each card is a child of the one before.
    const ok = raw.length && raw[0] === tree.seedId && raw.every((id, i) => i === 0 || nodes[id].parentId === raw[i - 1]);
    return ok ? raw : [tree.seedId];
  }, [params, nodes, tree]);
  const count = useMemo(() => Object.values(nodes).filter((n) => n.treeId === tree?.id).length, [nodes, tree?.id]);

  useEffect(() => { if (tree) updateTree(tree.id, { lastOpenedAt: Date.now() }); }, [tree?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!tree || path.length < 2) return;
    const t = setTimeout(() => recordTrail(tree.id, path), 500);
    return () => clearTimeout(t);
  }, [path.join(","), tree?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // A card asked to open a passage (a quotation's source link on the page): open its trail and scroll to it.
  useEffect(() => {
    const g = ui.goPassage;
    if (!g) return;
    setUI({ goPassage: null });
    const all = useStore.getState().nodes;
    if (!all[g.nodeId]) { toast("That passage's branch was deleted."); return; }
    const chain: string[] = [];
    for (let n: TreeNode | undefined = all[g.nodeId]; n; n = n.parentId ? all[n.parentId] : undefined) chain.unshift(n.id);
    setUI({ jumpTo: { nodeId: g.nodeId, blockId: g.blockId } });
    setParams({ path: chain.join(",") });
  }, [ui.goPassage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tree) return <div className="screen-pad"><EmptyState title="Tree not found" body="It may have been deleted." action={<Link className="btn btn-primary" to="/">Your trees</Link>} /></div>;

  const go = (p: string[], v: "cards" | "map" | "notebook" = "cards") => setParams(v === "cards" ? { path: p.join(",") } : { path: p.join(","), view: v });
  const last = tree.trails[0];
  const showResume = view === "cards" && path.length === 1 && last && last.nodeIds.length > 1 && last.nodeIds.every((id) => nodes[id]);
  /** The trail from the seed to a node, so it can be opened as the last card. */
  const trailTo = (id: string) => {
    const chain: string[] = [];
    // Read the store directly: a branch made a moment ago isn't in this render's nodes yet.
    const all = useStore.getState().nodes;
    let n: TreeNode | undefined = all[id];
    while (n) { chain.unshift(n.id); n = n.parentId ? all[n.parentId] : undefined; }
    return chain;
  };
  const popupNode = ui.popup ? nodes[ui.popup] : undefined;
  const closePopup = () => {
    // A note or summary closed without a word in it isn't kept.
    const n = ui.popup ? useStore.getState().nodes[ui.popup] : undefined;
    if (n && n.kind === "note" && !n.body?.trim() && !Object.values(useStore.getState().nodes).some((c) => c.parentId === n.id)) useStore.getState().removeNode(n.id);
    setUI({ popup: null });
  };
  /** Open the card holding a passage and scroll to it (from a link in your writing, or the notebook). */
  const openPassage = (nodeId: string, blockId: string) => {
    if (!useStore.getState().nodes[nodeId]) { toast("That passage's branch was deleted."); return; }
    setUI({ jumpTo: { nodeId, blockId } });
    go(trailTo(nodeId));
  };
  /** Something added straight to the seed waits in its margin. A source opens there with its article showing, beside the seed you write on. */
  /** Open Add, remembering how far down the seed you are, so what you add appears beside what you're reading. */
  const [addAt, setAddAt] = useState<number | undefined>();
  const startAdding = () => {
    const box = document.querySelector(`[data-testid="card"][data-node="${tree.seedId}"] .card-scroll`) as HTMLElement | null;
    const z = useStore.getState().ui.readZoom ?? 1;
    setAddAt(box ? Math.round(box.scrollTop / z + 120) : undefined);
    setAdding(true);
  };
  const added = (id: string) => {
    setAdding(false);
    const n = useStore.getState().nodes[id];
    setUI({ branchesOpen: true, ...(n?.kind === "source" ? { readingBeside: id } : {}) });
    go([tree.seedId]);
  };
  const pin = (a: Anchor, text: string) => {
    const parent = nodes[a.docId];
    if (!parent) return;
    addBranch(tree.id, { kind: "explanation", title: a.quote.slice(0, 60), parentId: parent.id, anchors: [a], body: text, depth: "both" });
  };

  return (
    <div className={`tree-screen${ui.focus ? " focus" : ""}${ui.drawer ? " with-drawer" : ""}`}>
      <header className="tree-head">
        {ui.focus && <IconButton label="Exit focus" onClick={() => setUI({ focus: false })}><Minimize2 size={16} /></IconButton>}
        <div className="th-title">
          <input className="tree-title serif" value={tree.title} readOnly={tree.locked} onChange={(e) => updateTree(tree.id, { title: e.target.value })} aria-label="Tree title" />
          <div className="th-meta"><span className="muted small">{plural(count, "branch", "branches")}</span>{tree.locked && <span className="chip static locked-chip"><Lock size={11} aria-hidden />Locked</span>}<TopicChips tree={tree} /></div>
        </div>
        <div className="th-actions">
          <Segmented label="View" value={view} onChange={(v) => go(path, v)} options={[{ value: "cards", label: "Read" }, { value: "map", label: "Map" }, { value: "notebook", label: "Notebook" }]} />
          {!tree.locked && <button className="btn btn-ghost btn-sm" data-testid="add-to-tree" onClick={startAdding} title="Add a paper, article, excerpt or definition to the seed"><Plus size={14} /><span>Add</span></button>}
          {!compact && <TrailsMenu tree={tree} onOpen={(ids) => go(ids)} />}
          <button className={`btn btn-ghost btn-sm${ui.drawer === "understanding" ? " on" : ""}`} data-coach="understanding" aria-label="Writing" onClick={() => setUI({ drawer: ui.drawer === "understanding" ? null : "understanding" })}><PenLine size={14} /><span>Writing</span></button>
          <button className={`btn btn-ghost btn-sm${ui.drawer === "ask" ? " on" : ""}`} onClick={() => setUI({ drawer: ui.drawer === "ask" ? null : "ask" })} title="Ask Claude about this trail"><Sparkles size={14} /><span>Ask</span></button>
          <TreeMenu tree={tree} branchCount={count - 1} />
          {!compact && <IconButton label={ui.focus ? "Exit focus" : "Focus"} onClick={() => setUI({ focus: !ui.focus, drawer: null })}>{ui.focus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</IconButton>}
        </div>
      </header>

      {view === "cards" && path.length > 1 && (
        <nav className="trail-bar" aria-label="Trail">
          {label(path).map((t, i) => (
            <span key={path[i]} className="trail-step">
              {i > 0 && <span className="muted">›</span>}
              <button className={i === path.length - 1 ? "on" : ""} onClick={() => go(path.slice(0, i + 1))}>{t}</button>
            </span>
          ))}
        </nav>
      )}
      {showResume && (
        <button className="resume-pill" data-testid="resume" onClick={() => go(last.nodeIds)}>
          <MessageCircle size={13} />Resume: <span className="serif">{label(last.nodeIds).slice(1).join(" › ")}</span>
        </button>
      )}

      <div className={`tree-body${ui.reader && ui.reader.treeId === tree.id && view === "cards" ? " with-reader" : ""}`}>
        {view === "map" ? <TreeMap tree={tree} path={path} onOpenPath={(p) => go(p)} />
          : view === "notebook" ? <NotebookView tree={tree} onOpenPassage={openPassage} onOpenWriting={() => setUI({ drawer: "understanding", focus: false })} />
          : <CardStack tree={tree} path={path} onPath={(p) => go(p)} zoom={ui.readZoom ?? 1} onZoom={(z) => setUI({ readZoom: z })} />}
        {ui.drawer === "understanding" && <UnderstandingDrawer tree={tree} onClose={() => setUI({ drawer: null })} onOpenPassage={openPassage} />}
        {ui.reader && ui.reader.treeId === tree.id && (
          <ReaderPopup {...ui.reader} locked={!!tree.locked} onClose={() => setUI({ reader: null })} onKept={(id) => { setUI({ reader: null }); go(trailTo(id)); }} onOpenCard={(id) => { setUI({ reader: null }); go(trailTo(id)); }} />
        )}
        {popupNode && popupNode.treeId === tree.id && (
          <BranchPopup node={popupNode} locked={!!tree.locked} childCount={Object.values(nodes).filter((n) => n.parentId === popupNode.id).length}
            onClose={closePopup} onOpenAsCard={() => { setUI({ popup: null }); go(trailTo(popupNode.id)); }} />
        )}
        {ui.drawer === "ask" && <AskDrawer tree={tree} path={path} onClose={() => setUI({ drawer: null })} onPin={tree.locked ? undefined : pin} />}
      </div>
      {!compact && view === "cards" && <CoachMarks />}
      {adding && <AddDialog mode="branch" anchor={null} treeId={tree.id} parentId={tree.seedId} marginY={addAt} onClose={() => setAdding(false)} onCreated={added} />}
    </div>
  );
}
