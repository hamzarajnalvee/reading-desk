import { useState } from "react";
import { Link } from "react-router-dom";
import { syncNow, useSync } from "../lib/sync";
import { sendMagicLink, signOut } from "../lib/supabase";
import { timeAgo } from "../lib/util";

/** Sign in with an emailed link, so trees sync between laptop and phone. The app works fully without it. */
export function SignInScreen() {
  const { configured, email, status, lastSyncedAt, error } = useSync();
  const [address, setAddress] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const send = async () => {
    const a = address.trim();
    if (!/^\S+@\S+\.\S+$/.test(a)) { setProblem("Enter an email address, like you@example.com."); return; }
    setBusy(true); setProblem(null);
    try { await sendMagicLink(a); setSentTo(a); } catch (e) { setProblem((e as Error).message); }
    setBusy(false);
  };

  return (
    <div className="workspace" data-testid="sign-in">
      <header className="ws-bar"><h1 className="serif ws-title">Sync</h1></header>
      <div className="ws-scroll">
        <div className="signin">
          {!configured ? (
            <>
              <h2 className="serif">Saved on this device</h2>
              <p className="muted">Sync isn't set up on this copy of Reading Desk, so your trees stay in this browser. To move them to another device, use Export backup and Import backup in the sidebar's ⋯ menu.</p>
              <p className="muted small">To turn sync on, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and run the SQL in supabase/migrations.</p>
            </>
          ) : email ? (
            <>
              <h2 className="serif">Signed in as {email}</h2>
              <p className="muted">Your trees sync between every device where you sign in with this address. They're still saved on this device, so you can keep reading offline.</p>
              <p className="small" role="status">{status === "syncing" ? "Syncing…" : status === "offline" ? "Offline — saved on this device" : status === "error" ? `Couldn't sync: ${error}` : lastSyncedAt ? `Synced ${timeAgo(lastSyncedAt).toLowerCase()}` : "Not synced yet"}</p>
              <div className="signin-actions">
                <button className="btn btn-md btn-primary" onClick={() => void syncNow()} disabled={status === "syncing"}>Sync now</button>
                <button className="btn btn-md btn-secondary" onClick={() => void signOut()}>Sign out</button>
              </div>
              <p className="muted small">Signing out keeps everything on this device.</p>
            </>
          ) : sentTo ? (
            <>
              <h2 className="serif">Check your email</h2>
              <p className="muted">We sent a sign-in link to {sentTo}. Open it on this device to finish signing in.</p>
              <button className="btn btn-md btn-ghost" onClick={() => setSentTo(null)}>Use a different address</button>
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <h2 className="serif">Sync your trees</h2>
              <p className="muted">Sign in to keep your trees on your laptop and phone. We'll email you a link; there's no password.</p>
              <label className="signin-label" htmlFor="signin-email">Email</label>
              <input id="signin-email" className="field" type="email" autoComplete="email" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="you@example.com" />
              {problem && <p className="signin-error small" role="alert">{problem}</p>}
              <div className="signin-actions">
                <button className="btn btn-md btn-primary" type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
                <Link className="btn btn-md btn-ghost" to="/">Keep using without an account</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
