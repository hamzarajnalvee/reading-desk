// Pure merge logic for sync (no network, no store). See src/lib/sync.ts for the runtime.
// Each record is synced on its own: last write wins by the client time it was changed.
import type { Doc, Highlight, Topic, Tree, TreeNode } from "../data/types";

export const TABLES = ["trees", "nodes", "docs", "topics", "highlights"] as const;
export type Table = (typeof TABLES)[number];

/** The synced part of the store, each table keyed by id. */
export interface Tables {
  trees: Record<string, Tree>;
  nodes: Record<string, TreeNode>;
  docs: Record<string, Doc>;
  topics: Record<string, Topic>;
  highlights: Record<string, Highlight>;
}

/** A row as stored in Supabase. `updated_at` is the client time (ms) of the change. */
export interface Row { id: string; data: unknown; updated_at: number; deleted: boolean }

/** What this device knows about each record: when it last changed, whether it was deleted, and whether that change still needs pushing. */
export interface RecordMeta { at: number; deleted?: boolean; dirty?: boolean }
export type Meta = Record<Table, Record<string, RecordMeta>>;

export const emptyMeta = (): Meta => ({ trees: {}, nodes: {}, docs: {}, topics: {}, highlights: {} });

const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]));

/** Transient fields that must never leave the device. */
const cleanNode = (n: TreeNode): TreeNode => { const { pending: _p, error: _e, ...rest } = n; return rest; };

export function toTables(s: { trees: Tree[]; nodes: Record<string, TreeNode>; docs: Record<string, Doc>; topics: Topic[]; highlights: Highlight[] }): Tables {
  return { trees: byId(s.trees), nodes: s.nodes, docs: s.docs, topics: byId(s.topics), highlights: byId(s.highlights) };
}

const stamp = (table: Table, rec: unknown): number => {
  const r = rec as { updatedAt?: number; createdAt?: number; addedAt?: number };
  return (table === "docs" ? r.addedAt : r.updatedAt ?? r.createdAt) ?? 0;
};

/**
 * Called once after the store loads. Records this device has never synced are marked to push,
 * and records that vanished while the app was closed become deletions.
 */
export function reconcile(local: Tables, meta: Meta, now: number): Meta {
  const out = emptyMeta();
  for (const t of TABLES) {
    out[t] = { ...meta[t] };
    for (const [id, rec] of Object.entries(local[t])) {
      const m = out[t][id];
      if (!m || m.deleted) out[t][id] = { at: Math.max(stamp(t, rec), m ? m.at + 1 : 0), dirty: true };
    }
    for (const [id, m] of Object.entries(out[t])) if (!m.deleted && !(id in local[t])) out[t][id] = { at: now, deleted: true, dirty: true };
  }
  return out;
}

/** Compare two snapshots of the store and mark what changed. The store updates immutably, so a new object means a change. */
export function trackChanges(prev: Tables, next: Tables, meta: Meta, now: number): Meta {
  let out = meta;
  for (const t of TABLES) {
    if (prev[t] === next[t]) continue;
    const m = { ...meta[t] };
    let changed = false;
    // A change must sort after anything already known for the record, even if this device's clock is behind.
    const bump = (id: string) => Math.max(now, (m[id]?.at ?? 0) + 1);
    for (const [id, rec] of Object.entries(next[t])) {
      if (prev[t][id] === rec) continue;
      if (t === "nodes" && prev.nodes[id] && sameIgnoringTransient(prev.nodes[id], rec as TreeNode)) continue;
      m[id] = { at: bump(id), dirty: true };
      changed = true;
    }
    for (const id of Object.keys(prev[t])) {
      if (!(id in next[t])) { m[id] = { at: bump(id), deleted: true, dirty: true }; changed = true; }
    }
    if (changed) out = { ...out, [t]: m };
  }
  return out;
}

function sameIgnoringTransient(a: TreeNode, b: TreeNode) {
  return JSON.stringify(cleanNode(a)) === JSON.stringify(cleanNode(b));
}

export interface MergeResult {
  /** Records to write into the store (null removes the record). */
  apply: Record<Table, Record<string, unknown | null>>;
  meta: Meta;
}

/** Fold remote rows into local state. The newer change wins; on a tie the remote copy is kept so every device converges. */
export function mergeRemote(rows: Partial<Record<Table, Row[]>>, meta: Meta): MergeResult {
  const apply = { trees: {}, nodes: {}, docs: {}, topics: {}, highlights: {} } as MergeResult["apply"];
  const out = { ...meta };
  for (const t of TABLES) {
    const list = rows[t];
    if (!list?.length) continue;
    const m = { ...meta[t] };
    for (const r of list) {
      const mine = m[r.id];
      if (mine && mine.at > r.updated_at) continue; // ours is newer: it stays dirty and will be pushed
      if (mine && mine.at === r.updated_at && !mine.dirty) continue; // already have it (often our own push)
      apply[t][r.id] = r.deleted ? null : r.data;
      m[r.id] = { at: r.updated_at, deleted: r.deleted || undefined };
    }
    out[t] = m;
  }
  return { apply, meta: out };
}

/** Rows this device still needs to push. */
export function outgoing(local: Tables, meta: Meta): Record<Table, Row[]> {
  const out = { trees: [], nodes: [], docs: [], topics: [], highlights: [] } as Record<Table, Row[]>;
  for (const t of TABLES) {
    for (const [id, m] of Object.entries(meta[t])) {
      if (!m.dirty) continue;
      const rec = local[t][id];
      if (m.deleted || !rec) out[t].push({ id, data: null, updated_at: m.at, deleted: true });
      else out[t].push({ id, data: t === "nodes" ? cleanNode(rec as TreeNode) : rec, updated_at: m.at, deleted: false });
    }
  }
  return out;
}

/** After a push succeeds, clear the dirty flag, unless the record changed again while the push was in flight. */
export function markPushed(meta: Meta, pushed: Record<Table, Row[]>): Meta {
  const out = { ...meta };
  for (const t of TABLES) {
    if (!pushed[t].length) continue;
    const m = { ...meta[t] };
    for (const r of pushed[t]) if (m[r.id]?.at === r.updated_at) m[r.id] = { ...m[r.id], dirty: undefined };
    out[t] = m;
  }
  return out;
}

/** Write merged records back into the store's shapes, keeping existing order and putting new trees first. */
export function applyToState<S extends { trees: Tree[]; nodes: Record<string, TreeNode>; docs: Record<string, Doc>; topics: Topic[]; highlights: Highlight[] }>(s: S, apply: MergeResult["apply"]): Pick<S, "trees" | "nodes" | "docs" | "topics" | "highlights"> {
  const mapTable = <T>(cur: Record<string, T>, patch: Record<string, unknown | null>): Record<string, T> => {
    if (!Object.keys(patch).length) return cur;
    const next = { ...cur };
    for (const [id, v] of Object.entries(patch)) { if (v === null) delete next[id]; else next[id] = v as T; }
    return next;
  };
  const listTable = <T extends { id: string }>(cur: T[], patch: Record<string, unknown | null>, newFirst: boolean): T[] => {
    if (!Object.keys(patch).length) return cur;
    const kept = cur.filter((x) => !(x.id in patch) || patch[x.id] !== null).map((x) => (x.id in patch ? (patch[x.id] as T) : x));
    const have = new Set(cur.map((x) => x.id));
    const added = Object.entries(patch).filter(([id, v]) => v !== null && !have.has(id)).map(([, v]) => v as T);
    return newFirst ? [...added, ...kept] : [...kept, ...added];
  };
  return {
    trees: listTable(s.trees, apply.trees, true),
    nodes: mapTable(s.nodes, apply.nodes),
    docs: mapTable(s.docs, apply.docs),
    topics: listTable(s.topics, apply.topics, false),
    highlights: listTable(s.highlights, apply.highlights, false),
  };
}

/** How far back each pull re-reads before the saved cursor. `server_at` is stamped when a write starts,
 *  so a slow write can commit with a time earlier than rows already pulled; re-reading this window
 *  catches it. Re-reading is harmless because `mergeRemote` skips rows it already has. */
export const PULL_OVERLAP_MS = 2 * 60_000;

/** The `server_at` to pull after, given the saved cursor (an ISO time, or undefined on first pull). */
export function pullSince(cursor: string | undefined, overlapMs = PULL_OVERLAP_MS): string {
  if (!cursor) return "1970-01-01T00:00:00Z";
  const t = Date.parse(cursor);
  if (Number.isNaN(t)) return "1970-01-01T00:00:00Z";
  return new Date(Math.max(0, t - overlapMs)).toISOString();
}
