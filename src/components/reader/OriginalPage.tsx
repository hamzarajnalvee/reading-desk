// One page of a PDF as it really looks (figures, tables, layout), drawn by pdf.js, with its words laid over the
// image as invisible text placed on the source's blocks. Selecting, highlighting, branching and threads work
// exactly as in the text view, because the runs carry their block id and character offsets.
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Block, OcrLine } from "../../data/types";
import { alignPieces, type PageText, type Piece } from "../../lib/pageText";
import { segments, type MarkSpec } from "./DocumentSheet";

interface Props {
  pdf: PDFDocumentProxy;
  page: number;
  /** Height over width. */
  aspect: number;
  blocks: Block[];
  /** Recognised lines, when the page has no text layer of its own. */
  ocr?: OcrLine[];
  marks: MarkSpec[];
  hotId: string | null;
}

let measureCtx: CanvasRenderingContext2D | null = null;
const FONT = "sans-serif";
function textWidth(t: string, px: number) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return t.length * px * 0.5;
  measureCtx.font = `${px}px ${FONT}`;
  return measureCtx.measureText(t).width || 1;
}

/** pdf.js text items as runs with their place on the page (fractions of its width and height). */
async function pageRuns(pdf: PDFDocumentProxy, n: number): Promise<PageText[]> {
  const page = await pdf.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const runs: PageText[] = [];
  for (const it of tc.items) {
    if (!("str" in it) || !it.str.trim()) continue;
    const [a, b, c, d, e, f] = it.transform as number[];
    const [va, vb, vc, vd, ve, vf] = vp.transform;
    // The item's transform, then the viewport's: where its baseline starts on screen, and how tall its letters are.
    const x = va * e + vc * f + ve, y = vb * e + vd * f + vf;
    const h = Math.hypot(va * c + vc * d, vb * c + vd * d) || Math.hypot(a, b);
    runs.push({ t: it.str, x: x / vp.width, y: (y - h) / vp.height, w: (it.width * vp.scale) / vp.width, h: h / vp.height });
  }
  return runs;
}

export const OriginalPage = memo(function OriginalPage({ pdf, page, aspect, blocks, ocr, marks, hotId }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [W, setW] = useState(0);
  const [seen, setSeen] = useState(false);
  const [runs, setRuns] = useState<PageText[]>(ocr ?? []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    // Draw the image only once the page comes near the screen; the words are placed straight away, so threads find them.
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: "1200px 0px" });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, []);

  useEffect(() => {
    if (ocr) { setRuns(ocr); return; }
    let live = true;
    pageRuns(pdf, page).then((r) => { if (live) setRuns(r); }).catch(() => {});
    return () => { live = false; };
  }, [pdf, page, ocr]);

  useEffect(() => {
    if (!seen || !W || !canvas.current) return;
    let task: RenderTask | null = null, live = true;
    const t = setTimeout(async () => {
      const p = await pdf.getPage(page);
      if (!live || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      const dpr = Math.min(3, (window.devicePixelRatio || 1) * 1.25);
      const vp = p.getViewport({ scale: (W * dpr) / base.width });
      const cv = canvas.current;
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      task = p.render({ canvasContext: cv.getContext("2d")!, viewport: vp });
      await task.promise.catch(() => {});
    }, 120);
    return () => { live = false; clearTimeout(t); task?.cancel(); };
  }, [seen, W, pdf, page]);

  const pieces = useMemo(() => alignPieces(blocks, runs), [blocks, runs]);
  const H = W * aspect;
  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);

  const run = (p: Piece, i: number, ox: number, oy: number, body: ReactNode) => {
    const px = Math.max(4, p.h * H * 0.92);
    const k = (p.w * W) / textWidth(p.t, px);
    return (
      <span key={i} className="ol-run" data-start={p.start}
        style={{ left: p.x * W - ox, top: p.y * H - oy, fontSize: px, transform: `scaleX(${Number.isFinite(k) && k > 0 ? k.toFixed(3) : 1})` }}>
        {body}
      </span>
    );
  };

  // Runs grouped by block, in reading order; each block sits where its first run starts.
  const groups: { id?: string; items: Piece[] }[] = [];
  for (const p of pieces) {
    const last = groups[groups.length - 1];
    if (last && last.id === p.blockId && p.blockId) last.items.push(p);
    else groups.push({ id: p.blockId, items: [p] });
  }
  const seenBlock = new Set<string>();

  return (
    <div className="ol-page" ref={box} data-page={page} style={{ height: H || undefined, aspectRatio: H ? undefined : `1 / ${aspect}` }}>
      <canvas ref={canvas} className="ol-canvas" aria-hidden />
      {W > 0 && (
        <div className="ol-text">
          {groups.map((g, gi) => {
            if (!g.id) return g.items.map((p, i) => run(p, gi * 1000 + i, 0, 0, p.t));
            const b = byId.get(g.id)!;
            const ox = g.items[0].x * W, oy = g.items[0].y * H;
            // A block split by an unplaced run continues in a second element; only the first carries its id.
            const first = !seenBlock.has(g.id);
            seenBlock.add(g.id);
            return (
              <span key={`${g.id}-${gi}`} className="ol-block" data-block={g.id} data-runs="" id={first ? `block-${g.id}` : undefined} style={{ left: ox, top: oy }}>
                {g.items.map((p, i) => run(p, i, ox, oy, segments(b, marks, hotId, p.start!, p.end!)))}
              </span>
            );
          })}
        </div>
      )}
      <span className="ol-num mono-label" aria-hidden>p. {page}</span>
    </div>
  );
});
