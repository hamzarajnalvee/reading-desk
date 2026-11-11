// Copies the text-recognition engine (Tesseract.js worker, its WebAssembly core and the English model) into
// public/ocr, so recognition runs from this app's own files and never fetches anything from a CDN.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const out = join(process.cwd(), "public", "ocr");
mkdirSync(out, { recursive: true });
const tjs = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(require.resolve("tesseract.js-core/package.json"));
const lang = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
const files = [
  [join(tjs, "dist", "worker.min.js"), "worker.min.js"],
  ...["tesseract-core-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"].map((f) => [join(core, f), f]),
  [join(lang, "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];
for (const [from, to] of files) {
  if (!existsSync(from)) { console.error(`OCR assets: missing ${from}`); process.exit(1); }
  cpSync(from, join(out, to));
}
console.log(`OCR assets copied to public/ocr (${files.length} files)`);
