// A branch opened over the workspace: read it and type into it in place, without opening another card.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageCircle, PanelsTopLeft, Trash2, X } from "lucide-react";
import type { TreeNode } from "../../data/types";
import { useStore } from "../../store/useStore";
import { Markdown } from "../ui";
import { KIND_LABEL } from "./BranchCard";
import { noteTitle } from "../../lib/actions";
import { plural } from "../../lib/util";

interface BranchPopupProps {
  node: TreeNode;
  locked: boolean;
  childCount: number;
  onClose: () => void;
  /** Open the branch as a card in the trail, to read what grew from it or branch from its words. */
  onOpenAsCard: () => void;
}

export function BranchPopup({ node: n, locked, childCount, onClose, onOpenAsCard }: BranchPopupProps) {
  const { updateNode, removeNode, setUI } = useStore.getState();
  const [draft, setDraft] = useState(n.body || "");
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  /** Claude's explanations are read here; your own notes, definitions and clipping notes are typed straight in. */
  const editable = !locked && !n.pending && n.kind !== "source";

  useEffect(() => { if (n.pending) setDraft(n.body || ""); }, [n.body, n.pending]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`;
  }, [draft]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const change = (text: string) => {
    setDraft(text);
    const title = n.kind === "note" ? (n.summary ? n.title : noteTitle(text)) : n.title;
    updateNode(n.id, { body: text, title });
  };
  const label = n.summary ? "Summary" : n.kind === "explanation" ? `Claude · ${n.depth || "educational"}` : KIND_LABEL[n.kind];
  const quote = n.anchors[0]?.quote;
  const placeholder = n.summary ? "Sum up this section in your own words…" : n.kind === "definition" ? "Write a definition…" : n.kind === "clipping" ? "Your note on this clipping…" : "Write…";

  return (
    <div className="popup-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`popup popup-${n.kind}`} role="dialog" aria-modal="true" aria-label={label} data-testid="branch-popup">
        <div className="popup-head">
          <span className="mono-label"><span className={`kdot k-${n.kind}`} />{label}</span>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        {n.kind === "definition" && <h2 className="popup-title serif">{n.title}</h2>}
        {quote && <blockquote className="popup-quote serif">{quote}</blockquote>}
        {n.kind === "clipping" && n.clip && <blockquote className="popup-quote serif">{n.clip.text}</blockquote>}
        {editable ? (
          <textarea ref={ref} className="popup-editor serif" autoFocus value={draft} onChange={(e) => change(e.target.value)} placeholder={placeholder} aria-label={n.summary ? "Summary" : "Your writing"} />
        ) : (
          <div className="popup-body">{n.body ? <Markdown text={n.body} /> : <p className="muted">{n.pending ? "Claude is thinking…" : "Nothing written yet."}</p>}</div>
        )}
        <div className="popup-foot">
          <span className="muted small">{editable ? "Saved as you type" : ""}</span>
          <span className="flex1" />
          <button className="btn btn-ghost btn-sm" onClick={() => { setUI({ drawer: "ask", pendingQuote: n.anchors[0] || null, focus: false, popup: null }); }}><MessageCircle size={13} />Ask</button>
          <button className="btn btn-ghost btn-sm" onClick={onOpenAsCard} title="Open as a card to branch from its words">
            <PanelsTopLeft size={13} />{childCount ? `Open with ${plural(childCount, "branch", "branches")}` : "Open as card"}
          </button>
          {!locked && <button className={`btn btn-ghost btn-sm${armed ? " danger" : ""}`} onClick={() => { if (armed) { removeNode(n.id); onClose(); } else setArmed(true); }}>
            <Trash2 size={13} />{armed ? "Delete?" : "Delete"}
          </button>}
        </div>
      </div>
    </div>
  );
}
