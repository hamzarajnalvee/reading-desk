import { describe, expect, it } from "vitest";
import { readTransfer, siteName } from "./clipboard";

/** Minimal DataTransfer stand-in (jsdom doesn't provide one). */
const dt = (data: Record<string, string>) => ({ getData: (t: string) => data[t] ?? "" }) as unknown as DataTransfer;

describe("readTransfer", () => {
  it("reads plain text with no source", () => {
    const r = readTransfer(dt({ "text/plain": "  Some   copied\ntext  " }))!;
    expect(r.text).toBe("Some copied text");
    expect(r.source).toEqual({});
  });
  it("picks up the source from Firefox's text/x-moz-url", () => {
    const r = readTransfer(dt({ "text/plain": "A fact.", "text/x-moz-url": "https://en.wikipedia.org/wiki/Banach_fixed-point_theorem\nBanach" }))!;
    expect(r.source).toMatchObject({ url: "https://en.wikipedia.org/wiki/Banach_fixed-point_theorem", site: "Wikipedia", title: "Banach fixed point theorem" });
  });
  it("picks up the source from a tab drag's text/uri-list", () => {
    const r = readTransfer(dt({ "text/plain": "Quote", "text/uri-list": "https://www.ft.com/content/abc" }))!;
    expect(r.source.site).toBe("Financial Times");
  });
  it("picks up Windows Chrome's SourceURL in text/html", () => {
    const html = "Version:0.9\r\nSourceURL:https://arxiv.org/abs/1234.5678\r\n<html><body>x</body></html>";
    const r = readTransfer(dt({ "text/plain": "Abstract text", "text/html": html }))!;
    expect(r.source).toMatchObject({ url: "https://arxiv.org/abs/1234.5678", site: "arXiv" });
  });
  it("ignores non-web sources", () => {
    const r = readTransfer(dt({ "text/plain": "x", "text/uri-list": "file:///Users/me/notes.txt" }))!;
    expect(r.source).toEqual({});
  });
  it("returns null when there is nothing to paste", () => {
    expect(readTransfer(dt({}))).toBeNull();
  });
  it("uses the URL as text when only a link was dropped", () => {
    const r = readTransfer(dt({ "text/uri-list": "https://example.com/page" }))!;
    expect(r.text).toBe("https://example.com/page");
  });
  it("caps very long text", () => {
    expect(readTransfer(dt({ "text/plain": "a".repeat(10000) }))!.text.length).toBe(4000);
  });
});

describe("siteName", () => {
  it("names known sites and capitalises others", () => {
    expect(siteName("https://scholar.google.com/x")).toBe("Google Scholar");
    expect(siteName("https://blog.example.org/post")).toBe("Example");
    expect(siteName("")).toBe("");
  });
});
