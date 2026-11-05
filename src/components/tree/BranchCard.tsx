// A branch in a card's margin. One component with a variant per kind; click it to open it as the next card.
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as RPointerEvent } from "react";
import { ArrowRight, ExternalLink, MessageCircle, Pencil, RotateCw, Sparkles, Trash2 } from "lucide-react";
import type { Depth, TreeNode } from "../../data/types";
import { useStore } from "../../store/useStore";
import { Markdown, Segmented, SourceChip } from "../ui";
import { siteName } from "../../lib/clipboard";
import { explainNode, loadUrl, noteTitle, runExplain } from "../../lib/actions";
import { plural } from "../../lib/util";

export const KIND_LABEL: Record<TreeNode["kind"], string> = { source: "Source", note: "Note", definition: "Definition", explanation: "Claude", clipping: "Clipping" };

interface Props {
  node: TreeNode;
  top?: number;
  inline?: boolean;
  editing: boolean;
  /** The tree is locked: show the branch, but offer nothing that changes it. */
  locked?: boolean;
  focused: boolean;
  hot: boolean;
  childCount: number;
  setRef?: (el: HTMLDivElement | null) => void;
  onOpen: () => void;
  onHover: (on: boolean) => void;
  onEdit: () => void;
  onDone: () => void;
  onAsk: () => void;
  onThreadStart: (e: RPointerEvent) => void;
  onJump: (blockId: string) => void;
  onResize: () => void;
}

export function BranchCard({ node: n, top, inline, editing, locked, focused, hot, childCount, setRef, onOpen, onHover, onEdit, onDone, onAsk, onThreadStart, onJump, onResize }: Props) {
  const { updateNode, removeNode } = useStore.getState();
  const doc = useStore((s) => (n.docId ? s.docs[n.docId] : undefined));
  const elRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [draft, setDraft] = useState(n.body || "");
  const [src, setSrc] = useState("");

  useEffect(() => { if (editing) setDraft(n.body || ""); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!elRef.current) return;
    const ro = new ResizeObserver(() => onResize());
    ro.observe(elRef.current);
    return () => ro.disconnect();
  }, [onResize]);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);

  const editable = !locked && (n.kind === "note" || n.kind === "definition" || n.kind === "clipping");
  // Saves as you type; leaving the box finishes. A note left empty is removed.
  const change = (text: string) => {
    setDraft(text);
    updateNode(n.id, { body: text, ...(n.kind === "note" ? { title: noteTitle(text) } : {}) });
  };
  const finish = () => {
    const body = draft.trim();
    if (!body && n.kind === "note") { removeNode(n.id); onDone(); return; }
    if (body !== (n.body || "")) updateNode(n.id, { body, ...(n.kind === "note" ? { title: noteTitle(body) } : {}) });
    onDone();
  };
  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); e.stopPropagation(); e.currentTarget.blur(); }
  };
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);
  // Clicking your words edits them right here in the margin; clicking elsewhere on the card opens it as the next card.
  // Buttons, links and inputs keep their own behaviour.
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (editing || t.closest("button, a, input, textarea, form, [role=radiogroup]")) return;
    if (editable && n.body && t.closest(".bcard-note, .bcard-body") && !window.getSelection()?.toString()) { onEdit(); return; }
    onOpen();
  };

  const first = n.anchors[0];
  const unattached = n.anchors.length === 0;
  const meta = doc ? [doc.site || doc.format.toUpperCase(), doc.pages > 1 ? plural(doc.pages, "page") : ""].filter(Boolean).join(" · ") : n.url ? n.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40) : "";

  return (
    <div
      ref={(el) => { elRef.current = el; setRef?.(el); }}
      data-branch={n.id}
      data-testid="branch-card"
      data-kind={n.kind}
      className={`bcard bcard-${n.kind}${focused ? " focused" : ""}${hot ? " hot" : ""}${inline ? " inline" : ""}${unattached ? " unattached" : ""}${editable ? " editable" : ""}`}
      style={top != null && !inline ? { top } : undefined}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {!inline && !locked && <button className={`thread-handle card-handle${unattached ? " show" : ""}`} aria-label="Drag onto a sentence to link this branch there too" onPointerDown={onThreadStart} />}
      <div className="bcard-head mono-label">
        <span className="kdot" />
        <span>{n.kind === "explanation" ? `Claude · ${n.depth || "educational"}` : KIND_LABEL[n.kind]}</span>
        {first && <><span>·</span><span>p. {first.page}</span></>}
        <span className="flex1" />
        {n.anchors.length > 1 && <span className="count">{n.anchors.length} links</span>}
        {childCount > 0 && <span className="count">{plural(childCount, "branch", "branches")}</span>}
        {unattached && <span className="count">Not linked</span>}
      </div>

      {n.kind === "source" && (
        <>
          <div className="bcard-title serif">{n.title}</div>
          {n.pending ? <p className="bcard-meta"><span className="thinking"><i /><i /><i /></span> Opening…</p>
            : n.error ? <p className="bcard-error">{n.error} <button className="link-btn" onClick={() => loadUrl(n.id)}><RotateCw size={11} /> Retry</button></p>
            : <p className="bcard-meta">{meta}{doc?.warning ? " · may be incomplete" : ""}</p>}
        </>
      )}

      {n.kind === "definition" && (
        <>
          <div className="bcard-title serif">{n.title}</div>
          {n.pending ? <p className="bcard-meta"><span className="thinking"><i /><i /><i /></span> Looking it up…</p> : null}
          {!n.pending && !n.body && !editing && !locked && (
            <div className="bcard-empty">
              <p>No dictionary entry was found.</p>
              <div className="row"><button className="btn btn-secondary btn-sm" onClick={onEdit}>Write your own</button><button className="btn btn-ghost btn-sm" onClick={() => explainNode(n)}><Sparkles size={12} />Explain with Claude</button></div>
            </div>
          )}
        </>
      )}

      {n.kind === "clipping" && n.clip && (
        <>
          {n.clip.source.url || locked ? (n.clip.source.url ? <a className="source-link" href={n.clip.source.url} target="_blank" rel="noopener"><SourceChip source={n.clip.source} /></a> : null) : (
            <form className="add-source" onSubmit={(e) => { e.preventDefault(); const u = src.trim(); if (!u) return; const full = /^https?:\/\//.test(u) ? u : "https://" + u; updateNode(n.id, { clip: { ...n.clip!, source: { url: full, site: siteName(full) } } }); }}>
              <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Add source URL" aria-label="Source URL" />
            </form>
          )}
          <blockquote className="clip-text serif">{n.clip.text}</blockquote>
        </>
      )}

      {editing ? (
        <div className="bcard-edit">
          <textarea ref={editorRef} autoFocus value={draft} onChange={(e) => change(e.target.value)} onBlur={finish} onKeyDown={keys} rows={2} aria-label="Note"
            onFocus={(e) => { const l = e.currentTarget.value.length; e.currentTarget.setSelectionRange(l, l); }}
            placeholder={n.kind === "definition" ? "Write a definition…" : n.kind === "clipping" ? "Your note on this clipping…" : "Write a note…"} />
          <p className="bcard-edit-hint muted">Saved as you type · Esc when done</p>
        </div>
      ) : (
        <>
          {n.kind !== "source" && n.body ? <Markdown text={n.body} className={n.kind === "note" ? "bcard-note serif" : "bcard-body"} /> : null}
          {n.kind === "explanation" && n.pending && !n.body && <p className="bcard-meta"><span className="thinking"><i /><i /><i /></span> Claude is thinking…</p>}
          {n.kind === "explanation" && n.error && <p className="bcard-error">{n.error}</p>}
          {n.kind === "definition" && n.body && <p className="bcard-meta">{n.defSource?.site ? <>From <a href={n.defSource.url} target="_blank" rel="noopener">{n.defSource.site}</a></> : "Your definition"}</p>}
          {n.kind === "clipping" && !n.body && !locked && <button className="add-note" onClick={onEdit}>Add your note…</button>}
        </>
      )}

      {n.kind === "explanation" && !n.pending && !locked && (
        <div className="bcard-depth" onClick={(e) => e.stopPropagation()}>
          <Segmented size="sm" label="Depth" value={n.depth || "educational"} onChange={(d: Depth) => runExplain(n.id, d)} options={[{ value: "educational", label: "Educational" }, { value: "technical", label: "Technical" }, { value: "both", label: "Both" }]} />
        </div>
      )}

      {n.anchors.length > 1 && (
        <div className="linked-list">
          {n.anchors.slice(1).map((x, i) => (
            <button key={i} className="linked" onClick={() => onJump(x.blockId)}>Also linked to p. {x.page}: <span className="serif">“{x.quote.slice(0, 60)}{x.quote.length > 60 ? "…" : ""}”</span></button>
          ))}
        </div>
      )}

      {!editing && (
        <div className="bcard-actions">
          <button onClick={onOpen} title="Open as the next card"><ArrowRight size={13} />Open</button>
          {editable && <button onClick={onEdit}><Pencil size={13} />Edit</button>}
          {n.kind === "definition" && n.body && !locked && <button onClick={() => explainNode(n)} title="Claude explains this term in the margin"><Sparkles size={13} />Explain</button>}
          <button onClick={onAsk} title="Ask Claude about this"><MessageCircle size={13} />Ask</button>
          {n.kind === "source" && (n.url || doc?.url) && <a href={n.url || doc?.url} target="_blank" rel="noopener" title="Open the original page"><ExternalLink size={13} />Original</a>}
          {!locked && <button className={armed ? "armed" : ""} onClick={() => (armed ? removeNode(n.id) : setArmed(true))} title="Delete">
            <Trash2 size={13} />{armed ? (childCount ? `Delete with ${plural(childCount, "branch", "branches")}?` : "Delete?") : ""}
          </button>}
        </div>
      )}
    </div>
  );
}
