// The one place that touches @supabase/supabase-js. It's loaded lazily, and only when sync is configured.
import type { Session, SupabaseClient } from "@supabase/supabase-js";

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/** False when the app runs without Supabase settings: everything stays on this device. */
export const syncConfigured = Boolean(URL && KEY);

let client: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!syncConfigured) return Promise.resolve(null);
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } }));
  return client;
}

export async function currentSession(): Promise<Session | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

/** Authorization header for calls to /api/* when signed in. */
export async function authHeader(): Promise<Record<string, string>> {
  const s = await currentSession();
  return s ? { Authorization: `Bearer ${s.access_token}` } : {};
}

export async function sendMagicLink(email: string): Promise<void> {
  const sb = await getSupabase();
  if (!sb) throw new Error("Sync isn't set up on this copy of Reading Desk.");
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/sign-in` } });
  if (error) throw new Error(`Couldn't send the link: ${error.message}`);
}

export async function signOut(): Promise<void> {
  const sb = await getSupabase();
  await sb?.auth.signOut();
}
