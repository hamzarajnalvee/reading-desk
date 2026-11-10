import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { ASK_SYSTEM, EXPLAIN_SYSTEM, SORT_SYSTEM, SUMMARY_SYSTEM } from "./prompts.js";
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

/** Suggest essay or rabbit hole for each branch. Body: { statement, items: [{ id, kind, title, text }] }. Answer: { tracks: { id: track } } */
app.post("/api/sort", signedIn, async (req, res) => {
  const { statement = "", items = [] } = req.body as { statement?: string; items?: { id: string; kind: string; title: string; text?: string }[] };
  const list = items.slice(0, 200);
  const known = new Set(list.map((i) => i.id));
  if (!client) {
    // Demo mode: the same plain rule the app uses, so the flow can be tried without a key.
    res.json({ tracks: Object.fromEntries(list.map((i) => [i.id, i.kind === "definition" || i.kind === "explanation" ? "rabbit" : "essay"])), demo: true });
    return;
  }
  const lines = list.map((i) => `${i.id} [${i.kind}] ${i.title.slice(0, 120)}${i.text ? ` — ${i.text.replace(/\s+/g, " ").slice(0, 240)}` : ""}`).join("\n");
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 2000, system: SORT_SYSTEM, messages: [{ role: "user", content: `Statement: ${statement.slice(0, 600)}\n\nBranches:\n${lines}` }] });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("\n");
    const tracks: Record<string, string> = {};
    for (const m of text.matchAll(/^\s*(\S+)\s+(essay|rabbit)\b/gim)) if (known.has(m[1])) tracks[m[1]] = m[2].toLowerCase();
    res.json({ tracks });
  } catch (e) { res.status(502).json({ error: `Claude couldn't sort the branches: ${(e as Error).message}` }); }
});

/** Dictionary definition (no AI): Wiktionary first for single words, then Wikipedia's summary. `source=wikipedia` skips Wiktionary. */
app.get("/api/define", async (req, res) => {
  const term = String(req.query.term || "").trim().slice(0, 120);
  if (!term) { res.status(400).json({ error: "No term" }); return; }
  if (OFFLINE) { res.status(404).json({ error: "Offline" }); return; }
  const headers = { "User-Agent": UA, Accept: "application/json" };
  try {
    if (!/\s/.test(term) && req.query.source !== "wikipedia") {
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

type Hit = { title: string; url: string; snippet?: string; meta?: string; free?: boolean };
const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
/** OpenAlex keeps abstracts as word → positions; put the words back in order. */
const abstractOf = (inv?: Record<string, number[]> | null) => {
  if (!inv) return "";
  const words: string[] = [];
  for (const [w, ps] of Object.entries(inv)) for (const p of ps) words[p] = w;
  return words.filter(Boolean).join(" ");
};

/** Search without leaving the app (no AI, no key). `source=wikipedia` searches Wikipedia; `source=papers` searches OpenAlex for research papers. */
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 200);
  const source = req.query.source === "papers" ? "papers" : "wikipedia";
  if (!q) { res.status(400).json({ error: "Type something to search for." }); return; }
  if (OFFLINE) { res.status(503).json({ error: "Offline" }); return; }
  const headers = { "User-Agent": UA, Accept: "application/json" };
  try {
    let hits: Hit[] = [];
    if (source === "wikipedia") {
      const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=12&srsearch=${encodeURIComponent(q)}`, { headers, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`Wikipedia answered ${r.status}`);
      const j = (await r.json()) as { query?: { search?: { title: string; snippet: string; wordcount?: number }[] } };
      hits = (j.query?.search || []).map((s) => ({ title: s.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`, snippet: strip(s.snippet), meta: s.wordcount ? `Wikipedia · ${s.wordcount.toLocaleString()} words` : "Wikipedia", free: true }));
    } else {
      const r = await fetch(`https://api.openalex.org/works?per-page=12&search=${encodeURIComponent(q)}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error(`OpenAlex answered ${r.status}`);
      type Work = { display_name?: string; publication_year?: number; doi?: string; cited_by_count?: number; authorships?: { author?: { display_name?: string } }[];
        open_access?: { oa_url?: string | null }; best_oa_location?: { pdf_url?: string | null; landing_page_url?: string | null } | null; primary_location?: { landing_page_url?: string | null; source?: { display_name?: string } | null } | null; abstract_inverted_index?: Record<string, number[]> | null };
      const j = (await r.json()) as { results?: Work[] };
      hits = (j.results || []).filter((w) => w.display_name).map((w) => {
        const free = w.best_oa_location?.pdf_url || w.open_access?.oa_url || w.best_oa_location?.landing_page_url || null;
        const authors = (w.authorships || []).map((a) => a.author?.display_name).filter(Boolean) as string[];
        const meta = [authors.slice(0, 3).join(", ") + (authors.length > 3 ? " et al." : ""), w.publication_year, w.primary_location?.source?.display_name, w.cited_by_count ? `cited ${w.cited_by_count.toLocaleString()}×` : ""].filter(Boolean).join(" · ");
        return { title: strip(w.display_name!), url: free || w.doi || w.primary_location?.landing_page_url || "", snippet: abstractOf(w.abstract_inverted_index).slice(0, 320), meta, free: !!free };
      }).filter((h) => h.url);
    }
    res.json({ hits });
  } catch (e) { res.status(502).json({ error: `Search didn't work: ${(e as Error).message}. Try again in a moment.` }); }
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
