// Export and import a full backup of the desk as JSON.
import { useStore, type Data } from "../store/useStore";

export function exportBackup() {
  const { trees, nodes, docs, topics, highlights, chats } = useStore.getState();
  const data = { app: "reading-desk", version: 2, exportedAt: new Date().toISOString(), trees, nodes, docs, topics, highlights, chats };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `reading-desk-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importBackup(file: File): Promise<void> {
  const j = JSON.parse(await file.text());
  if (j.app !== "reading-desk" || !Array.isArray(j.trees) || typeof j.nodes !== "object") throw new Error("That isn't a Reading Desk backup.");
  const d: Omit<Data, "ui"> = { trees: j.trees, nodes: j.nodes, docs: j.docs || {}, topics: j.topics || [], highlights: j.highlights || [], chats: j.chats || {} };
  useStore.getState().importData(d);
}
