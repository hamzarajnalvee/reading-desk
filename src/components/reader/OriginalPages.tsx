// A PDF shown as its original pages. The file comes from this device or your account; if neither has it,
// you're asked for it once.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Block, Doc } from "../../data/types";
import { getOriginal, keepOriginal } from "../../lib/originals";
import { loadPdfjs } from "../../lib/pdf";
import { toast } from "../../lib/toast";
import { OriginalPage } from "./OriginalPage";
import type { MarkSpec } from "./DocumentSheet";

const NONE: Block[] = [];
const open = new Map<string, Promise<{ pdf: PDFDocumentProxy; aspects: number[] } | null>>();
function openOriginal(docId: string) {
  let p = open.get(docId);
  if (!p) {
    p = (async () => {
      const blob = await getOriginal(docId);
      if (!blob) return null;
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const aspects: number[] = [];
      for (let i = 1; i <= pdf.numPages; i++) { const v = (await pdf.getPage(i)).getViewport({ scale: 1 }); aspects.push(v.height / v.width); }
      return { pdf, aspects };
    })();
    p.then((r) => { if (!r) open.delete(docId); }, () => open.delete(docId));
    open.set(docId, p);
  }
  return p;
}

interface Props { doc: Doc; marks: MarkSpec[]; hotId: string | null; header?: ReactNode }

export function OriginalPages({ doc, marks, hotId, header }: Props) {
  const [state, setState] = useState<{ pdf: PDFDocumentProxy; aspects: number[] } | "loading" | "missing" | "error">("loading");
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let live = true;
    setState("loading");
    openOriginal(doc.id).then((r) => { if (live) setState(r ?? "missing"); }, () => { if (live) setState("error"); });
    return () => { live = false; };
  }, [doc.id, nonce]);
  const byPage = useMemo(() => {
    const m: Record<number, Block[]> = {};
    for (const b of doc.blocks) (m[b.page] ??= []).push(b);
    return m;
  }, [doc.blocks]);

  const choose = async (f: File | undefined) => {
    if (!f) return;
    await keepOriginal(doc.id, f);
    open.delete(doc.id);
    toast("Kept the original. Its pages are shown here and on your other devices.");
    setNonce((n) => n + 1);
  };

  return (
    <article className="sheet original" aria-label={`${doc.title}, original pages`} data-testid="original">
      {header}
      {state === "loading" && <p className="muted ol-status"><span className="thinking"><i /><i /><i /></span> Opening the original pages…</p>}
      {(state === "missing" || state === "error") && (
        <div className="ol-missing">
          <p>{state === "missing" ? "The original PDF isn't on this device or in your account yet." : "The original PDF couldn't be opened."} Choose the file to see its pages here, with figures and tables.</p>
          <label className="btn btn-secondary btn-sm">Choose the PDF…<input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void choose(e.target.files?.[0])} /></label>
        </div>
      )}
      {typeof state === "object" && state.aspects.map((a, i) => (
        <OriginalPage key={i} pdf={state.pdf} page={i + 1} aspect={a} blocks={byPage[i + 1] ?? NONE} ocr={doc.ocr?.[i + 1]} marks={marks} hotId={hotId} />
      ))}
    </article>
  );
}
