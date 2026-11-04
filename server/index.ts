import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { ASK_SYSTEM, EXPLAIN_SYSTEM, SUMMARY_SYSTEM } from "./prompts.js";
import { mockAsk, mockExplain, mockSummary } from "./mock.js";
import { extractArticle } from "./extract.js";
import { requireSession } from "./auth.js";

export const app = express();
app.use(express.json({ limit: "6mb" }));

const KEY = process.env.ANTHROPIC_API_KEY?.trim();
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const client = KEY ? new Anthropic({ apiKey: KEY }) : null;
const OFFLINE = process.env.READING_DESK_OFFLINE === "1"; // tests: never touch the network
const signedIn = requireSession();
const UA = "ReadingDesk/0.2 (personal reading tool)";

type Turn = { role: "user" | "assistant"; content: string };

async function streamText(res: express.Response, system: string, messages: Turn[], maxTokens = 1400) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  const stream = client!.messages.stream({ model: MODEL, max_tokens: maxTokens, system, messages });
  stream.on("text", (d) => res.write(d));
  res.on("close", () => stream.abort());
  try { await stream.finalMessage(); } catch (e) { if (!res.writableEnded) res.write(`\n\n_The answer was interrupted: ${(e as Error).message}_`); }
  res.end();
}

app.get("/api/health", (_req, res) => res.json({ ok: true, demo: !client, model: MODEL }));

/** Ask Claude about the trail. Body: { title, context, messages } */
app.post("/api/ask", signedIn, async (req, res) => {
  const { title = "", context = "", messages = [] } = req.body as { title?: string; context?: string; messages?: Turn[] };
  if (!client) { res.type("text/plain").send(mockAsk(messages[messages.length - 1]?.content || "")); return; }
  await streamText(res, `${ASK_SYSTEM}\n\nTREE: ${title}\n\nCARDS ON THE CURRENT TRAIL:\n${context.slice(0, 160_000)}`, messages.slice(-20));
});

/** Explain a passage at a depth. Body: { passage, context, title, depth } */
app.post("/api/explain", signedIn, async (req, res) => {
  const { passage = "", context = "", title = "", depth = "educational" } = req.body as Record<string, string>;
  const d = (["educational", "technical", "both"].includes(depth) ? depth : "educational") as keyof typeof EXPLAIN_SYSTEM;
  if (!client) { res.type("text/plain").send(mockExplain(passage, d)); return; }
  await streamText(res, EXPLAIN_SYSTEM[d], [{ role: "user", content: `Card: "${title}"\nSurrounding text: """${context.slice(0, 4000)}"""\n\nPassage to explain: """${passage.slice(0, 1500)}"""` }], 600);
});

/** Draft an understanding note. Body: { title, material } */
app.post("/api/summarise", signedIn, async (req, res) => {
  const { title = "", material = "" } = req.body as Record<string, string>;
  if (!client) { res.type("text/plain").send(mockSummary()); return; }
  await streamText(res, SUMMARY_SYSTEM, [{ role: "user", content: `Tree: ${title}\n\n${material.slice(0, 120_000)}` }], 900);
});

/** Dictionary definition (no AI): Wiktionary first for single words, then Wikipedia's summary. */
app.get("/api/define", async (req, res) => {
  const term = String(req.query.term || "").trim().slice(0, 120);
  if (!term) { res.status(400).json({ error: "No term" }); return; }
  if (OFFLINE) { res.status(404).json({ error: "Offline" }); return; }
  const headers = { "User-Agent": UA, Accept: "application/json" };
  try {
    if (!/\s/.test(term)) {
      const r = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(term.toLowerCase())}`, { headers, signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        const j = (await r.json()) as Record<string, { partOfSpeech: string; definitions: { definition: string }[] }[]>;
        const en = j.en?.[0];
        const def = en?.definitions?.find((d) => d.definition)?.definition;
        if (def) {
          const text = def.replace(/<[^>]+>/g, "").trim();
          res.json({ term, text: `*${en!.partOfSpeech.toLowerCase()}* ${text}`, source: { site: "Wiktionary", title: term, url: `https://en.wiktionary.org/wiki/${encodeURIComponent(term.toLowerCase())}` } });
          return;
        }
      }
    }
    const w = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.replace(/\s+/g, "_"))}?redirect=true`, { headers, signal: AbortSignal.timeout(6000) });
    if (w.ok) {
      const j = (await w.json()) as { type?: string; title: string; extract?: string; content_urls?: { desktop?: { page?: string } } };
      if (j.extract && j.type !== "disambiguation") {
        res.json({ term: j.title, text: j.extract, source: { site: "Wikipedia", title: j.title, url: j.content_urls?.desktop?.page } });
        return;
      }
    }
    res.status(404).json({ error: "No definition found" });
  } catch (e) { res.status(502).json({ error: (e as Error).message }); }
});

/**
 * Fetch a web page or file so it can open as a card.
 * Web pages come back as readable HTML (Readability); PDFs, EPUBs and other files come back as bytes for the browser to read.
 */
app.get("/api/fetch", async (req, res) => {
  const url = String(req.query.url || "");
  let u: URL;
  try { u = new URL(url); } catch { res.status(400).json({ error: "That isn't a web address." }); return; }
  if (!/^https?:$/.test(u.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)) { res.status(400).json({ error: "Only public web addresses can be opened." }); return; }
  if (OFFLINE) { res.status(503).json({ error: "Offline" }); return; }
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "text/html,application/pdf,application/epub+zip,*/*" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    if (!r.ok) { res.status(502).json({ error: `The site answered ${r.status}. It may need a login, or block automated reading.` }); return; }
    const type = (r.headers.get("content-type") || "").toLowerCase();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 40 * 1024 * 1024) { res.status(413).json({ error: "That file is over 40 MB." }); return; }
    if (type.includes("text/html") || type.includes("application/xhtml")) {
      res.json({ kind: "html", url: r.url, ...extractArticle(buf.toString("utf8"), r.url) });
      return;
    }
    const name = decodeURIComponent(new URL(r.url).pathname.split("/").pop() || "download");
    res.setHeader("Content-Type", type || "application/octet-stream");
    res.setHeader("X-File-Name", encodeURIComponent(name));
    res.setHeader("X-Final-Url", encodeURIComponent(r.url));
    res.send(buf);
  } catch (e) { res.status(502).json({ error: `Couldn't open that page: ${(e as Error).message}` }); }
});

const port = Number(process.env.PORT || 8787);
if (process.env.NODE_ENV !== "test") app.listen(port, () => console.log(`Reading Desk API on http://localhost:${port} ${client ? `(model ${MODEL})` : "(demo mode: no API key)"}`));
