// One card in the stack: a reading surface with its own margin of branches, joined to their passages by threads.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from "react";
import { AlertTriangle, ExternalLink, Lock, RotateCw, X } from "lucide-react";
import type { Anchor, Content, Tree, TreeNode } from "../../data/types";
import { useStore } from "../../store/useStore";
import { DocumentSheet, type MarkSpec } from "../reader/DocumentSheet";
import { ThreadLayer, type Thread } from "../reader/ThreadLayer";
import { SELECTION_KEYS, SelectionToolbar, type SelectionAction } from "../reader/SelectionToolbar";
import { BranchCard, KIND_LABEL } from "./BranchCard";
import { AddDialog } from "./AddDialog";
import { markFor, reanchor, selectionAnchor, sentenceAnchorAt } from "../../lib/anchors";
import { readTransfer } from "../../lib/clipboard";
import { bodyBlocks, bodyOffset, contentOf } from "../../lib/content";
import { branchDefinition, branchExplanation, branchFromUrl, loadUrl, noteTitle } from "../../lib/actions";
import { toast } from "../../lib/toast";
import { clamp, plural } from "../../lib/util";
import { isTyping } from "../../lib/hooks";

type Sel = { anchor: Anchor; tx: number; ty: number; hx: number; hy: number };
type Drag = { from: { anchor?: Anchor; nodeId?: string }; x1: number; y1: number; x2: number; y2: number };

interface Props {
  tree: Tree;
  node: TreeNode;
  index: number;
  active: boolean;
  compact: boolean;
  onActivate: () => void;
  onOpen: (childId: string) => void;
  onClose?: () => void;
  onSpine: () => void;
}

export function ReadingCard({ tree, node, index, active, compact, onActivate, onOpen, onClose, onSpine }: Props) {
  const docs = useStore((s) => s.docs);
  const allNodes = useStore((s) => s.nodes);
  const allHighlights = useStore((s) => s.highlights);
  const savedMarginW = useStore((s) => s.ui.marginWidth);
  const { addBranch, updateNode, addAnchor, addHighlight, updateHighlight, removeHighlight, setUI } = useStore.getState();
  const locked = !!tree.locked;
  /** Your own writing can be typed into directly. Sources keep the original's words. */
  const writable = node.kind === "note" && !locked;

  const content: Content = useMemo(() => contentOf(node, docs), [node, docs]);
  const doc = node.docId ? docs[node.docId] : undefined;
  const children = useMemo(() => Object.values(allNodes).filter((n) => n.parentId === node.id).sort((a, b) => a.createdAt - b.createdAt), [allNodes, node.id]);
  const grandCounts = useMemo(() => {
    const c: Record<string, number> = {};
    Object.values(allNodes).forEach((n) => { if (n.parentId) c[n.parentId] = (c[n.parentId] || 0) + 1; });
    return c;
  }, [allNodes]);
  const highlights = useMemo(() => allHighlights.filter((h) => h.nodeId === node.id), [allHighlights, node.id]);
  const marks: MarkSpec[] = useMemo(() => {
    const links: MarkSpec[] = [];
    content.blocks.forEach((b) => b.links?.forEach((l) => links.push({ id: `link|${b.id}|${l.start}|${l.href}`, kind: "weblink", anchors: [{ docId: node.id, blockId: b.id, start: l.start, end: l.end, quote: b.text.slice(l.start, l.end), page: b.page }] })));
    return [
      ...children.map((c) => ({ id: c.id, kind: c.kind, anchors: c.anchors })),
      ...highlights.map((h) => ({ id: h.id, kind: "highlight", anchors: [h.anchor] })),
      ...links,
    ];
  }, [children, highlights, content, node.id]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const marginRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const dragSelRef = useRef<Anchor | null>(null);

  const [sel, setSel] = useState<Sel | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hotId, setHotId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [layout, setLayout] = useState<{ tops: Record<string, number>; threads: Thread[] }>({ tops: {}, threads: [] });
  const [caretY, setCaretY] = useState<number | null>(null);
  const [dropOn, setDropOn] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [hlMenu, setHlMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [branchAt, setBranchAt] = useState<Anchor | null>(null);
  const [writing, setWriting] = useState(writable && !node.body);
  const [draft, setDraft] = useState(node.body || "");
  const writerRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dragMarginW, setDragMarginW] = useState<number | null>(null);
  const marginW = dragMarginW ?? savedMarginW;

  const toCanvas = useCallback((x: number, y: number) => { const r = canvasRef.current!.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }, []);
  const canvasW = () => canvasRef.current?.clientWidth || 900;
  const clearSel = () => { window.getSelection()?.removeAllRanges(); setSel(null); };

  /* ---------- margin layout ---------- */
  const compute = useCallback(() => {
    const canvas = canvasRef.current, margin = marginRef.current, sheet = sheetRef.current;
    if (!canvas || !margin || !sheet) return;
    if (!margin.offsetParent) { setLayout((p) => (p.threads.length ? { tops: {}, threads: [] } : p)); return; }
    const cr = canvas.getBoundingClientRect(), mr = margin.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
    const items = children.map((c) => {
      let y: number | null = null;
      const ends: { x: number; y: number }[] = [];
      for (const a of c.anchors) {
        const m = markFor(sheet, c.id, a.blockId);
        if (!m) continue;
        const r = m.getBoundingClientRect();
        if (y == null) y = r.top - cr.top;
        ends.push({ x: sr.right - cr.left, y: r.top - cr.top + Math.min(r.height, 26) / 2 });
      }
      if (y == null && c.marginY != null) y = c.marginY;
      return { c, y, ends };
    }).filter((o): o is { c: TreeNode; y: number; ends: { x: number; y: number }[] } => o.y != null).sort((p, q) => p.y - q.y);
    const tops: Record<string, number> = {};
    const threads: Thread[] = [];
    const left = mr.left - cr.left;
    const height = (id: string) => cardRefs.current.get(id)?.offsetHeight ?? 90;
    const GAP = 12;
    // Stack cards top to bottom, each at its passage or just below the one before.
    const stack = () => { let floor = 0; for (const o of items) { const t = Math.max(o.y - 6, floor); tops[o.c.id] = t; floor = t + height(o.c.id) + GAP; } };
    // The branch you're working on sits right beside its passage; the others move out of its way.
    const fi = focusId ? items.findIndex((o) => o.c.id === focusId) : -1;
    if (fi < 0) stack();
    else {
      const f = items[fi], ft = Math.max(f.y - 6, 0);
      tops[f.c.id] = ft;
      let floor = ft + height(f.c.id) + GAP;
      for (const o of items.slice(fi + 1)) { const t = Math.max(o.y - 6, floor); tops[o.c.id] = t; floor = t + height(o.c.id) + GAP; }
      let ceil = ft - GAP, fits = true;
      for (const o of items.slice(0, fi).reverse()) { const t = Math.min(o.y - 6, ceil - height(o.c.id)); if (t < 0) { fits = false; break; } tops[o.c.id] = t; ceil = t - GAP; }
      if (!fits) stack();
    }
    for (const o of items) {
      const top = Math.round(tops[o.c.id]);
      tops[o.c.id] = top;
      o.ends.forEach((e, i) => threads.push({ key: `${o.c.id}:${i}`, annId: o.c.id, x1: Math.round(e.x), y1: Math.round(e.y), x2: Math.round(left + 1), y2: Math.round(top + 22) }));
    }
    setLayout((prev) => (JSON.stringify(prev) === JSON.stringify({ tops, threads }) ? prev : { tops, threads }));
  }, [children, focusId]);
  const raf = useRef(0);
  const scheduleLayout = useCallback(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(compute); }, [compute]);
  useLayoutEffect(() => { compute(); }, [compute, editingId, focusId, writing, compact]);
  useEffect(() => {
    const ro = new ResizeObserver(scheduleLayout);
    if (canvasRef.current) ro.observe(canvasRef.current);
    if (sheetRef.current) ro.observe(sheetRef.current);
    document.fonts?.ready.then(scheduleLayout);
    return () => ro.disconnect();
  }, [scheduleLayout]);

  /* ---------- selection ---------- */
  const readSelection = useCallback(() => {
    if (!canvasRef.current || !sheetRef.current) return;
    if (locked) { setSel(null); return; }
    const info = selectionAnchor(content, sheetRef.current);
    if (!info) { setSel(null); return; }
    const c = canvasRef.current.getBoundingClientRect();
    setSel({ anchor: info.anchor, tx: info.rect.left + info.rect.width / 2 - c.left, ty: info.rect.top - c.top, hx: info.endRect.right - c.left, hy: info.endRect.top + info.endRect.height / 2 - c.top });
  }, [content, locked]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onChange = () => { clearTimeout(t); t = setTimeout(() => { if (matchMedia("(pointer: coarse)").matches) readSelection(); }, 400); };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [readSelection]);

  /* ---------- branching ---------- */
  const newNote = (anchors: Anchor[], marginY?: number) => {
    const id = addBranch(tree.id, { kind: "note", title: "Note", parentId: node.id, anchors, body: "", marginY });
    setEditingId(id); setFocusId(id);
    if (compact) setSheetOpen(true);
    return id;
  };
  const act = (a: SelectionAction) => {
    if (!sel) return;
    const an = sel.anchor;
    switch (a) {
      case "highlight": addHighlight(node.id, an); break;
      case "note": newNote([an]); break;
      case "define": { const id = branchDefinition(tree.id, node.id, an); setFocusId(id); if (compact) setSheetOpen(true); break; }
      case "explain": { const id = branchExplanation(tree.id, node.id, an); setFocusId(id); if (compact) setSheetOpen(true); break; }
      case "ask": setUI({ drawer: "ask", pendingQuote: an, focus: false }); break;
      case "branch": setBranchAt(an); break;
    }
    clearSel();
  };

  /* ---------- threads ---------- */
  const finishThread = (from: Drag["from"], cx: number, cy: number) => {
    const el = document.elementFromPoint(cx, cy) as HTMLElement | null;
    if (!el || !canvasRef.current?.contains(el)) return;
    const card = el.closest("[data-branch]") as HTMLElement | null;
    if (from.anchor) {
      const an = from.anchor;
      if (card) { addAnchor(card.dataset.branch!, an); toast("Linked to that branch"); }
      else if (el.closest(".margin")) newNote([an]);
      else if (el.closest(".sheet")) {
        const t = sentenceAnchorAt(content, cx, cy, sheetRef.current!);
        if (t && !(t.blockId === an.blockId && t.start < an.end && t.end > an.start)) newNote([an, t]);
      }
      clearSel();
    } else if (from.nodeId && el.closest(".sheet")) {
      const t = sentenceAnchorAt(content, cx, cy, sheetRef.current!);
      if (t) { addAnchor(from.nodeId, t); toast("Linked to the passage"); }
    }
  };
  const startThread = (from: Drag["from"], x1: number, y1: number, e: RPointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDrag({ from, x1, y1, x2: x1, y2: y1 });
    const move = (ev: PointerEvent) => { const p = toCanvas(ev.clientX, ev.clientY); setDrag((d) => (d ? { ...d, x2: p.x, y2: p.y } : d)); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setDrag(null); finishThread(from, ev.clientX, ev.clientY);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---------- jumping and focusing ---------- */
  const jumpTo = (blockId: string) => {
    const el = document.getElementById(`block-${blockId}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(blockId); setTimeout(() => setFlash(null), 1600);
  };
  const focusBranch = (id: string) => {
    setFocusId(id);
    if (compact) { setSheetOpen(true); return; }
    requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  /* ---------- marks ---------- */
  const markInfo = (t: EventTarget) => {
    const m = (t as HTMLElement).closest?.("mark[data-ann]") as HTMLElement | null;
    return m ? { m, ids: m.dataset.ann!.split(" "), kind: m.dataset.kind } : null;
  };
  const onSheetOver = (e: RMouseEvent) => { const i = markInfo(e.target); if (i) setHotId(i.ids.find((id) => allNodes[id]) || i.ids[0]); };
  const onSheetOut = (e: RMouseEvent) => { if (markInfo(e.target)) setHotId(null); };
  const onSheetClick = (e: RMouseEvent) => {
    if (window.getSelection()?.toString().trim()) return;
    const i = markInfo(e.target); if (!i) return;
    const branch = i.ids.map((id) => allNodes[id]).find(Boolean);
    const link = i.ids.find((id) => id.startsWith("link|"));
    if (branch?.kind === "source") { onOpen(branch.id); return; }
    if (branch) { focusBranch(branch.id); return; }
    if (link) {
      const [, blockId, start, ...rest] = link.split("|");
      const href = rest.join("|");
      if (e.metaKey || e.ctrlKey || locked) { if (locked && children.some((c) => c.url === href)) { onOpen(children.find((c) => c.url === href)!.id); return; } window.open(href, "_blank", "noopener"); return; }
      const b = content.blocks.find((x) => x.id === blockId)!;
      const l = b.links!.find((x) => x.start === Number(start))!;
      const anchor: Anchor = { docId: node.id, blockId, start: l.start, end: l.end, quote: b.text.slice(l.start, l.end), page: b.page };
      const existing = children.find((c) => c.url === href);
      onOpen(existing ? existing.id : branchFromUrl(tree.id, node.id, anchor, href, anchor.quote));
      return;
    }
    const hl = i.ids.find((id) => allHighlights.some((h) => h.id === id));
    if (hl && !locked) { const r = i.m.getBoundingClientRect(), p = toCanvas(r.left, r.bottom); setHlMenu({ id: hl, x: clamp(p.x, 8, canvasW() - 220), y: p.y + 6 }); }
  };

  /* ---------- margin: click, paste, drop ---------- */
  const onMarginClick = (e: RMouseEvent) => {
    if (locked || (e.target as HTMLElement).closest("[data-branch]")) return;
    if (sel) { newNote([sel.anchor]); clearSel(); return; }
    setCaretY(toCanvas(e.clientX, e.clientY).y);
    marginRef.current?.focus();
  };
  const addClipping = (data: NonNullable<ReturnType<typeof readTransfer>>, anchor: Anchor | null, y: number | null) => {
    const id = addBranch(tree.id, {
      kind: "clipping", title: noteTitle(data.text), parentId: node.id, anchors: anchor ? [anchor] : [],
      clip: { text: data.text, source: data.source }, body: "", marginY: anchor ? undefined : y ?? (scrollRef.current?.scrollTop || 0) + 140,
    });
    setEditingId(id); setFocusId(id); setCaretY(null); clearSel();
    toast(data.source.url ? `Clipped from ${data.source.site || "the web"}` : "Clipped. Add a source to the branch.");
  };
  useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => {
      if (locked || isTyping(document.activeElement) || !e.clipboardData) return;
      if (!sel && caretY == null && document.activeElement !== marginRef.current) return;
      const data = readTransfer(e.clipboardData);
      if (!data) return;
      e.preventDefault();
      addClipping(data, sel?.anchor || null, caretY);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });
  const onMarginDragOver = (e: DragEvent) => {
    if (locked) return;
    const t = Array.from(e.dataTransfer.types);
    if (t.includes("text/plain") || t.includes("text/uri-list") || t.includes("application/x-rd-sel")) { e.preventDefault(); setDropOn(true); }
  };
  const onMarginDrop = (e: DragEvent) => {
    e.preventDefault(); setDropOn(false);
    if (Array.from(e.dataTransfer.types).includes("application/x-rd-sel") && dragSelRef.current) { newNote([dragSelRef.current]); dragSelRef.current = null; clearSel(); return; }
    const data = readTransfer(e.dataTransfer);
    if (data) addClipping(data, null, toCanvas(e.clientX, e.clientY).y);
  };

  /* ---------- keyboard (active card only) ---------- */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { clearSel(); setHlMenu(null); setCaretY(null); return; }
      const a = SELECTION_KEYS[e.key.toLowerCase()];
      if (sel && a) { e.preventDefault(); act(a); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------- stretching the margin ---------- */
  const MARGIN_MIN = 220, MARGIN_MAX = 640;
  const startMarginResize = (e: RPointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = marginRef.current?.offsetWidth || 300;
    let w = w0;
    // Dragging left widens the margin (the page gives up the space); dragging right narrows it.
    const move = (ev: PointerEvent) => { w = clamp(w0 + (x0 - ev.clientX), MARGIN_MIN, MARGIN_MAX); setDragMarginW(w); };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setUI({ marginWidth: Math.round(w) }); setDragMarginW(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onGripKey = (e: RKeyboardEvent) => {
    const w = marginRef.current?.offsetWidth || 300;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setUI({ marginWidth: clamp(w + (e.key === "ArrowLeft" ? 20 : -20), MARGIN_MIN, MARGIN_MAX) }); }
    if (e.key === "Home") { e.preventDefault(); setUI({ marginWidth: undefined }); }
  };

  /* ---------- writing in place ---------- */
  const startWriting = (caret?: number) => {
    if (!writable) return;
    const body = node.body || "";
    setDraft(body);
    caretRef.current = caret ?? body.length;
    clearSel(); setHlMenu(null);
    setWriting(true);
  };
  // Saves as you type; there's nothing to confirm.
  const onDraft = (text: string) => {
    setDraft(text);
    updateNode(node.id, { body: text, title: node.parentId ? noteTitle(text) : node.title });
  };
  // Leaving the text tidies it up and keeps branches and highlights attached to the words they were on.
  const finishWriting = () => {
    const body = draft.trim();
    if (body !== (node.body || "")) updateNode(node.id, { body, title: node.parentId ? noteTitle(body) : node.title });
    const blocks = bodyBlocks(node.id, body);
    for (const c of children) {
      const anchors = c.anchors.map((a) => (a.docId === node.id ? reanchor(blocks, a) : a));
      if (anchors.some((a, i) => a !== c.anchors[i])) updateNode(c.id, { anchors });
    }
    for (const h of highlights) { const a = reanchor(blocks, h.anchor); if (a !== h.anchor) updateHighlight(h.id, a); }
    setWriting(false);
  };
  useLayoutEffect(() => {
    const el = writerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, writing]);
  useLayoutEffect(() => {
    const el = writerRef.current;
    if (!writing || !el || caretRef.current == null) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  }, [writing]);
  /** A plain click in your writing puts the cursor there; dragging still selects text to branch from. */
  const onSheetMouseUp = (e: RMouseEvent) => {
    const target = e.target as HTMLElement;
    setTimeout(() => {
      readSelection();
      if (!writable || writing || e.button !== 0) return;
      const s = window.getSelection();
      if (s && !s.isCollapsed) return;
      if (target.closest("mark, button, a, input, textarea, .card-head")) return;
      const blockEl = target.closest("[data-block]") as HTMLElement | null;
      if (blockEl && s?.anchorNode && blockEl.contains(s.anchorNode)) {
        const r = document.createRange();
        r.setStart(blockEl, 0); r.setEnd(s.anchorNode, s.anchorOffset);
        const index = content.blocks.findIndex((b) => b.id === blockEl.dataset.block);
        startWriting(bodyOffset(node.body || "", index, r.toString().length));
      } else startWriting();
    }, 0);
  };

  const branchProps = (c: TreeNode) => ({
    node: c, editing: editingId === c.id, focused: focusId === c.id, hot: hotId === c.id, childCount: grandCounts[c.id] || 0,
    onOpen: () => onOpen(c.id),
    onHover: (on: boolean) => setHotId(on ? c.id : null),
    onEdit: () => { setEditingId(c.id); setFocusId(c.id); },
    onDone: () => setEditingId(null),
    locked,
    onAsk: () => setUI({ drawer: "ask", pendingQuote: c.anchors[0] || null, focus: false }),
    onThreadStart: (e: RPointerEvent) => { const p = toCanvas(e.clientX, e.clientY); startThread({ nodeId: c.id }, p.x, p.y, e); },
    onJump: jumpTo,
    onResize: scheduleLayout,
  });

  const kindLabel = node.parentId ? KIND_LABEL[node.kind] : "Seed";
  const meta = doc ? [doc.site, doc.authors, doc.format !== "web" ? doc.format.toUpperCase() : "", doc.pages > 1 ? plural(doc.pages, "page") : ""].filter(Boolean).join(" · ") : node.kind === "note" ? "Your writing" : "";
  const url = node.url || doc?.url;
  const header = (
    <header className="card-head">
      <div className="card-kicker mono-label"><span className={`kdot k-${node.kind}`} />{kindLabel}{meta ? <span className="muted"> · {meta}</span> : null}{locked && <span className="muted card-locked"> · <Lock size={11} aria-hidden />Locked</span>}</div>
      <h1 className="serif">{node.kind === "definition" || node.kind === "explanation" ? node.title : content.title}</h1>
      <div className="card-actions">
        {url && <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noopener"><ExternalLink size={13} />Original</a>}
      </div>
      {doc?.warning && <p className="card-warning"><AlertTriangle size={13} />{doc.warning}</p>}
    </header>
  );

  return (
    <section className={`card${active ? " active" : ""}`} data-testid="card" data-coach={index === 0 ? "card" : undefined} data-node={node.id} aria-label={content.title} onMouseDownCapture={onActivate} onFocusCapture={onActivate}>
      <button className="spine" onClick={onSpine} aria-label={`Go to card ${index + 1}: ${content.title}`} title={content.title}>
        <span className="spine-n tabular">{index + 1}</span>
        <span className="spine-title">{content.title}</span>
      </button>
      {onClose && <button className="card-close icon-btn" aria-label="Close this card and the ones after it" onClick={onClose}><X size={15} /></button>}
      <div className="card-scroll" ref={scrollRef} onScroll={() => setHlMenu(null)}>
        {node.kind === "source" && !doc ? (
          <div className="card-loading">
            {header}
            {node.pending ? <p className="muted"><span className="thinking"><i /><i /><i /></span> Opening {node.url}…</p>
              : <div className="card-failed"><p>{node.error || "This page didn't finish opening."}</p><div className="row"><button className="btn btn-secondary btn-sm" onClick={() => loadUrl(node.id)}><RotateCw size={13} />Try again</button>{url && <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noopener"><ExternalLink size={13} />Open in browser</a>}</div></div>}
          </div>
        ) : (
          <div className={`canvas${dragMarginW != null ? " resizing" : ""}`} ref={canvasRef} style={marginW ? ({ "--margin-w": `${marginW}px` } as CSSProperties) : undefined}
            onMouseDown={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest(".sheet") && !t.closest("mark")) setSel(null);
              if (!t.closest(".hl-menu")) setHlMenu(null);
              if (!t.closest("[data-branch]")) setFocusId(null);
            }}>
            <div className={`sheet-wrap${writable ? " writable" : ""}`} ref={sheetRef}
              onMouseUp={onSheetMouseUp}
              onMouseOver={onSheetOver} onMouseOut={onSheetOut} onClick={onSheetClick}
              onDragStart={(e) => { if (sel) { dragSelRef.current = sel.anchor; e.dataTransfer.setData("application/x-rd-sel", "1"); } }}>
              {writing ? (
                <article className="sheet writing">
                  {header}
                  <textarea ref={writerRef} className="body-editor serif" autoFocus value={draft} onChange={(e) => onDraft(e.target.value)} onBlur={finishWriting} aria-label="Your writing"
                    placeholder="Write the idea in your own words. Blank lines start new paragraphs; you can branch from any sentence afterwards."
                    onKeyDown={(e) => { if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); e.currentTarget.blur(); } }} />
                  <p className="muted small writing-hint">Saved as you type. Click outside the text, or press Esc, to highlight and branch.</p>
                </article>
              ) : (
                <>
                  <DocumentSheet content={content} marks={marks} hotId={hotId || focusId} flashBlockId={flash} showPages={!!doc && doc.pages > 1} header={header} />
                  {writable && <button className="write-tail" onClick={() => startWriting()}>Keep writing…</button>}
                </>
              )}
            </div>

            <aside className={`margin${dropOn ? " drop-on" : ""}${drag?.from.anchor ? " drop-target" : ""}`} ref={marginRef} tabIndex={-1} data-testid="margin" data-coach={index === 0 ? "margin" : undefined}
              aria-label="Branches" onClick={onMarginClick} onDragOver={onMarginDragOver} onDragLeave={() => setDropOn(false)} onDrop={onMarginDrop}>
              <div className="margin-grip" role="separator" aria-orientation="vertical" aria-label="Stretch the margin" title="Drag to stretch the cards. Double-click to reset."
                tabIndex={0} aria-valuenow={Math.round(marginW || marginRef.current?.offsetWidth || 300)} aria-valuemin={MARGIN_MIN} aria-valuemax={MARGIN_MAX}
                onPointerDown={startMarginResize} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); setUI({ marginWidth: undefined }); }} onKeyDown={onGripKey} />
              {children.length === 0 && caretY == null && !drag && <p className="margin-empty">Select any text to branch from it: a note, a definition, another source. Or paste something here.</p>}
              {(drag?.from.anchor || dropOn) && <div className="margin-drop-hint">Drop to add a note</div>}
              {caretY != null && <div className="margin-caret" style={{ top: caretY }}>Paste (⌘V) or drop a clipping here</div>}
              {children.map((c) => <BranchCard key={c.id} {...branchProps(c)} top={layout.tops[c.id] ?? -9999} setRef={(el) => { if (el) cardRefs.current.set(c.id, el); else cardRefs.current.delete(c.id); }} />)}
            </aside>

            <ThreadLayer threads={layout.threads} hotId={hotId || focusId} drag={drag} />

            {sel && !drag && (
              <>
                <SelectionToolbar x={clamp(sel.tx, 200, canvasW() - 200)} y={Math.max(4, sel.ty - 50)} onAction={act} />
                <button className="thread-handle sel-handle" data-testid="thread-handle" style={{ left: sel.hx + 4, top: sel.hy - 6 }}
                  aria-label="Drag into the margin to write a linked note" title="Drag into the margin, onto a branch, or onto another sentence"
                  onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => startThread({ anchor: sel.anchor }, sel.hx + 10, sel.hy, e)} />
              </>
            )}
            {hlMenu && (
              <div className="popover hl-menu" style={{ left: hlMenu.x, top: hlMenu.y }}>
                <button onClick={() => { const h = allHighlights.find((x) => x.id === hlMenu.id); if (h) { removeHighlight(h.id); newNote([h.anchor]); } setHlMenu(null); }}>Add a note</button>
                <button onClick={() => { const h = allHighlights.find((x) => x.id === hlMenu.id); if (h) { setBranchAt(h.anchor); } setHlMenu(null); }}>Branch from here…</button>
                <button className="danger" onClick={() => { removeHighlight(hlMenu.id); setHlMenu(null); }}>Remove highlight</button>
              </div>
            )}
          </div>
        )}
      </div>

      {compact && children.length > 0 && !sheetOpen && <button className="branches-fab" onClick={() => setSheetOpen(true)}>{plural(children.length, "branch", "branches")}</button>}
      {compact && sheetOpen && (
        <div className="bottom-sheet" role="dialog" aria-label="Branches">
          <div className="bs-head"><span className="serif">Branches</span><span className="muted">{content.title}</span><button className="icon-btn" aria-label="Close" onClick={() => setSheetOpen(false)}><X size={16} /></button></div>
          <div className="bs-list">{children.map((c) => <BranchCard key={c.id} {...branchProps(c)} inline onOpen={() => { setSheetOpen(false); onOpen(c.id); }} />)}</div>
        </div>
      )}

      {branchAt && <AddDialog mode="branch" anchor={branchAt} onClose={() => setBranchAt(null)} onCreated={(id) => { setBranchAt(null); onOpen(id); }} treeId={tree.id} parentId={node.id} />}
    </section>
  );
}
