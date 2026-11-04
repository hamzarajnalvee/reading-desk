// Turning fetched web pages into clean, readable HTML with Mozilla Readability (the engine behind Firefox Reader View).
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface Extracted { title: string; byline?: string; site?: string; html: string; textLength: number; warning?: string }

export function extractArticle(html: string, url: string): Extracted {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const site = doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content") || new URL(url).hostname.replace(/^www\./, "");
  const article = new Readability(doc, { keepClasses: false }).parse();
  if (!article || !article.content) {
    return { title: doc.title || url, site, html: `<p>${doc.body?.textContent?.trim().slice(0, 20000) || ""}</p>`, textLength: 0, warning: "This page couldn't be simplified, so its raw text is shown. Open the original to check it." };
  }
  const textLength = article.textContent?.trim().length || 0;
  return {
    title: article.title || doc.title || url,
    byline: article.byline || undefined,
    site: article.siteName || site,
    html: article.content,
    textLength,
    warning: textLength < 600 ? "Only a little text was found on this page. Open the original to check nothing is missing." : undefined,
  };
}
