// A web page or Wikipedia article read over the workspace, in the page's own words.
// Links inside it open in the same panel. Keep it as a branch only if it's worth keeping.
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ExternalLink, GitBranch, X } from "lucide-react";
import type { Anchor, Block, Doc } from "../../data/types";
import { useStore } from "../../store/useStore";
import { fetchAsDoc } from "../../lib/api";

interface ReaderPopupProps {
  url: string;
  title?: string;
  treeId: string;
  parentId: string;
  anchor: Anchor | null;
  locked: boolean;
  onClose: () => void;
  /** The page was kept: open the new branch as a card. */
  onKept: (nodeId: string) => void;
}

/** A block's words with its links made followable inside the reader. */
function blockText(block: Block, onLink: (href: string) => void): ReactNode {
  if (!block.links?.length) return block.text;
  const out: ReactNode[] = [];
  let at = 0;
  for (const l of block.links) {
    if (l.start < at) continue;
    out.push(block.text.slice(at, l.start));
    out.push(<a key={l.start} href={l.href} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); onLink(l.href); }}>{block.text.slice(l.start, l.end)}</a>);
    at = l.end;
  }
  out.push(block.text.slice(at));
  return out;
}

export function ReaderPopup({ url, title, treeId, parentId, anchor, locked, onClose, onKept }: ReaderPopupProps) {
  const { addBranch } = useStore.getState();
  const [history, setHistory] = useState<string[]>([url]);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const here = history[history.length - 1];

  useEffect(() => { setHistory([url]); }, [url]);
  useEffect(() => {
    let live = true;
    setDoc(null); setError(null);
    fetchAsDoc(here).then((d) => { if (live) setDoc(d); }, (e: Error) => { if (live) setError(e.message || "This page couldn't be opened."); });
    return () => { live = false; };
  }, [here]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const keep = () => {
    if (!doc) return;
    // Only the page the reader came from is anchored to the passage; pages reached by links inside it are not.
    const id = addBranch(treeId, { kind: "source", title: doc.title, parentId, anchors: anchor && history.length === 1 ? [anchor] : [], url: here, docId: doc.id, doc });
    onKept(id);
  };
  const site = here.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];

  return (
    <aside className="reader-popup" role="dialog" aria-label="Reader" data-testid="reader">
      <div className="reader-head">
        {history.length > 1 && <button className="icon-btn" aria-label="Back" onClick={() => setHistory((h) => h.slice(0, -1))}><ArrowLeft size={16} /></button>}
        <div className="reader-where">
          <span className="mono-label">{site}</span>
          <span className="reader-title serif">{doc?.title || title || here}</span>
        </div>
        <a className="icon-btn" href={here} target="_blank" rel="noopener" aria-label="Open in the browser" title="Open in the browser"><ExternalLink size={15} /></a>
        <button className="icon-btn" aria-label="Close reader" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="reader-body">
        {error ? (
          <div className="reader-msg"><p>{error}</p><a className="btn btn-secondary btn-sm" href={here} target="_blank" rel="noopener"><ExternalLink size={13} />Open in the browser</a></div>
        ) : !doc ? (
          <p className="reader-msg muted"><span className="thinking"><i /><i /><i /></span> Opening {site}…</p>
        ) : (
          <article className="reader-text serif">
            {doc.warning && <p className="card-warning">{doc.warning}</p>}
            {doc.blocks.map((b) => {
              const Tag = b.kind === "h" ? "h3" : "p";
              return <Tag key={b.id}>{blockText(b, (href) => setHistory((h) => [...h, href]))}</Tag>;
            })}
          </article>
        )}
      </div>
      {!locked && doc && (
        <div className="reader-foot">
          <span className="muted small">Read here, or keep it to highlight and branch from it.</span>
          <button className="btn btn-primary btn-sm" onClick={keep}><GitBranch size={13} />Keep as branch</button>
        </div>
      )}
    </aside>
  );
}
