// Sync with Supabase. Reading Desk stays local-first: IndexedDB is the source the app reads from,
// and this module pushes local changes and pulls remote ones (last write wins per record).
// Runs on sign-in and load, on window focus, when the connection returns, a few seconds after a change, and every 60 s.
import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useStore } from "../store/useStore";
import { getSupabase, syncConfigured } from "./supabase";
import { TABLES, applyToState, emptyMeta, markPushed, mergeRemote, outgoing, pullSince, reconcile, toTables, trackChanges, type Meta, type Row, type Table } from "./syncMerge";

export type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";

interface SyncState {
  configured: boolean;
  email: string | null;
  status: SyncStatus;
  lastSyncedAt: number;
  error: string | null;
}

/** UI-facing sync state. Not persisted: Supabase keeps the session itself. */
export const useSync = create<SyncState>(() => ({ configured: syncConfigured, email: null, status: "local", lastSyncedAt: 0, error: null }));

const META_KEY = "reading-desk-sync-meta";
const cursorKey = (userId: string) => `reading-desk-sync-cursor:${userId}`;
const PAGE = 500;
const PUSH_CHUNK = 200;

let meta: Meta = emptyMeta();
let applyingRemote = false;
let running: Promise<void> | null = null;
let again = false;
let userId: string | null = null;
let changeTimer: ReturnType<typeof setTimeout> | undefined;

const saveMeta = () => idbSet(META_KEY, meta).catch(() => {});

/** Start watching the store and, when configured, the Supabase session. Call once, after the store has loaded. */
export async function startSync(): Promise<() => void> {
  meta = { ...emptyMeta(), ...((await idbGet<Meta>(META_KEY).catch(() => undefined)) ?? {}) };
  meta = reconcile(toTables(useStore.getState()), meta, Date.now());
  void saveMeta();

  const unsubStore = useStore.subscribe((s, prev) => {
    if (applyingRemote) return;
    if (s.trees === prev.trees && s.nodes === prev.nodes && s.docs === prev.docs && s.topics === prev.topics && s.highlights === prev.highlights) return;
    const next = trackChanges(toTables(prev), toTables(s), meta, Date.now());
    if (next === meta) return;
    meta = next;
    void saveMeta();
    clearTimeout(changeTimer);
    changeTimer = setTimeout(() => void syncNow(), 3000);
  });

  const sb = await getSupabase();
  if (!sb) return unsubStore;

  const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
    const id = session?.user.id ?? null;
    useSync.setState({ email: session?.user.email ?? null });
    if (id !== userId) { userId = id; if (id) void syncNow(); else useSync.setState({ status: "local" }); }
  });
  const onFocus = () => void syncNow();
  const onOnline = () => void syncNow();
  const onOffline = () => { if (userId) useSync.setState({ status: "offline" }); };
  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  const timer = setInterval(() => void syncNow(), 60_000);

  return () => {
    unsubStore(); sub.subscription.unsubscribe(); clearInterval(timer); clearTimeout(changeTimer);
    window.removeEventListener("focus", onFocus); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline);
  };
}

/** Run one sync now. Overlapping calls are folded into one follow-up run. */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    do { again = false; await syncOnce(); } while (again);
  })().finally(() => { running = null; });
  return running;
}

async function syncOnce() {
  const sb = await getSupabase();
  if (!sb || !userId) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) { useSync.setState({ status: "offline" }); return; }
  useSync.setState({ status: "syncing", error: null });
  try {
    await pull(sb, userId);
    await push(sb, userId);
    useSync.setState({ status: "synced", lastSyncedAt: Date.now() });
  } catch (e) {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    useSync.setState({ status: offline ? "offline" : "error", error: offline ? null : (e as Error).message });
  }
}

/** Fetch rows changed on the server since the last pull, re-reading a short overlap (see `pullSince`).
 *  The cursor uses the server's clock, so device clocks don't matter here. */
async function pull(sb: SupabaseClient, uid: string) {
  const cursors: Partial<Record<Table, string>> = (await idbGet(cursorKey(uid)).catch(() => undefined)) ?? {};
  const rows: Partial<Record<Table, Row[]>> = {};
  for (const t of TABLES) {
    const list: Row[] = [];
    let since = pullSince(cursors[t]);
    let latest = cursors[t];
    for (;;) {
      const { data, error } = await sb.from(t).select("id,data,updated_at,deleted,server_at").gt("server_at", since).order("server_at").limit(PAGE);
      if (error) throw new Error(error.message);
      for (const r of data) list.push({ id: r.id, data: r.data, updated_at: Number(r.updated_at), deleted: r.deleted });
      if (data.length) since = data[data.length - 1].server_at;
      if (data.length && (!latest || since > latest)) latest = since;
      if (data.length < PAGE) break;
    }
    rows[t] = list;
    if (latest) cursors[t] = latest;
  }
  const merged = mergeRemote(rows, meta);
  meta = merged.meta;
  applyingRemote = true;
  try { useStore.setState((s) => applyToState(s, merged.apply)); } finally { applyingRemote = false; }
  await saveMeta();
  await idbSet(cursorKey(uid), cursors).catch(() => {});
}

async function push(sb: SupabaseClient, uid: string) {
  const out = outgoing(toTables(useStore.getState()), meta);
  for (const t of TABLES) {
    for (let i = 0; i < out[t].length; i += PUSH_CHUNK) {
      const chunk = out[t].slice(i, i + PUSH_CHUNK).map((r) => ({ ...r, user_id: uid }));
      const { error } = await sb.from(t).upsert(chunk, { onConflict: "user_id,id" });
      if (error) throw new Error(error.message);
    }
  }
  meta = markPushed(meta, out);
  await saveMeta();
}
