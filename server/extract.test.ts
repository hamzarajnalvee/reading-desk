import { describe, expect, it } from "vitest";
import { extractArticle } from "./extract";

const page = (body: string, head = "") => `<!doctype html><html><head><title>Page title</title>${head}</head><body>${body}</body></html>`;
const para = (n: number) => Array.from({ length: n }, (_, i) => `<p>Paragraph ${i + 1} explains how card payments are authorised, cleared and settled between the issuer, the network and the acquirer, with enough words to look like an article.</p>`).join("");

describe("extractArticle", () => {
  it("keeps the article and drops navigation and footers", () => {
    const r = extractArticle(page(`<nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav><article><h1>3D Secure</h1>${para(8)}</article><footer>© Company</footer>`, '<meta property="og:site_name" content="Example Docs">'), "https://example.com/3ds");
    expect(r.title).toBe("Page title");
    expect(r.site).toBe("Example Docs");
    expect(r.html).toContain("Paragraph 8 explains");
    expect(r.html).not.toContain("Pricing");
    expect(r.html).not.toContain("© Company");
    expect(r.warning).toBeUndefined();
  });
  it("warns when very little text was found", () => {
    const r = extractArticle(page("<main><p>Short page with almost nothing on it.</p></main>"), "https://example.com/x");
    expect(r.warning).toMatch(/Open the original/);
  });
  it("keeps links so they can be followed as branches", () => {
    const r = extractArticle(page(`<article>${para(6)}<p>Read the <a href="https://example.com/pci.pdf">PCI DSS summary</a> for details about scope and the twelve requirements that apply to merchants.</p></article>`), "https://example.com/a");
    expect(r.html).toContain('href="https://example.com/pci.pdf"');
  });
});
