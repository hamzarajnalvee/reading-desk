// Right-hand drawers on the tree screen: your Writing (the essay or understanding note, linked to passages), and Ask Claude.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Pin, Sparkles, Square, X } from "lucide-react";
import type { Anchor, ChatTurn, Tree } from "../../data/types";
import { useStore } from "../../store/useStore";
import { ask, summarise } from "../../lib/api";
import { contentOf, plainText } from "../../lib/content";
import { Markdown, Segmented } from "../ui";
import { citeClick, citesIn } from "../../lib/writing";
import { timeAgo, plural } from "../../lib/util";
import { toast } from "../../lib/toast";

const NO_TURNS: ChatTurn[] = [];

export function UnderstandingDrawer({ tree, onClose, onOpenPassage }: { tree: Tree; onClose: () => void; onOpenPassage: (nodeId: string, blockId: string) => void }) {
  const nodes = useStore((s) => s.nodes);
  const docs = useStore((s) => s.docs);
  const { updateTree } = useStore.getState();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const words = (tree.understanding.replace(/\(#cite:[^)]*\)/g, "").match(/\S+/g) || []).length;
  const [mode, setMode] = useState<"write" | "read">("write");
  const cites = useMemo(() => citesIn(tree.understanding), [tree.understanding]);

  const material = () => Object.values(nodes).filter((n) => n.treeId === tree.id).sort((a, b) => a.createdAt - b.createdAt).map((n) => {
    const c = contentOf(n, docs);
    const label = n.kind === "source" ? `SOURCE: ${c.title}` : `${n.kind.toUpperCase()}${n.anchors[0] ? ` on “${n.anchors[0].quote.slice(0, 120)}”` : ""}`;
    return `${label}\n${n.kind === "source" ? plainText(c).slice(0, 12000) : n.kind === "clipping" ? `${n.clip?.text}\n${n.body || ""}` : n.body || ""}`;
  }).join("\n\n---\n\n");

  const draftWithClaude = async () => {
    setBusy(true); setDraft("");
    ctl.current = new AbortController();
    try { await summarise({ title: tree.title, material: material(), signal: ctl.current.signal, onText: setDraft }); }
    catch (e) { if ((e as Error).name !== "AbortError") setDraft("_Couldn't reach Claude. Is the app's server running?_"); }
    finally { setBusy(false); }
  };

  return (
    <aside className="drawer" aria-label="Understanding" data-testid="understanding">
      <div className="drawer-head"><h2 className="serif">Writing</h2>
        <Segmented size="sm" label="Writing view" value={mode} onChange={setMode} options={[{ value: "write", label: "Write" }, { value: "read", label: "Read" }]} />
        <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
      <p className="muted small drawer-sub">Your essay or thoughts, in your own words. To quote a passage with its source, select it and press Quote (C).</p>
      {mode === "write" ? (
        <textarea className="understanding serif" value={tree.understanding} readOnly={tree.locked} onChange={(e) => updateTree(tree.id, { understanding: e.target.value })}
          placeholder="Your argument, the key ideas, how they connect, and what's still open…" aria-label="Your writing" />
      ) : (
        <div className="writing-read serif" onClick={citeClick(onOpenPassage)}>
          {tree.understanding.trim() ? <Markdown text={tree.understanding} /> : <p className="muted">Nothing written yet.</p>}
        </div>
      )}
      {cites.length > 0 && (
        <div className="cite-list" aria-label="Linked passages">
          <div className="mono-label">Linked passages · {cites.length}</div>
          {cites.map((c, i) => (
            <button key={i} className="cite-item" data-testid="cite" disabled={!nodes[c.nodeId]} onClick={() => onOpenPassage(c.nodeId, c.blockId)}>
              <Link2 size={12} aria-hidden /><span className="serif">{c.label}</span>
              <span className="muted small">{nodes[c.nodeId] ? contentOf(nodes[c.nodeId], docs).title : "Branch deleted"}</span>
            </button>
          ))}
        </div>
      )}
      <div className="drawer-foot">
        <span className="muted small">{plural(words, "word")} · updated {timeAgo(tree.updatedAt)}</span>
        {busy ? <button className="btn btn-secondary btn-sm" onClick={() => ctl.current?.abort()}><Square size={12} />Stop</button>
          : !tree.locked && <button className="btn btn-ghost btn-sm" onClick={draftWithClaude}><Sparkles size={13} />Draft with Claude</button>}
      </div>
      {draft !== null && (
        <div className="draft">
          <div className="mono-label">Claude's draft · not saved until you add it</div>
          {draft ? <Markdown text={draft} /> : <span className="thinking"><i /><i /><i /></span>}
          {!busy && draft && (
            <div className="row">
              <button className="btn btn-primary btn-sm" onClick={() => { updateTree(tree.id, { understanding: (tree.understanding.trim() ? tree.understanding.trim() + "\n\n" : "") + draft }); setDraft(null); }}>Add to my note</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Discard</button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

export function AskDrawer({ tree, path, onClose, onPin }: { tree: Tree; path: string[]; onClose: () => void; onPin?: (a: Anchor, text: string) => void }) {
  const turns = useStore((s) => s.chats[tree.id]) ?? NO_TURNS;
  const nodes = useStore((s) => s.nodes);
  const docs = useStore((s) => s.docs);
  const ui = useStore((s) => s.ui);
  const { pushChat, patchChat, clearChat, setUI, updateTree } = useStore.getState();
  const [input, setInput] = useState("");
  const [quote, setQuote] = useState<Anchor | null>(null);
  const [busy, setBusy] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const context = useMemo(() => path.map((id) => nodes[id]).filter(Boolean).map((n) => {
    const c = contentOf(n, docs);
    return `### ${c.title}\n${plainText(c).slice(0, 40000)}`;
  }).join("\n\n"), [path, nodes, docs]);
  const quoteTitle = (q: Anchor) => (nodes[q.docId] ? contentOf(nodes[q.docId], docs).title : "");

  const send = async (text: string, q: Anchor | null = quote) => {
    if (busy || (!text.trim() && !q)) return;
    const content = (q ? `> ${q.quote}\n> (${quoteTitle(q)}, p. ${q.page})\n\n` : "") + (text.trim() || "Explain this passage.");
    pushChat(tree.id, { role: "user", text: content, quote: q || undefined });
    setInput(""); setQuote(null); setBusy(true);
    const id = pushChat(tree.id, { role: "assistant", text: "" });
    ctl.current = new AbortController();
    const history = (useStore.getState().chats[tree.id] || []).filter((t) => t.id !== id).slice(-20).map((t) => ({ role: t.role, content: t.text }));
    try { await ask({ title: tree.title, context, messages: history, signal: ctl.current.signal, onText: (t) => patchChat(tree.id, id, { text: t }) }); }
    catch (e) { if ((e as Error).name !== "AbortError") patchChat(tree.id, id, { error: "Couldn't reach Claude. Is the app's server running?" }); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (ui.pendingQuote || ui.pendingAsk) {
      const q = ui.pendingQuote, a = ui.pendingAsk;
      setUI({ pendingQuote: null, pendingAsk: null });
      if (a) send(a, q); else { setQuote(q); inputRef.current?.focus(); }
    }
  }, [ui.pendingQuote, ui.pendingAsk]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.scrollTo({ top: 1e9 }); }, [turns.length, turns[turns.length - 1]?.text]);

  return (
    <aside className="drawer" aria-label="Ask Claude" data-testid="ask">
      <div className="drawer-head"><h2 className="serif">Ask Claude</h2><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
      <p className="muted small drawer-sub">Claude reads the {plural(path.length, "card")} on your current trail.</p>
      <div className="chat-list" ref={listRef}>
        {turns.length === 0 && <p className="muted small">Select a passage and choose Ask, or type a question below.</p>}
        {turns.map((t, i) => (
          <div key={t.id} className={`turn turn-${t.role}`}>
            {t.text ? <Markdown text={t.text} /> : <span className="thinking"><i /><i /><i /></span>}
            {t.error && <p className="error">{t.error}</p>}
            {t.role === "assistant" && t.text && !busy && (
              <div className="turn-actions">
                {turns[i - 1]?.quote && onPin && <button onClick={() => { onPin(turns[i - 1].quote!, t.text); toast("Added as a branch beside the passage"); }}><Pin size={13} />Add as branch</button>}
                {!tree.locked && <button onClick={() => { updateTree(tree.id, { understanding: (tree.understanding.trim() ? tree.understanding.trim() + "\n\n" : "") + t.text }); toast("Added to your understanding note"); }}>Add to understanding</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="composer">
        {quote && <div className="quote-chip"><span className="serif">“{quote.quote}”</span><button aria-label="Remove quote" onClick={() => setQuote(null)}><X size={13} /></button></div>}
        <div className="composer-row">
          <textarea ref={inputRef} rows={2} value={input} placeholder="Ask about anything on this trail…" aria-label="Ask Claude"
            onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
          {busy ? <button className="btn btn-secondary btn-sm" onClick={() => ctl.current?.abort()}><Square size={12} />Stop</button>
            : <button className="btn btn-primary btn-sm" disabled={!input.trim() && !quote} onClick={() => send(input)}>Ask</button>}
        </div>
        {turns.length > 0 && <button className="link-btn small" onClick={() => clearChat(tree.id)}>Clear conversation</button>}
      </div>
    </aside>
  );
}
