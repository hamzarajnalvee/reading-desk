// The Notebook: everything you wrote in a tree on one calm page — your writing, notes, summaries and highlights —
// grouped by essay or rabbit hole (or by source), each linked back to the passage it came from.
import { useMemo, useState } from "react";
import { ArrowUpRight, PenLine, Sparkles } from "lucide-react";
import type { Anchor, Track, Tree } from "../../data/types";
import { useStore } from "../../store/useStore";
import { contentOf } from "../../lib/content";
import { TRACK_LABEL, otherTrack, tracksOf } from "../../lib/tracks";
import { citeClick } from "../../lib/writing";
import { suggestTracks } from "../../lib/api";
import { Markdown, Segmented } from "../ui";
import { plural } from "../../lib/util";
import { toast } from "../../lib/toast";

type Entry = { id: string; kind: "note" | "summary" | "highlight"; nodeId?: string; parentId: string; anchor?: Anchor; body?: string; track: Track; at: number };

interface NotebookViewProps {
  tree: Tree;
  onOpenPassage: (nodeId: string, blockId: string) => void;
  onOpenWriting: () => void;
}

export function NotebookView({ tree, onOpenPassage, onOpenWriting }: NotebookViewProps) {
  const allNodes = useStore((s) => s.nodes);
  const docs = useStore((s) => s.docs);
  const highlights = useStore((s) => s.highlights);
  const { setUI, updateNode } = useStore.getState();
  const [group, setGroup] = useState<"track" | "source">("track");
  const [suggested, setSuggested] = useState<Record<string, Track> | null>(null);
  const [sorting, setSorting] = useState(false);
  const locked = !!tree.locked;

  const tracks = useMemo(() => tracksOf(allNodes, tree.id), [allNodes, tree.id]);
  const seed = allNodes[tree.seedId];
  const titleOf = (id: string) => (allNodes[id] ? contentOf(allNodes[id], docs).title : "");

  const entries: Entry[] = useMemo(() => {
    const out: Entry[] = [];
    for (const n of Object.values(allNodes)) {
      if (n.treeId !== tree.id || n.kind !== "note" || !n.parentId || !n.body?.trim()) continue;
      out.push({ id: n.id, kind: n.summary ? "summary" : "note", nodeId: n.id, parentId: n.parentId, anchor: n.anchors[0], body: n.body, track: tracks[n.id] || "essay", at: n.createdAt });
    }
    for (const h of highlights) {
      const n = allNodes[h.nodeId];
      if (!n || n.treeId !== tree.id) continue;
      out.push({ id: h.id, kind: "highlight", parentId: n.id, anchor: h.anchor, track: tracks[n.id] || "essay", at: h.createdAt });
    }
    return out.sort((a, b) => a.at - b.at);
  }, [allNodes, highlights, tracks, tree.id]);

  const groups = useMemo(() => {
    const m = new Map<string, { title: string; items: Entry[] }>();
    if (group === "track") (["essay", "rabbit"] as Track[]).forEach((t) => m.set(t, { title: TRACK_LABEL[t], items: [] }));
    for (const e of entries) {
      const key = group === "track" ? e.track : e.parentId;
      if (!m.has(key)) m.set(key, { title: titleOf(e.parentId), items: [] });
      m.get(key)!.items.push(e);
    }
    return [...m.entries()];
  }, [entries, group]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Sort with Claude: suggestions you accept or discard; nothing changes on its own ---------- */
  const branches = Object.values(allNodes).filter((n) => n.treeId === tree.id && n.parentId);
  const changes = suggested ? branches.filter((n) => suggested[n.id] && suggested[n.id] !== tracks[n.id]) : [];
  const sort = async () => {
    setSorting(true);
    try {
      const items = branches.map((n) => ({ id: n.id, kind: n.kind, title: n.kind === "source" ? titleOf(n.id) : n.title, text: n.anchors[0]?.quote || n.body?.slice(0, 240) || n.clip?.text.slice(0, 240) }));
      setSuggested(await suggestTracks(`${tree.title}${seed?.kind === "note" && seed.body ? `\n${seed.body.slice(0, 500)}` : ""}`, items));
    } catch (e) { toast((e as Error).message || "Couldn't reach Claude. Is the app's server running?"); }
    finally { setSorting(false); }
  };
  const apply = () => {
    changes.forEach((n) => updateNode(n.id, { track: suggested![n.id] }));
    toast(`Moved ${plural(changes.length, "branch", "branches")}`);
    setSuggested(null);
  };

  return (
    <div className="notebook" data-testid="notebook">
      <div className="nb-inner">
        <header className="nb-head">
          <div>
            <div className="mono-label">Notebook</div>
            <h2 className="serif">{tree.title}</h2>
            {seed?.kind === "note" && seed.body && seed.body.trim() !== tree.title.trim() && <p className="nb-statement serif">{seed.body}</p>}
          </div>
          <div className="nb-tools">
            <Segmented size="sm" label="Group by" value={group} onChange={setGroup} options={[{ value: "track", label: "Essay · Rabbit holes" }, { value: "source", label: "By source" }]} />
            {!locked && branches.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={sort} disabled={sorting} title="Claude suggests essay or rabbit hole for each branch. Nothing changes until you apply it.">
                <Sparkles size={13} />{sorting ? "Sorting…" : "Sort with Claude"}
              </button>
            )}
          </div>
        </header>

        {suggested && (
          <div className="nb-suggest" role="status" data-testid="sort-suggestions">
            {changes.length === 0 ? <p>Claude agrees with every branch’s track.</p> : (<>
              <p>Claude suggests moving {plural(changes.length, "branch", "branches")}:</p>
              <ul>{changes.map((n) => <li key={n.id}><span className="serif">{n.kind === "source" ? titleOf(n.id) : n.title}</span> <span className="muted">→ {TRACK_LABEL[suggested[n.id]]}</span></li>)}</ul>
            </>)}
            <div className="row">
              {changes.length > 0 && <button className="btn btn-primary btn-sm" onClick={apply}>Apply</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => setSuggested(null)}>{changes.length ? "Discard" : "Close"}</button>
            </div>
          </div>
        )}

        <section className="nb-writing">
          <div className="nb-section-head"><h3 className="serif">Your writing</h3><button className="btn btn-ghost btn-sm" onClick={onOpenWriting}><PenLine size={13} />{tree.understanding.trim() ? "Edit" : "Start writing"}</button></div>
          {tree.understanding.trim() ? <div className="serif" onClick={citeClick(onOpenPassage)}><Markdown text={tree.understanding} /></div>
            : <p className="muted">Nothing yet. Open Writing from the header any time; select a passage and press Cite to link to it.</p>}
        </section>

        {entries.length === 0 && <p className="muted nb-empty">Your notes, summaries and highlights will gather here as you read.</p>}
        {groups.map(([key, g]) => g.items.length > 0 && (
          <section key={key} className={`nb-group${group === "track" ? ` t-${key}` : ""}`}>
            <h3 className="nb-section-head serif">{g.title} <span className="muted small">{g.items.length}</span></h3>
            {g.items.map((e) => (
              <article key={e.id} className={`nb-entry k-${e.kind}`} data-testid="notebook-entry" data-kind={e.kind}>
                <div className="mono-label nb-kicker">
                  <span>{e.kind === "summary" ? "Summary" : e.kind === "note" ? "Note" : "Highlight"}</span>
                  {group === "track" && <><span>·</span><span className="nb-from">{titleOf(e.parentId)}</span></>}
                  <span className="flex1" />
                  {e.nodeId && (locked ? <span className={`track-chip t-${e.track}`}>{TRACK_LABEL[e.track]}</span>
                    : <button className={`track-chip t-${e.track}`} aria-label={`${TRACK_LABEL[e.track]}. Switch to ${TRACK_LABEL[otherTrack(e.track)]}`} onClick={() => updateNode(e.nodeId!, { track: otherTrack(e.track) })}>{TRACK_LABEL[e.track]}</button>)}
                </div>
                {e.anchor && (
                  <button className="nb-quote serif" onClick={() => onOpenPassage(e.parentId, e.anchor!.blockId)} title="Go to the passage">
                    “{e.anchor.quote.length > 280 ? e.anchor.quote.slice(0, 277) + "…" : e.anchor.quote}”<ArrowUpRight size={13} aria-hidden />
                  </button>
                )}
                {e.body && <Markdown text={e.body} className="nb-body" />}
                {e.nodeId && !locked && <button className="link-btn small" onClick={() => setUI({ popup: e.nodeId! })}>Edit</button>}
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
