// A branch in a card's margin. One component with a variant per kind; click a source to open it as the next card, anything else to open it over the workspace.
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent as RPointerEvent } from "react";
import { ArrowLeftRight, ArrowRight, BookOpen, ExternalLink, PenLine, MessageCircle, Pencil, RotateCw, Sparkles, Trash2, Unlink } from "lucide-react";
import type { Anchor, Depth, Track, TreeNode } from "../../data/types";
import { TRACK_LABEL, otherTrack, trackOf } from "../../lib/tracks";
import { selectionAnchor } from "../../lib/anchors";
import { toast } from "../../lib/toast";
import { useStore } from "../../store/useStore";
import { Markdown, Segmented, SourceChip } from "../ui";
import { siteName } from "../../lib/clipboard";
import { quoteToEssay, explainNode, loadUrl, noteTitle, runAsk, runExplain } from "../../lib/actions";
import { clamp, plural } from "../../lib/util";

export const KIND_LABEL: Record<TreeNode["kind"], string> = { source: "Source", note: "Note", definition: "Definition", explanation: "Claude", clipping: "Clipping" };
/** The look a branch gets on the canvas, its thread and its mark on the page: its kind, with Wikipedia apart from the dictionary. */
export const kindClass = (n: TreeNode) => (n.kind === "definition" && n.defSource?.site === "Wikipedia" ? "wiki" : n.kind);

interface Props {
  node: TreeNode;
  /** Essay or rabbit hole, as worked out for this branch. */
  track?: Track | null;
  top?: number;
  /** Which margin it's in: it grows away from the page when you stretch it. */
  side?: "left" | "right";
  inline?: boolean;
  editing: boolean;
  /** The tree is locked: show the branch, but offer nothing that changes it. */
  locked?: boolean;
  focused: boolean;
  hot: boolean;
  childCount: number;
  setRef?: (el: HTMLDivElement | null) => void;
  onOpen: () => void;
  /** Open a web address (e.g. a definition's Wikipedia page) in the reader over the workspace. */
  onRead?: (url: string) => void;
  /** Sources: open (or close) the article right here in the margin, beside the page you're writing on. */
  onReadBeside?: () => void;
  /** The article is open in this card. */
  reading?: boolean;
  /** Set when the card stands in its own reading column beyond the margin: its height, to fill the window. */
  column?: number;
  onHover: (on: boolean) => void;
  onEdit: () => void;
  onDone: () => void;
  onAsk: () => void;
  onThreadStart: (e: RPointerEvent) => void;
  onJump: (blockId: string) => void;
  onResize: () => void;
}

export function BranchCard({ node: n, track, top, side = "right", inline, editing, locked, focused, hot, childCount, setRef, onOpen, onRead, onReadBeside, reading, column, onHover, onEdit, onDone, onAsk, onThreadStart, onJump, onResize }: Props) {
  const { updateNode, removeNode, removeAnchor } = useStore.getState();
  const doc = useStore((s) => (n.docId ? s.docs[n.docId] : undefined));
  // A source shows its article when you open it here, or when you've stretched its card to read in.
  const showArticle = n.kind === "source" && !!doc && !inline && (!!reading || !!n.size);
  const articleRef = useRef<HTMLDivElement>(null);
  const [excerpt, setExcerpt] = useState<{ anchor: Anchor; x: number; y: number } | null>(null);
  const readExcerpt = () => setTimeout(() => {
    const el = articleRef.current, card = elRef.current;
    if (!el || !card || !doc || locked) return;
    const info = selectionAnchor({ id: n.id, blocks: doc.blocks }, el);
    if (!info) { setExcerpt(null); return; }
    const z = useStore.getState().ui.readZoom ?? 1, cr = card.getBoundingClientRect();
    setExcerpt({ anchor: info.anchor, x: (info.rect.left + info.rect.width / 2 - cr.left) / z, y: (info.rect.top - cr.top) / z });
  }, 0);
  /** Send the selected words to your writing as a quotation, linked to exactly where they are in this source. */
  const citeExcerpt = () => {
    if (!excerpt || !doc) return;
    const where = quoteToEssay(n.treeId, excerpt.anchor, { title: doc.title, site: doc.site });
    if (trackOf(n, useStore.getState().nodes) !== "essay") updateNode(n.id, { track: "essay" });
    if (where === "writing") useStore.getState().setUI({ drawer: "understanding", focus: false });
    window.getSelection()?.removeAllRanges(); setExcerpt(null);
    toast(where === "root" ? "Quoted at the end of your essay and filed under Essay" : "Quoted in your writing and filed under Essay");
  };
  const elRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [draft, setDraft] = useState(n.body || "");
  const [src, setSrc] = useState("");
  const [question, setQuestion] = useState("");
  const [liveSize, setLiveSize] = useState<{ w: number; h: number } | null>(null);
  const size = liveSize || n.size;
  /** Stretch the card from its outer bottom corner. It keeps the size you give it. */
  const startResize = (e: RPointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const el = elRef.current;
    if (!el) return;
    const x0 = e.clientX, y0 = e.clientY, w0 = el.offsetWidth, h0 = el.offsetHeight;
    // The page may be zoomed: pointer distances are on screen, sizes are in page units.
    const z = useStore.getState().ui.readZoom ?? 1;
    let next = { w: w0, h: h0 };
    const move = (ev: PointerEvent) => {
      const dx = ((ev.clientX - x0) / z) * (side === "left" ? -1 : 1);
      next = { w: Math.round(clamp(w0 + dx, 160, 900)), h: Math.round(clamp(h0 + (ev.clientY - y0) / z, 64, 1400)) };
      setLiveSize(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      updateNode(n.id, { size: next }); setLiveSize(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Drag the card by its top strip: sideways moves it further from (or back towards) the page, up and down moves it along the margin. */
  const [liveNudge, setLiveNudge] = useState<{ away: number; dy: number } | null>(null);
  const nudge = liveNudge || n.nudge;
  const moved = useRef(false);
  const startMove = (e: RPointerEvent) => {
    if (inline || locked || column || e.button !== 0 || (e.target as HTMLElement).closest("button, a, input")) return;
    const x0 = e.clientX, y0 = e.clientY, start = n.nudge || { away: 0, dy: 0 };
    const z = useStore.getState().ui.readZoom ?? 1;
    let next = start;
    moved.current = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z;
      if (!moved.current && Math.hypot(dx, dy) < 4) return;
      moved.current = true;
      ev.preventDefault();
      next = { away: Math.round(clamp(start.away + dx * (side === "left" ? -1 : 1), -200, 4000)), dy: Math.round(clamp(start.dy + dy, -2000, 4000)) };
      setLiveNudge(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      if (moved.current) { updateNode(n.id, { nudge: next.away || next.dy ? next : undefined }); setLiveNudge(null); onResize(); }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

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
    if (moved.current) { moved.current = false; return; } // that was a drag, not a click
    if (editing || t.closest("button, a, input, textarea, form, [role=radiogroup], .bcard-article")) return;
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
      data-side={inline ? undefined : side}
      className={`bcard bcard-${n.kind} kind-${kindClass(n)} side-${side}${size && !inline ? " sized" : ""}${focused ? " focused" : ""}${hot ? " hot" : ""}${inline ? " inline" : ""}${unattached ? " unattached" : ""}${showArticle ? " reading" : ""}${column ? " reading-col" : ""}${editable ? " editable" : ""}${liveNudge ? " moving" : ""}`}
      style={!inline ? { ...(top != null ? { top } : {}), ...(column ? { height: column } : size ? { width: size.w, height: size.h } : {}),
        // While dragging, the card follows the pointer; once dropped, the layout places it (its `dy` is part of where it sits).
        ...(!column && (nudge?.away || liveNudge) ? { transform: `translate(${(side === "left" ? -1 : 1) * (nudge?.away || 0)}px, ${liveNudge ? liveNudge.dy - (n.nudge?.dy || 0) : 0}px)` } : {}) } : undefined}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {!inline && !locked && <button className={`thread-handle card-handle${unattached ? " show" : ""}`} aria-label="Drag onto a sentence to link this branch there too" onPointerDown={onThreadStart} />}
      <div className={`bcard-head mono-label${!inline && !locked && !column ? " movable" : ""}`} onPointerDown={startMove} title={!inline && !locked && !column ? "Drag to move this card" : undefined}>
        <span className="kdot" />
        <span>{n.summary ? "Summary" : n.kind === "explanation" ? (n.question !== undefined ? "Claude · Ask" : `Claude · ${n.depth || "educational"}`) : n.kind === "definition" && n.defSource?.site === "Wikipedia" ? "Wikipedia" : KIND_LABEL[n.kind]}</span>
        {first && <><span>·</span><span>p. {first.page}</span></>}
        <span className="flex1" />
        {n.anchors.length > 1 && <span className="count">{n.anchors.length} links</span>}
        {childCount > 0 && <span className="count">{plural(childCount, "branch", "branches")}</span>}
        {unattached && <span className="count">Not linked</span>}
        {track && (locked ? <span className={`track-chip t-${track}`}>{TRACK_LABEL[track]}</span>
          : <button className={`track-chip t-${track}`} data-testid="track-chip" title={`Switch to ${TRACK_LABEL[otherTrack(track)]}`} aria-label={`${TRACK_LABEL[track]}. Switch to ${TRACK_LABEL[otherTrack(track)]}`}
              onClick={() => updateNode(n.id, { track: otherTrack(track) })}>{TRACK_LABEL[track]}</button>)}
      </div>

      {n.kind === "source" && (
        <>
          <div className="bcard-title serif">{n.title}</div>
          {n.pending ? <p className="bcard-meta"><span className="thinking"><i /><i /><i /></span> Opening…</p>
            : n.error ? <p className="bcard-error">{n.error} <button className="link-btn" onClick={() => loadUrl(n.id)}><RotateCw size={11} /> Retry</button></p>
            : <p className="bcard-meta">{meta}{doc?.warning ? " · may be incomplete" : ""}</p>}
          {showArticle && doc && (
            <div className="bcard-article serif" ref={articleRef} data-testid="article" aria-label={`${n.title}, the article`} onMouseUp={readExcerpt} onKeyUp={readExcerpt}>
              {doc.blocks.map((b) => (b.kind === "h" ? <h4 key={b.id} data-block={b.id}>{b.text}</h4> : <p key={b.id} data-block={b.id}>{b.text}</p>))}
            </div>
          )}
          {excerpt && (
            <div className="excerpt-bar" style={{ left: excerpt.x, top: Math.max(4, excerpt.y - 42) }} onMouseDown={(e) => e.preventDefault()}>
              <button onClick={citeExcerpt} data-testid="excerpt-cite"><PenLine size={13} />Quote in essay</button>
            </div>
          )}
        </>
      )}

      {n.kind === "definition" && (
        <>
          <div className="bcard-title serif">{n.title}</div>
          {n.pending ? <p className="bcard-meta"><span className="thinking"><i /><i /><i /></span> Looking it up…</p> : null}
          {!n.pending && !n.body && !editing && !locked && (
            <div className="bcard-empty">
              <p>{n.defSource?.site === "Wikipedia" ? "No Wikipedia article was found." : "No dictionary entry was found."}</p>
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
          {n.kind === "explanation" && n.question && <p className="bcard-question serif">{n.question}</p>}
          {n.kind === "explanation" && n.question === "" && !n.pending && !locked && (
            <form className="bcard-ask" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); if (question.trim()) runAsk(n.id, question); }}>
              <textarea autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} aria-label="Ask Claude about this passage" placeholder="Ask Claude about this passage…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } if (e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); } }} />
              <div className="row"><button type="submit" className="btn btn-primary btn-sm" disabled={!question.trim()}><Sparkles size={12} />Ask Claude</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => removeNode(n.id)}>Cancel</button></div>
            </form>
          )}
          {n.kind === "explanation" && n.pending && !n.body && <p className="bcard-meta"><span className="thinking"><i /><i /><i /></span> Claude is thinking…</p>}
          {n.kind === "explanation" && n.error && <p className="bcard-error">{n.error}</p>}
          {n.kind === "definition" && n.body && <p className="bcard-meta">{n.defSource?.site ? <>From <a href={n.defSource.url} target="_blank" rel="noopener" onClick={(e) => { if (!onRead || !n.defSource?.url || e.metaKey || e.ctrlKey) return; e.preventDefault(); e.stopPropagation(); onRead(n.defSource.url); }}>{n.defSource.site}</a></> : "Your definition"}</p>}
          {n.kind === "clipping" && !n.body && !locked && <button className="add-note" onClick={onEdit}>Add your note…</button>}
        </>
      )}

      {n.kind === "explanation" && n.question === undefined && !n.pending && !locked && (
        <div className="bcard-depth" onClick={(e) => e.stopPropagation()}>
          <Segmented size="sm" label="Depth" value={n.depth || "educational"} onChange={(d: Depth) => runExplain(n.id, d)} options={[{ value: "educational", label: "Educational" }, { value: "technical", label: "Technical" }, { value: "both", label: "Both" }]} />
        </div>
      )}

      {(n.anchors.length > 1 || (focused && !inline && n.anchors.length > 0)) && (
        <div className="linked-list" data-testid="link-list">
          {n.anchors.map((x, i) => (i > 0 || focused) && (
            <div key={i} className="linked-row">
              <button className="linked" onClick={() => onJump(x.blockId)}>{i === 0 ? "Linked to" : "Also linked to"} p. {x.page}: <span className="serif">“{x.quote.slice(0, 60)}{x.quote.length > 60 ? "…" : ""}”</span></button>
              {!locked && <button className="icon-btn unlink" aria-label={`Unlink from “${x.quote.slice(0, 40)}”`} title="Unlink from this passage (the branch stays)" onClick={(e) => { e.stopPropagation(); removeAnchor(n.id, i, top); }}><Unlink size={12} /></button>}
            </div>
          ))}
        </div>
      )}

      {!editing && (
        <div className="bcard-actions">
          <button onClick={onOpen} title={n.kind === "source" ? "Open as the next card" : "Open to read and write"}><ArrowRight size={13} />Open</button>
          {n.kind === "source" && onReadBeside && <button onClick={onReadBeside} aria-expanded={!!reading} title={reading ? "Fold the article back into the card" : "Read the article here, beside the page you're writing on"}><BookOpen size={13} />{reading ? "Close article" : "Read here"}</button>}
          {editable && <button onClick={onEdit}><Pencil size={13} />Edit</button>}
          {n.kind === "definition" && n.body && !locked && <button onClick={() => explainNode(n)} title="Claude explains this term in the margin"><Sparkles size={13} />Explain</button>}
          <button onClick={onAsk} title="Ask Claude about this"><MessageCircle size={13} />Ask</button>
          {n.kind === "source" && (n.url || doc?.url) && <a href={n.url || doc?.url} target="_blank" rel="noopener" title="Open the original page"><ExternalLink size={13} />Original</a>}
          {!inline && !locked && <button onClick={() => updateNode(n.id, { side: side === "left" ? "right" : "left" })} title={`Move to the ${side === "left" ? "right" : "left"} margin`}><ArrowLeftRight size={13} />Move</button>}
          {!locked && <button className={armed ? "armed" : ""} onClick={() => (armed ? removeNode(n.id) : setArmed(true))} title="Delete">
            <Trash2 size={13} />{armed ? (childCount ? `Delete with ${plural(childCount, "branch", "branches")}?` : "Delete?") : ""}
          </button>}
        </div>
      )}
      {!inline && !locked && <span className="bcard-resize" role="presentation" title="Drag to resize" onPointerDown={startResize} onClick={(e) => e.stopPropagation()} />}
    </div>
  );
}
