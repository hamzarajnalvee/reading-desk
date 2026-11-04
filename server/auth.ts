// Checks the Supabase session token on endpoints that call Claude.
// Signed out: allowed, unless REQUIRE_SIGN_IN=1 (for a hosted server). Signed in: the token must be valid.
import type { NextFunction, Request, Response } from "express";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");
const SUPABASE_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "").trim();
const REQUIRE = process.env.REQUIRE_SIGN_IN === "1";

type Verify = (token: string) => Promise<boolean>;

/** Ask Supabase who owns this token. Cached briefly so a streaming conversation doesn't re-check every turn. */
const cache = new Map<string, number>();
const verifyWithSupabase: Verify = async (token) => {
  const hit = cache.get(token);
  if (hit && hit > Date.now()) return true;
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY } });
    if (!r.ok) return false;
    if (cache.size > 500) cache.clear();
    cache.set(token, Date.now() + 60_000);
    return true;
  } catch { return false; }
};

export function requireSession(opts: { require?: boolean; verify?: Verify } = {}) {
  const mustSignIn = opts.require ?? REQUIRE;
  const verify = opts.verify ?? verifyWithSupabase;
  return async (req: Request, res: Response, next: NextFunction) => {
    const m = /^Bearer (.+)$/.exec(req.get("authorization") || "");
    if (!m) {
      if (mustSignIn) { res.status(401).json({ error: "Sign in to use Claude on this server." }); return; }
      next(); return;
    }
    if (await verify(m[1])) { next(); return; }
    res.status(401).json({ error: "Your session has expired. Sign in again, then retry." });
  };
}
