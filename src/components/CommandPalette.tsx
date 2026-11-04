// ⌘K: jump to any tree, branch or topic, or run an action.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, GitBranch, Tags, Trees, Zap } from "lucide-react";
import { useStore } from "../store/useStore";
import { contentOf, pathTo } from "../lib/content";
import { exportBackup } from "../lib/backup";

type Item = { id: string; kind: "Tree" | "Branch" | "Topic" | "Action"; label: string; hint?: string; run: () => void };

export function CommandPalette() {
  const open = useStore((s) => s.ui.paletteOpen);
  const trees = useStore((s) => s.trees);
  const nodes = useStore((s) => s.nodes);
  const docs = useStore((s) => s.docs);
  const topics = useStore((s) => s.topics);
  const { setUI } = useStore.getState();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setI(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);

  const items = useMemo<Item[]>(() => {
    const close = () => setUI({ paletteOpen: false });
    const go = (p: string) => () => { close(); navigate(p); };
    const treeTitle = Object.fromEntries(trees.map((t) => [t.id, t.title]));
    const all: Item[] = [
      ...trees.map((t) => ({ id: t.id, kind: "Tree" as const, label: t.title, run: go(`/tree/${t.id}`) })),
      ...Object.values(nodes).filter((n) => n.parentId).map((n) => ({ id: n.id, kind: "Branch" as const, label: n.kind === "source" ? contentOf(n, docs).title : n.title, hint: treeTitle[n.treeId], run: go(`/tree/${n.treeId}?path=${pathTo(nodes, n.id).join(",")}`) })),
      ...topics.map((t) => ({ id: t.id, kind: "Topic" as const, label: t.name, run: go(`/topics?t=${t.id}`) })),
      { id: "a-trees", kind: "Action", label: "Your trees", run: go("/") },
      { id: "a-topics", kind: "Action", label: "Topics", run: go("/topics") },
      { id: "a-focus", kind: "Action", label: "Focus mode", run: () => setUI({ focus: true, paletteOpen: false }) },
      { id: "a-export", kind: "Action", label: "Export backup", run: () => { exportBackup(); close(); } },
    ];
    const t = q.trim().toLowerCase();
    return (t ? all.filter((x) => x.label.toLowerCase().includes(t) || x.hint?.toLowerCase().includes(t)) : all.filter((x) => x.kind !== "Branch")).slice(0, 14);
  }, [q, trees, nodes, docs, topics, navigate, setUI]);

  if (!open) return null;
  const icon = (k: Item["kind"]) => (k === "Tree" ? <Trees size={15} /> : k === "Branch" ? <GitBranch size={15} /> : k === "Topic" ? <Tags size={15} /> : k === "Action" ? <Zap size={15} /> : <FileText size={15} />);
  return (
    <div className="palette-shade" onMouseDown={() => setUI({ paletteOpen: false })}>
      <div className="palette" role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={q} placeholder="Search trees, branches and topics…" aria-label="Search"
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(items.length - 1, v + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); items[i]?.run(); }
            else if (e.key === "Escape") setUI({ paletteOpen: false });
          }} />
        <ul>
          {items.map((it, k) => (
            <li key={it.kind + it.id}><button className={k === i ? "on" : ""} onMouseEnter={() => setI(k)} onClick={it.run}>{icon(it.kind)}<span className="pl-label">{it.label}</span><span className="pl-kind mono-label">{it.hint || it.kind}</span></button></li>
          ))}
          {items.length === 0 && <li className="muted small pad">Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}
