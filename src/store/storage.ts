import { get, set, del } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

/** IndexedDB storage for zustand's persist middleware. Holds far more than localStorage (books, reports). */
export const idbStorage: StateStorage = {
  getItem: async (name) => (await get(name)) ?? null,
  setItem: async (name, value) => { await set(name, value); },
  removeItem: async (name) => { await del(name); },
};
