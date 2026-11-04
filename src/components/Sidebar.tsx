import { NavLink, useNavigate } from "react-router-dom";
import { BookOpen, Download, MoreHorizontal, Moon, Monitor, PanelLeftClose, Plus, Search, Sun, Tags, Trees, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { Kbd } from "./ui";
import { AddDialog } from "./tree/AddDialog";
import { exportBackup, importBackup } from "../lib/backup";
import { timeAgo } from "../lib/util";
import { toast } from "../lib/toast";
import { useSync } from "../lib/sync";

export function Sidebar() {
  const trees = useStore((s) => s.trees);
  const theme = useStore((s) => s.ui.theme);
  const savedAt = useStore((s) => s.ui.lastSavedAt);
  const sync = useSync();
  const { setUI } = useStore.getState();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recent = useMemo(() => [...trees].sort((a, b) => (b.lastOpenedAt || b.updatedAt) - (a.lastOpenedAt || a.updatedAt)).slice(0, 10), [trees]);
  const nextTheme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";

  return (
    <nav className="sidebar" aria-label="Navigation">
      <div className="sb-brand">
        <BookOpen size={20} strokeWidth={1.6} className="accent" />
        <span className="serif">Reading Desk</span>
        <button className="icon-btn" aria-label="Hide sidebar" onClick={() => setUI({ sidebarOpen: false })}><PanelLeftClose size={16} /></button>
      </div>
      <button className="sb-search" onClick={() => setUI({ paletteOpen: true })}><Search size={14} /><span>Search</span><Kbd>⌘K</Kbd></button>
      <button className="btn btn-primary sb-new" onClick={() => setAdding(true)}><Plus size={15} />New tree</button>

      <div className="sb-section">
        <NavLink to="/" end className="sb-item"><Trees size={16} strokeWidth={1.7} /><span>Your trees</span><span className="sb-count tabular">{trees.length}</span></NavLink>
        <NavLink to="/topics" className="sb-item"><Tags size={16} strokeWidth={1.7} /><span>Topics</span></NavLink>
      </div>

      {recent.length > 0 && (
        <div className="sb-section">
          <span className="mono-label sb-label">Recent</span>
          {recent.map((t) => <NavLink key={t.id} to={`/tree/${t.id}`} className="sb-tree"><span className="sb-tree-dot" /><span className="sb-tree-title">{t.title}</span></NavLink>)}
        </div>
      )}

      <div className="sb-foot">
        <button className="sb-me sb-sync" onClick={() => navigate("/sign-in")} data-testid="sync-status" aria-label="Sync settings">
          {sync.email ? (
            <><span>{sync.status === "syncing" ? "Syncing…" : sync.status === "offline" ? "Offline — saved on this device" : sync.status === "error" ? "Couldn't sync" : sync.lastSyncedAt ? `Synced ${timeAgo(sync.lastSyncedAt).toLowerCase()}` : "Syncing…"}</span>
              <span className="muted small">{sync.status === "error" ? "Open to retry" : sync.email}</span></>
          ) : (
            <><span>Saved on this device</span>
              <span className="muted small">{sync.configured ? "Sign in to sync" : savedAt ? `Last change ${timeAgo(savedAt)}` : "All changes save automatically"}</span></>
          )}
        </button>
        <div className="sb-menu-wrap">
          <button className="icon-btn" aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><MoreHorizontal size={16} /></button>
          {menu && (
            <div className="popover sb-menu" onMouseLeave={() => setMenu(false)}>
              <button onClick={() => { exportBackup(); setMenu(false); }}><Download size={14} />Export backup</button>
              <button onClick={() => fileRef.current?.click()}><Upload size={14} />Import backup…</button>
              <button onClick={() => { setUI({ theme: nextTheme }); }}>{theme === "dark" ? <Moon size={14} /> : theme === "light" ? <Sun size={14} /> : <Monitor size={14} />}Theme: {theme}</button>
              <button onClick={() => { navigate("/components"); setMenu(false); }}>Component gallery</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
            try { await importBackup(f); toast("Backup imported"); navigate("/"); } catch (err) { toast((err as Error).message); }
            setMenu(false);
          }} />
        </div>
      </div>
      {adding && <AddDialog mode="tree" onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); navigate(`/tree/${id}`); }} />}
    </nav>
  );
}
