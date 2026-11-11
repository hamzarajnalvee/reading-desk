// Recognising words on pages that have no text layer (scans, or text drawn as shapes), on this device with
// Tesseract.js. The engine and English model are served from /ocr (copied there by scripts/copy-ocr-assets.mjs);
// nothing is fetched from elsewhere and no page leaves the device.
import type { PDFPageProxy } from "pdfjs-dist";
import type { OcrLine } from "../data/types";

type Worker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
let worker: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  worker ??= import("tesseract.js").then(({ createWorker, OEM }) =>
    createWorker("eng", OEM.LSTM_ONLY, { workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr", gzip: true, workerBlobURL: false }));
  return worker;
}

/** Release the engine (it holds tens of MB) once a file is done. */
export async function endOcr(): Promise<void> {
  const w = worker; worker = null;
  if (w) await (await w).terminate().catch(() => {});
}

/** Draw a page large enough to read small print, and recognise its lines (top to bottom). */
export async function recognisePage(page: PDFPageProxy): Promise<OcrLine[]> {
  const base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.min(4, 2400 / base.width) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const w = await getWorker();
  const { data } = await w.recognize(canvas, {}, { blocks: true, text: false });
  const lines: OcrLine[] = [];
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) {
    const t = l.text.replace(/\s+/g, " ").trim();
    if (!t || l.confidence < 30) continue;
    const { x0, y0, x1, y1 } = l.bbox;
    lines.push({ t, x: x0 / canvas.width, y: y0 / canvas.height, w: (x1 - x0) / canvas.width, h: (y1 - y0) / canvas.height });
  }
  canvas.width = canvas.height = 0;
  return lines;
}
