// Your trees: everything you're exploring, most recent first.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Plus, Trash2 } from "lucide-react";
import type { Tree } from "../data/types";
import { useStore } from "../store/useStore";
import { AddDialog } from "../components/tree/AddDialog";
import { TreeSilhouette } from "../components/TreeSilhouette";
import { EmptyState } from "../components/ui";
import { plural, timeAgo } from "../lib/util";
import { contentOf } from "../lib/content";

export function HomeScreen() {
  const trees = useStore((s) => s.trees);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const sorted = useMemo(() => [...trees].sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt)), [trees]);
  return (
    <div className="workspace">
      <header className="ws-bar">
        <h1 className="serif ws-title">Your trees</h1>
        <span className="muted small">{plural(trees.length, "tree")}</span>
        <span className="flex1" />
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} />New tree</button>
      </header>
      <div className="ws-scroll">
        <div className="ws-inner">
          {trees.length === 0 ? (
            <EmptyState title="Start with something you're curious about" body="An article, a PDF, a book, or just an idea you write down. Everything you follow from it grows into a tree." action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={14} />New tree</button>} />
          ) : (
            <div className="tree-grid">
              {sorted.map((t) => <TreeCard key={t.id} tree={t} />)}
              <button className="tree-card new" onClick={() => setAdding(true)}><Plus size={22} /><span className="serif">Start a new tree</span><span className="muted small">From an idea, a web page, a file or some text</span></button>
            </div>
          )}
        </div>
      </div>
      {adding && <AddDialog mode="tree" onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); navigate(`/tree/${id}`); }} />}
    </div>
  );
}

function TreeCard({ tree }: { tree: Tree }) {
  const nodesMap = useStore((s) => s.nodes);
  const docs = useStore((s) => s.docs);
  const topics = useStore((s) => s.topics);
  const { deleteTree } = useStore.getState();
  const [armed, setArmed] = useState(false);
  const nodes = useMemo(() => Object.values(nodesMap).filter((n) => n.treeId === tree.id), [nodesMap, tree.id]);
  const seed = nodesMap[tree.seedId];
  const sources = nodes.filter((n) => n.kind === "source").length;
  const last = tree.trails[0];
  const lastTitle = last ? nodesMap[last.nodeIds[last.nodeIds.length - 1]] : undefined;
  return (
    <article className="tree-card" data-testid="tree-card">
      <Link to={`/tree/${tree.id}`} className="tree-card-link" aria-label={`Open ${tree.title}`}>
        <div className="tc-shape"><TreeSilhouette nodes={nodes} seedId={tree.seedId} /></div>
        <div className="tc-body">
          <h2 className="serif">{tree.title}</h2>
          {seed && <p className="muted small tc-seed">From {seed.kind === "note" ? "your idea" : `“${contentOf(seed, docs).title}”`}</p>}
          <div className="tc-topics">{tree.topicIds.map((id) => topics.find((t) => t.id === id)).filter(Boolean).map((t) => <span key={t!.id} className="chip topic static">{t!.name}</span>)}</div>
          <p className="muted small tabular">{tree.locked && <><Lock size={11} aria-label="Locked" /> </>}{plural(nodes.length, "branch", "branches")} · {plural(sources, "source")} · {timeAgo(tree.lastOpenedAt || tree.updatedAt)}</p>
        </div>
      </Link>
      {last && lastTitle && <Link className="tc-resume" to={`/tree/${tree.id}?path=${last.nodeIds.join(",")}`}>Resume at <span className="serif">{contentOf(lastTitle, docs).title}</span></Link>}
      {!tree.locked && <button className={`tc-delete${armed ? " armed" : ""}`} aria-label="Delete tree" onClick={() => (armed ? deleteTree(tree.id) : (setArmed(true), setTimeout(() => setArmed(false), 3000)))}><Trash2 size={14} />{armed && "Delete tree?"}</button>}
    </article>
  );
}
