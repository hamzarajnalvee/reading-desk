// Start a tree, branch from a passage, or add straight to a card with no passage (e.g. a paper onto the essay's seed):
// write an idea, open a web address, add a file, paste text, or look a word up.
import { useEffect, useRef, useState } from "react";
import { BookOpen, FileUp, Globe, PenLine, ClipboardPaste, X } from "lucide-react";
import type { Anchor } from "../../data/types";
import { useStore } from "../../store/useStore";
import { ingestFile, ingestText, IngestError } from "../../lib/ingest";
import { fetchAsDoc } from "../../lib/api";
import { addDefinition, branchFromUrl, noteTitle } from "../../lib/actions";

type Tab = "write" | "url" | "file" | "paste" | "lookup";
const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: "write", label: "Write", icon: <PenLine size={14} /> },
  { id: "url", label: "Web address", icon: <Globe size={14} /> },
  { id: "file", label: "File", icon: <FileUp size={14} /> },
  { id: "paste", label: "Paste text", icon: <ClipboardPaste size={14} /> },
];
const LOOKUP = { id: "lookup" as Tab, label: "Look up", icon: <BookOpen size={14} /> };
/** Where branches added without a passage sit in the margin, before you thread them to one. */
const LOOSE_Y = 120;

type Props =
  | { mode: "tree"; onClose: () => void; onCreated: (treeId: string) => void; anchor?: undefined; treeId?: undefined; parentId?: undefined }
  | { mode: "branch"; anchor: Anchor | null; treeId: string; parentId: string; onClose: () => void; onCreated: (nodeId: string) => void };

export function AddDialog(p: Props) {
  const { createTree, addBranch } = useStore.getState();
  const [tab, setTab] = useState<Tab>(p.mode === "tree" ? "write" : "url");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [wiki, setWiki] = useState(false);
  const loose = p.mode === "branch" && !p.anchor;
  const anchors = p.mode === "branch" && p.anchor ? [p.anchor] : [];
  const where = loose ? { marginY: LOOSE_Y } : {};
  const tabs = loose ? [...TABS, LOOKUP] : TABS;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const firstRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    // Put the cursor in the tab's first field, unless you've already started typing in one.
    const t = setTimeout(() => { if (!document.activeElement?.matches("input, textarea")) firstRef.current?.focus(); }, 30);
    setError(null);
    return () => clearTimeout(t);
  }, [tab]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && p.onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [p]);

  const finishDoc = (doc: Awaited<ReturnType<typeof ingestText>>) => {
    if (p.mode === "tree") p.onCreated(createTree({ kind: "source", doc, title: title.trim() || doc.title }));
    else p.onCreated(addBranch(p.treeId, { kind: "source", title: doc.title, parentId: p.parentId, anchors, docId: doc.id, url: doc.url, doc, ...where }));
  };
  const run = async (fn: () => Promise<void> | void) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof IngestError ? e.message : (e as Error).message || "Something went wrong."); setBusy(null); }
  };

  const submit = () => run(async () => {
    if (tab === "write") {
      if (!text.trim()) { setError("Write something first."); return; }
      if (p.mode === "tree") p.onCreated(createTree({ kind: "note", title: title.trim() || noteTitle(text), body: text.trim() }));
      else p.onCreated(addBranch(p.treeId, { kind: "note", title: title.trim() || noteTitle(text), parentId: p.parentId, anchors, body: text.trim(), ...where }));
    } else if (tab === "url") {
      let u = url.trim();
      if (!u) { setError("Enter a web address."); return; }
      if (!/^https?:\/\//i.test(u)) u = "https://" + u;
      if (p.mode === "branch") {
        const id = branchFromUrl(p.treeId, p.parentId, p.anchor, u);
        if (loose) useStore.getState().updateNode(id, where);
        p.onCreated(id); return;
      }
      setBusy("Opening the page…");
      const doc = await fetchAsDoc(u, (m) => setBusy(m));
      finishDoc(doc);
    } else if (tab === "lookup" && p.mode === "branch") {
      if (!text.trim()) { setError("Enter a word or a name to look up."); return; }
      p.onCreated(addDefinition(p.treeId, p.parentId, text, LOOSE_Y, wiki ? "wikipedia" : undefined));
    } else if (tab === "paste") {
      if (!text.trim()) { setError("Paste some text first."); return; }
      finishDoc(ingestText(title.trim(), text));
    }
  });
  const onFiles = (files: FileList | null) => run(async () => {
    const f = files?.[0];
    if (!f) return;
    setBusy(`Reading ${f.name}…`);
    const doc = await ingestFile(f, (m) => setBusy(m));
    finishDoc(doc);
  });

  return (
    <div className="dialog-shade" onMouseDown={p.onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={p.mode === "tree" ? "Start a tree" : loose ? "Add to this tree" : "Branch from this passage"} onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <h2 className="serif">{p.mode === "tree" ? "Start a tree" : loose ? "Add to this tree" : "Branch from this passage"}</h2>
            {p.mode === "branch" && p.anchor ? <p className="dialog-quote serif">“{p.anchor.quote.slice(0, 160)}{p.anchor.quote.length > 160 ? "…" : ""}”</p>
              : loose ? <p className="muted">Add a paper, an article, a blog post, an excerpt or a definition. It joins the seed’s margin; drag its thread onto a sentence to link it to a passage.</p>
              : <p className="muted">Begin with an idea, a web page, a file or some text. Everything you follow from it grows into this tree.</p>}
          </div>
          <button className="icon-btn" aria-label="Close" onClick={p.onClose}><X size={16} /></button>
        </div>
        <div className="dialog-tabs" role="tablist">
          {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>{t.icon}{t.label}</button>)}
        </div>
        <form className="dialog-body" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          {tab === "write" && (<>
            {p.mode === "tree" && <input ref={firstRef} className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Telos" aria-label="Title" />}
            <textarea ref={p.mode === "tree" ? undefined : firstRef} className="field serif" rows={7} value={text} onChange={(e) => setText(e.target.value)} aria-label="Your idea"
              placeholder={p.mode === "tree" ? "What caught your curiosity, and where did you come across it?" : "Write what this passage makes you think. It opens as its own card you can branch from."} />
          </>)}
          {tab === "url" && (<>
            <input ref={firstRef} className="field" type="text" inputMode="url" autoCapitalize="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Web address" />
            <p className="muted small">Articles open as clean, readable text with a link to the original. PDFs and EPUBs open in full. Pages behind a login can't be opened; save them as PDF and add the file instead.</p>
          </>)}
          {tab === "file" && (
            <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
              <FileUp size={26} />
              <b>Choose a file or drop it here</b>
              <span className="muted small">PDF, EPUB, Word (.docx), HTML, Markdown or text</span>
              <input ref={fileRef} type="file" hidden accept=".pdf,.epub,.docx,.html,.htm,.md,.markdown,.txt,text/*,application/pdf" onChange={(e) => onFiles(e.target.files)} />
            </label>
          )}
          {tab === "lookup" && (<>
            <input ref={firstRef} className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="A word, a name or an idea, e.g. deskilling" aria-label="Term to look up" />
            <label className="check small"><input type="checkbox" checked={wiki} onChange={(e) => setWiki(e.target.checked)} /> Wikipedia only (skip the dictionary)</label>
          </>)}
          {tab === "paste" && (<>
            <input ref={firstRef} className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
            <textarea className="field serif" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste an article, a chapter or a passage" aria-label="Text" />
          </>)}
          {error && <p className="dialog-error" role="alert">{error}</p>}
          {busy && <p className="muted small"><span className="thinking"><i /><i /><i /></span> {busy}</p>}
          {tab !== "file" && (
            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={p.onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!!busy}>{p.mode === "tree" ? "Start tree" : tab === "url" ? "Open as branch" : tab === "lookup" ? "Look up" : "Add branch"}</button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
