import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { requireSession } from "./auth";

function run(mw: ReturnType<typeof requireSession>, authorization?: string) {
  const req = { get: (h: string) => (h.toLowerCase() === "authorization" ? authorization : undefined) } as unknown as Request;
  const out: { status?: number; body?: unknown } = {};
  const res = { status(c: number) { out.status = c; return this; }, json(b: unknown) { out.body = b; return this; } } as unknown as Response;
  const next = vi.fn();
  return mw(req, res, next).then(() => ({ ...out, passed: next.mock.calls.length === 1 }));
}

describe("requireSession", () => {
  it("lets signed-out requests through on a local server", async () => {
    expect((await run(requireSession({ require: false }))).passed).toBe(true);
  });
  it("refuses signed-out requests when sign-in is required", async () => {
    const r = await run(requireSession({ require: true }));
    expect(r).toMatchObject({ passed: false, status: 401 });
  });
  it("accepts a valid session token", async () => {
    expect((await run(requireSession({ verify: async (t) => t === "good" }), "Bearer good")).passed).toBe(true);
  });
  it("refuses an invalid token, even when sign-in isn't required", async () => {
    const r = await run(requireSession({ require: false, verify: async () => false }), "Bearer bad");
    expect(r).toMatchObject({ passed: false, status: 401, body: { error: expect.stringMatching(/Sign in again/) } });
  });
});
