// Original files (PDFs) kept beside their text, so a source can be shown as its real pages.
// Kept on this device in IndexedDB and, when signed in, in the private Supabase Storage bucket `originals`
// (one folder per user, readable only by them). Files saved while signed out go up after the next sync.
import { del, get, set } from "idb-keyval";
import { currentSession, getSupabase } from "./supabase";

const BUCKET = "originals";
const localKey = (docId: string) => `original:${docId}`;
const PENDING = "originals-pending";
const remotePath = (userId: string, docId: string) => `${userId}/${docId}.pdf`;

/** Keep a source's original file here, and upload it if signed in. */
export async function keepOriginal(docId: string, file: Blob): Promise<void> {
  await set(localKey(docId), file);
  if (!(await upload(docId, file))) await set(PENDING, [...new Set([...((await get<string[]>(PENDING)) ?? []), docId])]);
}

/** The original file: from this device, or downloaded from your account (and kept here after). Null if neither has it. */
export async function getOriginal(docId: string): Promise<Blob | null> {
  const local = await get<Blob>(localKey(docId)).catch(() => undefined);
  if (local) return local;
  const sb = await getSupabase(), s = await currentSession();
  if (!sb || !s) return null;
  const { data, error } = await sb.storage.from(BUCKET).download(remotePath(s.user.id, docId));
  if (error || !data) return null;
  await set(localKey(docId), data).catch(() => {});
  return data;
}

export async function forgetOriginal(docId: string): Promise<void> {
  await del(localKey(docId)).catch(() => {});
  const sb = await getSupabase(), s = await currentSession();
  if (sb && s) await sb.storage.from(BUCKET).remove([remotePath(s.user.id, docId)]).catch(() => {});
}

async function upload(docId: string, file: Blob): Promise<boolean> {
  const sb = await getSupabase(), s = await currentSession().catch(() => null);
  if (!sb || !s) return false;
  const { error } = await sb.storage.from(BUCKET).upload(remotePath(s.user.id, docId), file, { upsert: true, contentType: file.type || "application/pdf" });
  return !error;
}

/** Upload originals that were kept while signed out or offline. */
export async function uploadPendingOriginals(): Promise<void> {
  const pending = (await get<string[]>(PENDING)) ?? [];
  if (!pending.length) return;
  const left: string[] = [];
  for (const id of pending) {
    const f = await get<Blob>(localKey(id));
    if (f && !(await upload(id, f))) left.push(id);
  }
  await set(PENDING, left);
}
