// One card in the stack: a reading surface with its own margin of branches, joined to their passages by threads.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from "react";
import { AlertTriangle, GripHorizontal, ChevronLeft, ChevronRight, ExternalLink, GitBranch, ListTree, Lock, NotebookPen, RotateCw, X } from "lucide-react";
import type { Anchor, Content, Tree, TreeNode } from "../../data/types";
import { useStore } from "../../store/useStore";
import { DocumentSheet, type MarkSpec } from "../reader/DocumentSheet";
import { OriginalPages } from "../reader/OriginalPages";
import { Segmented } from "../ui";
import { ThreadLayer, type Thread } from "../reader/ThreadLayer";
import { SELECTION_KEYS, SelectionToolbar, type SelectionAction } from "../reader/SelectionToolbar";
import { BranchCard, KIND_LABEL, kindClass } from "./BranchCard";
import { AddDialog } from "./AddDialog";
import { ContentsPanel } from "./ContentsPanel";
import { contentsLinks, contentsOf, currentEntry } from "../../lib/contents";
import { markFor, reanchor, selectionAnchor, sentenceAnchorAt } from "../../lib/anchors";
import { readTransfer } from "../../lib/clipboard";
import { bodyBlocks, bodyOffset, contentOf } from "../../lib/content";
import { quoteToEssay, branchAsk, branchDefinition, branchExplanation, branchWikipedia, loadUrl, noteTitle } from "../../lib/actions";
import { toast } from "../../lib/toast";
import { clamp, plural } from "../../lib/util";
import { isTyping } from "../../lib/hooks";
import { trackOf } from "../../lib/tracks";
import { parseCite } from "../../lib/writing";

/** Space between a margin and the reading column beyond it. */
const COL_GAP = 24;

type Sel = { anchor: Anchor; tx: number; ty: number; hx: number; hy: number };
type Drag = { from: { anchor?: Anchor; nodeId?: string; relink?: number }; x1: number; y1: number; x2: number; y2: number };

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
  const branchesOpen = useStore((s) => !!s.ui.branchesOpen);
  const readingBeside = useStore((s) => s.ui.readingBeside ?? null);
  const { addBranch, updateNode, addAnchor, removeAnchor, replaceAnchor, addHighlight, updateHighlight, removeHighlight, setUI } = useStore.getState();
  const locked = !!tree.locked;
  /** Your own writing can be typed into directly. Sources keep the original's words. */
  const writable = node.kind === "note" && !locked;

  const content: Content = useMemo(() => contentOf(node, docs), [node, docs]);
  const doc = node.docId ? docs[node.docId] : undefined;
  /** A PDF can be read as text or as its original pages (figures, tables, layout). */
  const originalOn = useStore((s) => !!(doc?.hasOriginal && s.ui.originalView?.[doc.id]));
  const setOriginal = (on: boolean) => { if (doc) setUI({ originalView: { ...useStore.getState().ui.originalView, [doc.id]: on } }); };
  const children = useMemo(() => Object.values(allNodes).filter((n) => n.parentId === node.id).sort((a, b) => a.createdAt - b.createdAt), [allNodes, node.id]);
  const grandCounts = useMemo(() => {
    const c: Record<string, number> = {};
    Object.values(allNodes).forEach((n) => { if (n.parentId) c[n.parentId] = (c[n.parentId] || 0) + 1; });
    return c;
  }, [allNodes]);
  const toc = useMemo(() => contentsOf(doc), [doc]);
  const tocLinks = useMemo(() => contentsLinks(content.blocks, toc), [content.blocks, toc]);
  const highlights = useMemo(() => allHighlights.filter((h) => h.nodeId === node.id), [allHighlights, node.id]);
  const marks: MarkSpec[] = useMemo(() => {
    const links: MarkSpec[] = [];
    // A quotation's source line is set in italics.
    content.blocks.forEach((b) => { if (b.attrib != null) links.push({ id: `attrib|${b.id}`, kind: "attrib", anchors: [{ docId: node.id, blockId: b.id, start: b.attrib, end: b.text.length, quote: b.text.slice(b.attrib), page: b.page }] }); });
    content.blocks.forEach((b) => b.links?.forEach((l) => links.push({ id: `link|${b.id}|${l.start}|${l.href}`, kind: "weblink", anchors: [{ docId: node.id, blockId: b.id, start: l.start, end: l.end, quote: b.text.slice(l.start, l.end), page: b.page }] })));
    // The printed contents page: each title it lists jumps to that part.
    tocLinks.forEach((l) => {
      const b = content.blocks.find((x) => x.id === l.blockId)!;
      links.push({ id: `link|${l.blockId}|${l.start}|#${l.target}`, kind: "toclink", anchors: [{ docId: node.id, blockId: l.blockId, start: l.start, end: l.end, quote: b.text.slice(l.start, l.end), page: b.page }] });
    });
    return [
      ...children.map((c) => ({ id: c.id, kind: kindClass(c), anchors: c.anchors })),
      ...highlights.map((h) => ({ id: h.id, kind: "highlight", anchors: [h.anchor] })),
      ...links,
    ];
  }, [children, highlights, content, node.id, tocLinks]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const marginRef = useRef<HTMLDivElement>(null);
  const marginLeftRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const dragSelRef = useRef<Anchor | null>(null);

  const [sel, setSel] = useState<Sel | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [hotId, setHotId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [layout, setLayout] = useState<{ tops: Record<string, number>; threads: Thread[]; leftOn: boolean; padL?: number; colSide?: "left" | "right" | null; colH?: number }>({ tops: {}, threads: [], leftOn: false });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [caretY, setCaretY] = useState<number | null>(null);
  const [caretSide, setCaretSide] = useState<"left" | "right">("right");
  const [dropOn, setDropOn] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [hlMenu, setHlMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [branchAt, setBranchAt] = useState<Anchor | null>(null);
  const [writing, setWriting] = useState(writable && !node.body);
  const [draft, setDraft] = useState(node.body || "");
  const writerRef = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [tocHere, setTocHere] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragMarginW, setDragMarginW] = useState<number | null>(null);
  const marginW = dragMarginW ?? savedMarginW;
  /** Read view zoom. The page and its margins are scaled as one (CSS zoom), so on-screen distances are divided by it to get page units. */
  const zoom = useStore((s) => (compact ? 1 : s.ui.readZoom ?? 1));
  const sheetWidth = useStore((s) => (compact ? undefined : s.ui.sheetWidth));
  const sheetShift = useStore((s) => (compact ? 0 : s.ui.sheetShift ?? 0));
  const [livePage, setLivePage] = useState<{ w?: number; x: number } | null>(null);
  const pageW = livePage?.w ?? sheetWidth, pageX = livePage?.x ?? sheetShift;
  /** Drag the page's grip to slide it sideways, or its edge to make it wider or narrower. Double-click either to reset. */
  const startPageDrag = (mode: "move" | "size") => (e: RPointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, z = zRef.current;
    const w0 = sheetRef.current?.offsetWidth || 680, s0 = sheetShift;
    let next = { w: sheetWidth, x: s0 };
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / z;
      // Widening from the right edge keeps the left edge still: the page grows by dx and shifts by half of it.
      next = mode === "move" ? { w: sheetWidth, x: Math.round(clamp(s0 + dx, -4000, 4000)) } : { w: Math.round(clamp(w0 + dx, 360, 1200)), x: Math.round(clamp(s0 + dx / 2, -4000, 4000)) };
      setLivePage(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setUI({ sheetWidth: next.w, sheetShift: next.x }); setLivePage(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const zRef = useRef(zoom);
  zRef.current = zoom;

  const toCanvas = useCallback((x: number, y: number) => { const r = canvasRef.current!.getBoundingClientRect(); const z = zRef.current; return { x: (x - r.left) / z, y: (y - r.top) / z }; }, []);
  const canvasW = () => canvasRef.current?.clientWidth || 900;
  const clearSel = () => { window.getSelection()?.removeAllRanges(); setSel(null); };

  /* ---------- margin layout ---------- */
  /** Which margin a branch is shown in: its own side, or the right when the left margin is hidden (narrow cards). */
  const sideOf = useCallback((c: TreeNode, leftOn: boolean): "left" | "right" => (c.side === "left" && leftOn ? "left" : "right"), []);
  const compute = useCallback(() => {
    const canvas = canvasRef.current, margin = marginRef.current, sheet = sheetRef.current, marginL = marginLeftRef.current;
    if (!canvas || !margin || !sheet) return;
    if (!margin.offsetParent) { setLayout((p) => (p.threads.length ? { tops: {}, threads: [], leftOn: p.leftOn } : p)); return; }
    const leftOn = !!marginL?.offsetParent;
    const cr = canvas.getBoundingClientRect(), mr = margin.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
    const z = zRef.current;
    const ml = leftOn ? marginL!.getBoundingClientRect() : null;
    const all = children.map((c) => {
      let y: number | null = null;
      const ys: { y: number; i: number }[] = [];
      for (const [i, a] of c.anchors.entries()) {
        const m = markFor(sheet, c.id, a.blockId);
        if (!m) continue;
        const r = m.getBoundingClientRect();
        if (y == null) y = (r.top - cr.top) / z;
        ys.push({ y: (r.top - cr.top + Math.min(r.height, 26) / 2) / z, i });
      }
      if (y == null && c.marginY != null) y = c.marginY;
      // While you type on the page its links aren't drawn, so linked cards keep the place they had.
      if (y == null && writing && layoutRef.current.tops[c.id] != null) y = layoutRef.current.tops[c.id] + 6;
      return { c, y, ys: writing ? [] : ys, side: sideOf(c, leftOn) };
    }).filter((o): o is { c: TreeNode; y: number; ys: { y: number; i: number }[]; side: "left" | "right" } => o.y != null).sort((p, q) => p.y - q.y);
    const tops: Record<string, number> = {};
    const threads: Thread[] = [];
    let padL = 0;
    const height = (id: string) => cardRefs.current.get(id)?.offsetHeight ?? 90;
    const GAP = 12;
    // Each margin is laid out on its own: cards stack top to bottom, each at its passage or just below the one before.
    // The source you're reading gets a column of its own beyond its margin, as tall as the window, following you as you scroll.
    const col = all.find((o) => o.c.id === readingBeside && o.c.kind === "source" && !compact);
    let colSide: "left" | "right" | null = null, colH = 0;
    if (col) {
      colSide = col.side;
      const box = scrollRef.current, viewTop = (box?.scrollTop ?? 0) / z, viewH = (box?.clientHeight ?? 800) / z;
      colH = Math.round(Math.max(320, viewH - 24));
      const top = Math.round(Math.max(viewTop + 12, 0));
      tops[col.c.id] = top;
      const m = colSide === "left" ? ml! : mr;
      const x1 = (colSide === "left" ? sr.left - cr.left : sr.right - cr.left) / z;
      const x2 = colSide === "left" ? (m.left - cr.left) / z - COL_GAP : (m.right - cr.left) / z + COL_GAP;
      col.ys.forEach(({ y, i }) => threads.push({ key: `${col.c.id}:${i}`, annId: col.c.id, ai: i, kind: kindClass(col.c), x1: Math.round(x1), y1: Math.round(y), x2: Math.round(x2), y2: Math.round(Math.min(Math.max(y, top + 22), top + colH - 22)) }));
    }
    for (const side of ["left", "right"] as const) {
      const items = all.filter((o) => o.side === side && o !== col);
      // A narrow card hides the left margin; its branches move to the right one, so there's nothing to lay out here.
      if (!items.length || (side === "left" && !ml)) continue;
      // A card you dragged up or down moves by that much from wherever it would otherwise sit; the ones below make room.
      const dy = (o: { c: TreeNode }) => o.c.nudge?.dy || 0;
      const stack = () => { let floor = 0; for (const o of items) { const t = Math.max(0, Math.max(o.y - 6, floor) + dy(o)); tops[o.c.id] = t; floor = Math.max(floor, t + height(o.c.id) + GAP); } };
      // The branch you're working on sits right beside its passage; the others move out of its way.
      const fi = focusId ? items.findIndex((o) => o.c.id === focusId) : -1;
      if (fi < 0) stack();
      else {
        const f = items[fi], ft = Math.max(f.y - 6 + dy(f), 0);
        tops[f.c.id] = ft;
        let floor = ft + height(f.c.id) + GAP;
        for (const o of items.slice(fi + 1)) { const t = Math.max(0, Math.max(o.y - 6, floor) + dy(o)); tops[o.c.id] = t; floor = Math.max(floor, t + height(o.c.id) + GAP); }
        let ceil = ft - GAP, fits = true;
        for (const o of items.slice(0, fi).reverse()) { const t = Math.min(o.y - 6 + dy(o), ceil - height(o.c.id)); if (t < 0) { fits = false; break; } tops[o.c.id] = t; ceil = t - GAP; }
        if (!fits) stack();
      }
      // Threads leave the page from the edge nearest the card's margin.
      const x1 = (side === "left" ? sr.left - cr.left : sr.right - cr.left) / z;
      const x2 = side === "left" ? (ml!.right - cr.left) / z - 1 : (mr.left - cr.left) / z + 1;
      for (const o of items) {
        const top = Math.round(tops[o.c.id]);
        tops[o.c.id] = top;
        // A card dragged further from the page takes its thread with it.
        const away = o.c.nudge?.away || 0, cx2 = x2 + (side === "left" ? -away : away);
        o.ys.forEach(({ y, i }) => threads.push({ key: `${o.c.id}:${i}`, annId: o.c.id, ai: i, kind: kindClass(o.c), x1: Math.round(x1), y1: Math.round(y), x2: Math.round(cx2), y2: Math.round(top + 22) }));
      }
    }
    // Anything pushed out past the left edge (a card dragged far out, a stretched card, the page slid left) can't be
    // scrolled to, so the canvas grows on the left until it all fits; when it's brought back, the room goes again.
    let minLeft = (sr.left - cr.left) / z;
    cardRefs.current.forEach((el) => { if (el.offsetParent) minLeft = Math.min(minLeft, (el.getBoundingClientRect().left - cr.left) / z); });
    const EDGE = 16, prevPad = layoutRef.current.padL || 0;
    padL = Math.max(0, prevPad + EDGE - minLeft);
    const next = { tops, threads, leftOn, padL: Math.ceil(padL), colSide, colH };
    setLayout((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [children, focusId, sideOf, writing, readingBeside, compact]);
  const raf = useRef(0);
  const scheduleLayout = useCallback(() => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(compute); }, [compute]);
  useLayoutEffect(() => { compute(); }, [compute, editingId, focusId, writing, compact, branchesOpen, layout.leftOn, layout.padL, zoom, readingBeside, pageW, pageX, originalOn]);
  useEffect(() => {
    const ro = new ResizeObserver(scheduleLayout);
    if (canvasRef.current) ro.observe(canvasRef.current);
    if (sheetRef.current) ro.observe(sheetRef.current);
    // The margins appear and disappear (branches shown, writing mode, a narrow window), and branch cards change size
    // (an article opening, a resize): any of these moves where the cards belong.
    if (marginRef.current) ro.observe(marginRef.current);
    if (marginLeftRef.current) ro.observe(marginLeftRef.current);
    cardRefs.current.forEach((el) => ro.observe(el));
    document.fonts?.ready.then(scheduleLayout);
    return () => ro.disconnect();
  }, [scheduleLayout, children]);

  /* ---------- selection ---------- */
  const readSelection = useCallback(() => {
    if (!canvasRef.current || !sheetRef.current) return;
    if (locked) { setSel(null); return; }
    const info = selectionAnchor(content, sheetRef.current);
    if (!info) { setSel(null); return; }
    const c = canvasRef.current.getBoundingClientRect(), z = zRef.current;
    setSel({ anchor: info.anchor, tx: (info.rect.left + info.rect.width / 2 - c.left) / z, ty: (info.rect.top - c.top) / z, hx: (info.endRect.right - c.left) / z, hy: (info.endRect.top + info.endRect.height / 2 - c.top) / z });
  }, [content, locked]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const onChange = () => { clearTimeout(t); t = setTimeout(() => { if (matchMedia("(pointer: coarse)").matches) readSelection(); }, 400); };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [readSelection]);

  /* ---------- branching ---------- */
  /** Show a branch you just made or picked: in the margin on a wide screen, in the sheet on a phone. */
  const reveal = () => { if (compact) setSheetOpen(true); else if (!branchesOpen) setUI({ branchesOpen: true }); };
  const newNote = (anchors: Anchor[], marginY?: number, side?: "left" | "right") => {
    const id = addBranch(tree.id, { kind: "note", title: "Note", parentId: node.id, anchors, body: "", marginY, side });
    setEditingId(id); setFocusId(id);
    reveal();
    return id;
  };
  /** The margin nearest the selection: passages in the left half of the page branch to the left. */
  const sideNear = (x: number): "left" | "right" => {
    const sheet = sheetRef.current, canvas = canvasRef.current;
    if (!sheet || !canvas) return "right";
    const sr = sheet.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    return x < (sr.left - cr.left + sr.width / 2) / zRef.current ? "left" : "right";
  };
  const act = (a: SelectionAction) => {
    if (!sel) return;
    const an = sel.anchor;
    const side = sideNear(sel.tx);
    /** A branch made from the selection: put it in the margin nearest the passage and show it. */
    const place = (id: string) => { updateNode(id, { side }); setFocusId(id); reveal(); };
    switch (a) {
      case "highlight": addHighlight(node.id, an); break;
      case "note": newNote([an], undefined, side); break;
      case "define": place(branchDefinition(tree.id, node.id, an)); break;
      case "explain": place(branchExplanation(tree.id, node.id, an)); break;
      case "wikipedia": place(branchWikipedia(tree.id, node.id, an)); break;
      case "ask": place(branchAsk(tree.id, node.id, an)); break;
      case "branch": setBranchAt(an); break;
      case "cite": {
        const where = quoteToEssay(tree.id, an, { title: content.title, site: doc?.site });
        if (where === "writing") setUI({ drawer: "understanding", focus: false });
        toast(where === "root" ? "Quoted at the end of your essay, with its source" : "Quoted in your writing, with its source");
        break;
      }
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
      else if (el.closest(".margin")) newNote([an], undefined, (el.closest(".margin") as HTMLElement).dataset.side === "left" ? "left" : "right");
      else if (el.closest(".sheet")) {
        const t = sentenceAnchorAt(content, cx, cy, sheetRef.current!);
        if (t && !(t.blockId === an.blockId && t.start < an.end && t.end > an.start)) newNote([an, t]);
      }
      clearSel();
    } else if (from.nodeId && from.relink != null) {
      // A link's end dragged onto another sentence moves the link there.
      const t = el.closest(".sheet") ? sentenceAnchorAt(content, cx, cy, sheetRef.current!) : null;
      if (t) { replaceAnchor(from.nodeId, from.relink, t); toast("Moved the link"); }
    } else if (from.nodeId && el.closest(".sheet")) {
      const t = sentenceAnchorAt(content, cx, cy, sheetRef.current!);
      if (t) { addAnchor(from.nodeId, t); toast("Linked to the passage"); }
    }
  };
  const startThread = (from: Drag["from"], x1: number, y1: number, e: RPointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    // Pulling a thread from a passage needs somewhere to land: open the margin.
    if (from.anchor && !compact && !branchesOpen) setUI({ branchesOpen: true });
    setDrag({ from, x1, y1, x2: x1, y2: y1 });
    const move = (ev: PointerEvent) => { const p = toCanvas(ev.clientX, ev.clientY); setDrag((d) => (d ? { ...d, x2: p.x, y2: p.y } : d)); };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setDrag(null); finishThread(from, ev.clientX, ev.clientY);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** Grab the dot where a thread meets the page: drag it to another sentence to move the link, or click it to unlink. */
  const [linkMenu, setLinkMenu] = useState<{ nodeId: string; ai: number; x: number; y: number } | null>(null);
  const grabLink = (t: Thread, e: RPointerEvent) => {
    if (locked || t.ai == null) return;
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      moved = true;
      const p = toCanvas(ev.clientX, ev.clientY);
      setDrag({ from: { nodeId: t.annId, relink: t.ai }, x1: t.x2, y1: t.y2, x2: p.x, y2: p.y });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      setDrag(null);
      if (moved) finishThread({ nodeId: t.annId, relink: t.ai }, ev.clientX, ev.clientY);
      else setLinkMenu({ nodeId: t.annId, ai: t.ai!, x: t.x1, y: t.y1 + 8 });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---------- jumping and focusing ---------- */
  const jumpTo = (blockId: string, block: ScrollLogicalPosition = "center") => {
    const el = document.getElementById(`block-${blockId}`);
    if (!el) return;
    el.scrollIntoView({ block, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setFlash(blockId); setTimeout(() => setFlash(null), 1600);
  };
  // A link in your writing or the notebook asked for a passage on this card: scroll to it once the card has slid into place.
  const jumpReq = useStore((s) => (s.ui.jumpTo?.nodeId === node.id ? s.ui.jumpTo.blockId : null));
  useEffect(() => {
    if (!jumpReq) return;
    const t = setTimeout(() => { jumpTo(jumpReq); setUI({ jumpTo: null }); }, 380);
    return () => clearTimeout(t);
  }, [jumpReq]); // eslint-disable-line react-hooks/exhaustive-deps
  const focusBranch = (id: string) => {
    setFocusId(id);
    reveal();
    if (compact) return;
    requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  /* ---------- contents ---------- */
  /** Which part of the book is at the top of the card, so the contents can show where you are. */
  const tocRaf = useRef(0);
  const trackContents = useCallback(() => {
    cancelAnimationFrame(tocRaf.current);
    tocRaf.current = requestAnimationFrame(() => {
      const box = scrollRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const room = box.scrollHeight - box.clientHeight;
      setProgress(room > 0 ? Math.min(1, box.scrollTop / room) : 1);
      // At the very end there is nothing left to scroll, so the last part in view is the one being read.
      const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
      const line = atEnd ? r.bottom : r.top + 140;
      if (!toc.length) return;
      let here: string | null = null;
      for (const t of toc) {
        const el = document.getElementById(`block-${t.blockId}`);
        if (el && el.getBoundingClientRect().top <= line) here = t.blockId;
      }
      setTocHere(currentEntry(content.blocks, toc, here ?? toc[0].blockId));
    });
  }, [toc, content.blocks]);
  useEffect(() => { trackContents(); }, [trackContents]);
  /** Summaries of each part, keyed by the block the part starts on. */
  const summaries = useMemo(() => {
    const m: Record<string, TreeNode[]> = {};
    children.forEach((c) => { if (c.summary && c.anchors[0]) (m[c.anchors[0].blockId] ||= []).push(c); });
    return m;
  }, [children]);
  /** Write a summary of a part (or the whole source when it has no parts). An existing one opens instead. */
  const summarise = (blockId: string | null) => {
    const b = content.blocks.find((x) => x.id === blockId) || content.blocks[0];
    if (!b) return;
    const existing = summaries[b.id]?.[0];
    if (existing) { setUI({ popup: existing.id }); return; }
    const part = toc.find((t) => t.blockId === b.id)?.title;
    const id = addBranch(tree.id, {
      kind: "note", summary: true, title: `Summary: ${part || content.title}`.slice(0, 120), parentId: node.id, body: "",
      anchors: [{ docId: node.id, blockId: b.id, start: 0, end: b.text.length, quote: b.text, page: b.page }],
    });
    setUI({ popup: id });
  };
  const partIndex = toc.findIndex((t) => t.blockId === tocHere);
  const part = partIndex >= 0 ? toc[partIndex] : null;
  const jumpToPart = (blockId: string) => {
    jumpTo(blockId, "start");
    setTocHere(blockId);
    if (compact) setTocOpen(false);
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
      // A quotation's source: open that source at the quoted passage.
      const cite = parseCite(href);
      if (cite) { setUI({ goPassage: cite }); return; }
      if (href.startsWith("#")) { jumpTo(href.slice(1), "start"); return; }
      if (e.metaKey || e.ctrlKey || locked) { if (locked && children.some((c) => c.url === href)) { onOpen(children.find((c) => c.url === href)!.id); return; } window.open(href, "_blank", "noopener"); return; }
      const b = content.blocks.find((x) => x.id === blockId)!;
      const l = b.links!.find((x) => x.start === Number(start))!;
      const anchor: Anchor = { docId: node.id, blockId, start: l.start, end: l.end, quote: b.text.slice(l.start, l.end), page: b.page };
      // Links open in the reader over the workspace; one you've already kept opens as its card.
      const existing = children.find((c) => c.url === href);
      if (existing) onOpen(existing.id);
      else setUI({ reader: { url: href, title: anchor.quote, treeId: tree.id, parentId: node.id, anchor: locked ? null : anchor } });
      return;
    }
    const hl = i.ids.find((id) => allHighlights.some((h) => h.id === id));
    if (hl && !locked) { const r = i.m.getBoundingClientRect(), p = toCanvas(r.left, r.bottom); setHlMenu({ id: hl, x: clamp(p.x, 8, canvasW() - 220), y: p.y + 6 }); }
  };

  /* ---------- margin: click, paste, drop ---------- */
  const onMarginClick = (side: "left" | "right") => (e: RMouseEvent) => {
    if (locked || (e.target as HTMLElement).closest("[data-branch]")) return;
    if (sel) { newNote([sel.anchor], undefined, side); clearSel(); return; }
    setCaretY(toCanvas(e.clientX, e.clientY).y); setCaretSide(side);
    (side === "left" ? marginLeftRef : marginRef).current?.focus();
  };
  const addClipping = (data: NonNullable<ReturnType<typeof readTransfer>>, anchor: Anchor | null, y: number | null, side: "left" | "right" = "right") => {
    const id = addBranch(tree.id, {
      kind: "clipping", title: noteTitle(data.text), parentId: node.id, anchors: anchor ? [anchor] : [], side,
      clip: { text: data.text, source: data.source }, body: "", marginY: anchor ? undefined : y ?? (scrollRef.current?.scrollTop || 0) + 140,
    });
    setEditingId(id); setFocusId(id); setCaretY(null); clearSel(); reveal();
    toast(data.source.url ? `Clipped from ${data.source.site || "the web"}` : "Clipped. Add a source to the branch.");
  };
  useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => {
      if (locked || isTyping(document.activeElement) || !e.clipboardData) return;
      if (!sel && caretY == null && document.activeElement !== marginRef.current && document.activeElement !== marginLeftRef.current) return;
      const data = readTransfer(e.clipboardData);
      if (!data) return;
      e.preventDefault();
      addClipping(data, sel?.anchor || null, caretY, sel ? sideNear(sel.tx) : caretY != null ? caretSide : document.activeElement === marginLeftRef.current ? "left" : "right");
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });
  const onMarginDragOver = (e: DragEvent) => {
    if (locked) return;
    const t = Array.from(e.dataTransfer.types);
    if (t.includes("text/plain") || t.includes("text/uri-list") || t.includes("application/x-rd-sel")) { e.preventDefault(); setDropOn(true); }
  };
  const onMarginDrop = (side: "left" | "right") => (e: DragEvent) => {
    e.preventDefault(); setDropOn(false);
    if (Array.from(e.dataTransfer.types).includes("application/x-rd-sel") && dragSelRef.current) { newNote([dragSelRef.current], undefined, side); dragSelRef.current = null; clearSel(); return; }
    const data = readTransfer(e.dataTransfer);
    if (data) addClipping(data, null, toCanvas(e.clientX, e.clientY).y, side);
  };

  /* ---------- keyboard (active card only) ---------- */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") { if (!sel && tocOpen) setTocOpen(false); clearSel(); setHlMenu(null); setCaretY(null); return; }
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
    const move = (ev: PointerEvent) => { w = clamp(w0 + (x0 - ev.clientX) / zRef.current, MARGIN_MIN, MARGIN_MAX); setDragMarginW(w); };
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
    node: c, track: trackOf(c, allNodes), editing: editingId === c.id, focused: focusId === c.id, hot: hotId === c.id, childCount: grandCounts[c.id] || 0,
    // Sources open as the next card; everything else opens over the workspace to read and type into.
    onOpen: () => (c.kind === "source" ? onOpen(c.id) : setUI({ popup: c.id })),
    onRead: (url: string) => setUI({ reader: { url, treeId: tree.id, parentId: node.id, anchor: c.anchors[0] || null } }),
    reading: readingBeside === c.id,
    column: layout.colSide && readingBeside === c.id ? layout.colH : undefined,
    onReadBeside: c.kind === "source" ? () => { setUI({ readingBeside: readingBeside === c.id ? null : c.id }); setFocusId(c.id); } : undefined,
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
      <div className={`card-tools${onClose ? " beside-close" : ""}`}>
        {toc.length > 0 && (
          <button className={`card-tool${tocOpen ? " on" : ""}`} aria-pressed={tocOpen} aria-label="Contents" title="Contents" onClick={() => setTocOpen((o) => !o)}>
            <ListTree size={15} aria-hidden />
          </button>
        )}
        {!compact && (
          <button className={`card-tool${branchesOpen ? " on" : ""}`} aria-pressed={branchesOpen} data-testid="branches-toggle"
            aria-label={`${branchesOpen ? "Hide" : "Show"} branches${children.length ? ` (${children.length})` : ""}`} title={branchesOpen ? "Hide branches" : "Show branches"}
            onClick={() => setUI({ branchesOpen: !branchesOpen })}>
            <GitBranch size={15} aria-hidden />{children.length > 0 && <span className="tabular">{children.length}</span>}
          </button>
        )}
      </div>
      {tocOpen && toc.length > 0 && <ContentsPanel entries={toc} current={tocHere} summaries={summaries} locked={locked} onJump={jumpToPart} onSummarise={summarise} onOpenSummary={(id) => setUI({ popup: id })} onClose={() => setTocOpen(false)} />}
      <div className="card-scroll" ref={scrollRef} onScroll={() => { setHlMenu(null); trackContents(); if (layout.colSide) scheduleLayout(); }}>
        {doc && (
          <div className="chapter-bar" data-testid="chapter-bar">
            {toc.length > 0 && <button className="icon-btn" aria-label="Previous part" disabled={partIndex <= 0} onClick={() => jumpToPart(toc[partIndex - 1].blockId)}><ChevronLeft size={15} /></button>}
            <span className="chapter-name serif">{part?.title || content.title}</span>
            {toc.length > 0 && <button className="icon-btn" aria-label="Next part" disabled={partIndex >= toc.length - 1} onClick={() => jumpToPart(toc[Math.max(0, partIndex + 1)].blockId)}><ChevronRight size={15} /></button>}
            <span className="flex1" />
            {doc.hasOriginal && (
              <span data-testid="view-original"><Segmented size="sm" label="Show as" value={originalOn ? "original" : "text"} onChange={(v) => setOriginal(v === "original")}
                options={[{ value: "text", label: "Text" }, { value: "original", label: "Original" }]} /></span>
            )}
            <span className="muted small tabular" aria-label="Progress">{Math.round(progress * 100)}%</span>
            {!locked && <button className="btn btn-ghost btn-sm" onClick={() => summarise(part?.blockId ?? null)}>
              <NotebookPen size={13} />{summaries[part?.blockId ?? content.blocks[0]?.id]?.length ? "Your summary" : toc.length ? "Summarise this section" : "Summarise"}
            </button>}
            <span className="chapter-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden />
          </div>
        )}
        {node.kind === "source" && !doc ? (
          <div className="card-loading">
            {header}
            {node.pending ? <p className="muted"><span className="thinking"><i /><i /><i /></span> Opening {node.url}…</p>
              : <div className="card-failed"><p>{node.error || "This page didn't finish opening."}</p><div className="row"><button className="btn btn-secondary btn-sm" onClick={() => loadUrl(node.id)}><RotateCw size={13} />Try again</button>{url && <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noopener"><ExternalLink size={13} />Open in browser</a>}</div></div>}
          </div>
        ) : (
          <div className={`zoom-box${zoom > 1 ? " zoomed-in" : ""}`} style={{ ...(zoom !== 1 ? { zoom } : {}), ...(pageW ? { "--sheet-w": `${pageW}px` } : {}) } as CSSProperties}>
          <div className={`canvas${dragMarginW != null ? " resizing" : ""}${branchesOpen && !compact ? " with-margin" : ""}${layout.colSide ? ` col-${layout.colSide}` : ""}`} ref={canvasRef}
            style={{ ...(marginW ? { "--margin-user": `${marginW}px` } : {}), ...(layout.padL ? { "--pad-x": `${layout.padL}px` } : {}) } as CSSProperties}
            onMouseDown={(e) => {
              const t = e.target as HTMLElement;
              if (t.closest(".sheet") && !t.closest("mark")) setSel(null);
              if (!t.closest(".hl-menu")) setHlMenu(null);
              if (!t.closest(".link-menu")) setLinkMenu(null);
              if (!t.closest("[data-branch]")) setFocusId(null);
            }}>
            <aside className={`margin margin-left${dropOn ? " drop-on" : ""}${drag?.from.anchor ? " drop-target" : ""}`} ref={marginLeftRef} tabIndex={-1} data-testid="margin" data-side="left"
              aria-label="Branches on the left" onClick={onMarginClick("left")} onDragOver={onMarginDragOver} onDragLeave={() => setDropOn(false)} onDrop={onMarginDrop("left")}>
              {(drag?.from.anchor || dropOn) && <div className="margin-drop-hint">Drop to add a note</div>}
              {caretY != null && caretSide === "left" && <div className="margin-caret" style={{ top: caretY }}>Paste (⌘V) or drop a clipping here</div>}
              {children.filter((c) => sideOf(c, layout.leftOn) === "left").map((c) => <BranchCard key={c.id} {...branchProps(c)} side="left" top={layout.tops[c.id] ?? -9999} setRef={(el) => { if (el) cardRefs.current.set(c.id, el); else cardRefs.current.delete(c.id); }} />)}
            </aside>

            <div className={`sheet-wrap${writable ? " writable" : ""}${doc && (doc.type === "book" || toc.length > 2) ? " bookish" : ""}${livePage ? " page-moving" : ""}`} ref={sheetRef}
              style={pageX ? { left: pageX } : undefined}
              onMouseUp={onSheetMouseUp}
              onMouseOver={onSheetOver} onMouseOut={onSheetOut} onClick={onSheetClick}
              onDragStart={(e) => { if (sel) { dragSelRef.current = sel.anchor; e.dataTransfer.setData("application/x-rd-sel", "1"); } }}>
              {!compact && (<>
                <button className="page-grip" data-testid="page-grip" aria-label="Move the page sideways (double-click to centre it)" title="Drag to move the page · double-click to centre"
                  onPointerDown={startPageDrag("move")} onDoubleClick={() => setUI({ sheetShift: 0 })}><GripHorizontal size={14} /></button>
                <button className="page-edge" data-testid="page-edge" aria-label="Make the page wider or narrower (double-click to reset)" title="Drag to resize the page · double-click to reset"
                  onPointerDown={startPageDrag("size")} onDoubleClick={() => setUI({ sheetWidth: undefined, sheetShift: 0 })} />
              </>)}
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
                  {originalOn && doc ? <OriginalPages doc={doc} marks={marks} hotId={hotId || focusId} header={header} />
                    : <DocumentSheet content={content} marks={marks} hotId={hotId || focusId} flashBlockId={flash} showPages={!!doc && doc.pages > 1 && doc.format !== "epub"} header={header} />}
                  {writable && <button className="write-tail" onClick={() => startWriting()}>Keep writing…</button>}
                </>
              )}
            </div>

            <aside className={`margin margin-right${dropOn ? " drop-on" : ""}${drag?.from.anchor ? " drop-target" : ""}`} ref={marginRef} tabIndex={-1} data-testid="margin" data-side="right" data-coach={index === 0 ? "margin" : undefined}
              aria-label="Branches" onClick={onMarginClick("right")} onDragOver={onMarginDragOver} onDragLeave={() => setDropOn(false)} onDrop={onMarginDrop("right")}>
              <div className="margin-grip" role="separator" aria-orientation="vertical" aria-label="Stretch the margin" title="Drag to stretch the cards. Double-click to reset."
                tabIndex={0} aria-valuenow={Math.round(marginW || marginRef.current?.offsetWidth || 300)} aria-valuemin={MARGIN_MIN} aria-valuemax={MARGIN_MAX}
                onPointerDown={startMarginResize} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); setUI({ marginWidth: undefined }); }} onKeyDown={onGripKey} />
              {children.length === 0 && caretY == null && !drag && <p className="margin-empty">Select any text to branch from it: a note, a definition, another source. Or paste something here.</p>}
              {(drag?.from.anchor || dropOn) && <div className="margin-drop-hint">Drop to add a note</div>}
              {caretY != null && caretSide === "right" && <div className="margin-caret" style={{ top: caretY }}>Paste (⌘V) or drop a clipping here</div>}
              {children.filter((c) => sideOf(c, layout.leftOn) === "right").map((c) => <BranchCard key={c.id} {...branchProps(c)} side="right" top={layout.tops[c.id] ?? -9999} setRef={(el) => { if (el) cardRefs.current.set(c.id, el); else cardRefs.current.delete(c.id); }} />)}
            </aside>

            <ThreadLayer threads={layout.threads} hotId={hotId || focusId} drag={drag} onGrab={locked ? undefined : grabLink} />
            {linkMenu && (
              <div className="popover hl-menu link-menu" data-testid="link-menu" style={{ left: linkMenu.x, top: linkMenu.y }}>
                <p className="muted small">Drag the dot onto another sentence to move this link.</p>
                <button onClick={() => { focusBranch(linkMenu.nodeId); setLinkMenu(null); }}>Show the branch</button>
                <button className="danger" onClick={() => { removeAnchor(linkMenu.nodeId, linkMenu.ai, layout.tops[linkMenu.nodeId]); setLinkMenu(null); toast("Unlinked. The branch stays in the margin."); }}>Unlink from this passage</button>
              </div>
            )}

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
