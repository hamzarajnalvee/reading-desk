import { describe, expect, it } from "vitest";
import { alignPieces, ocrParas } from "./pageText";
import type { Block } from "../data/types";

const L = (t: string, y: number, h = 0.016, x = 0.06) => ({ t, x, y, w: 0.8, h });

describe("recognised lines into paragraphs", () => {
  it("joins lines, mends line-end hyphens, splits at gaps and finds headings", () => {
    const paras = ocrParas([
      L("Dear Stripe community,", 0.2),
      L("Last year, businesses running on Stripe grew, and many blue-", 0.25),
      L("chip companies joined.", 0.27),
      L("The sorting machine", 0.33, 0.026),
      L("At heart, competitive markets are a sorting machine.", 0.38),
    ]);
    expect(paras).toEqual([
      { kind: "p", text: "Dear Stripe community," },
      { kind: "p", text: "Last year, businesses running on Stripe grew, and many bluechip companies joined." },
      { kind: "h", text: "The sorting machine" },
      { kind: "p", text: "At heart, competitive markets are a sorting machine." },
    ]);
  });

  it("leaves chart labels and axis numbers out of the text", () => {
    expect(ocrParas([L("Real prose sentence that is long enough to keep,", 0.1), L("and it carries on for a while", 0.12), L("before it ends here.", 0.14), L("65%", 0.2, 0.012), L("2011 2013 2015 2017", 0.25, 0.012), L("Brick and mortar", 0.3, 0.012)]))
      .toEqual([{ kind: "p", text: "Real prose sentence that is long enough to keep, and it carries on for a while before it ends here." }]);
  });
});

describe("placing a page's text on its blocks", () => {
  const blocks: Block[] = [
    { id: "b1", kind: "p", page: 1, text: "Last year, businesses running on Stripe grew, and many bluechip companies joined." },
    { id: "b2", kind: "p", page: 1, text: "At heart, markets sort." },
  ];
  it("finds each run in order, across blocks, tolerating hyphens", () => {
    const p = alignPieces(blocks, [L("Last year, businesses running on Stripe grew, and many blue-", 0), L("65%", 0), L("chip companies joined.", 0), L("At heart, markets sort.", 0)]);
    expect(p.map((x) => [x.blockId, x.start, x.end])).toEqual([
      ["b1", 0, 59],
      [undefined, undefined, undefined],
      ["b1", 59, 81],
      ["b2", 0, 23],
    ]);
  });
  it("places pdf.js runs that split words and sentences", () => {
    const p = alignPieces(blocks, [L("Last year, ", 0), L("businesses", 0), L("running on Stripe", 0)]);
    expect(p.map((x) => [x.blockId, x.start])).toEqual([["b1", 0], ["b1", 11], ["b1", 22]]);
  });
});
