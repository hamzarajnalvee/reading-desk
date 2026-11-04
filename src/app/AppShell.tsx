import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { PanelLeftOpen } from "lucide-react";
import { useStore } from "../store/useStore";
import { Sidebar } from "../components/Sidebar";
import { CommandPalette } from "../components/CommandPalette";
import { Toaster } from "../components/Toaster";
import { useMedia } from "../lib/hooks";

export function AppShell() {
  const ui = useStore((s) => s.ui);
  const setUI = useStore((s) => s.setUI);
  const narrow = useMedia("(max-width: 1024px)");

  useEffect(() => {
    const root = document.documentElement;
    if (ui.theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", ui.theme);
  }, [ui.theme]);
  useEffect(() => { if (narrow) setUI({ sidebarOpen: false }); }, [narrow, setUI]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setUI({ paletteOpen: !useStore.getState().ui.paletteOpen }); }
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") { e.preventDefault(); setUI({ sidebarOpen: !useStore.getState().ui.sidebarOpen }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setUI]);

  const showSidebar = ui.sidebarOpen && !ui.focus;
  return (
    <div className={`shell${showSidebar ? " has-sidebar" : ""}${ui.focus ? " focus" : ""}`}>
      {showSidebar && <Sidebar />}
      {showSidebar && narrow && <div className="sb-shade" onClick={() => setUI({ sidebarOpen: false })} />}
      {!showSidebar && !ui.focus && (
        <button className="sb-reveal icon-btn" aria-label="Show sidebar" onClick={() => setUI({ sidebarOpen: true })}><PanelLeftOpen size={16} /></button>
      )}
      <main className="main"><Outlet /></main>
      <CommandPalette />
      <Toaster />
    </div>
  );
}
