import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { ErrorScreen } from "./components/ErrorScreen";
import { useStore } from "./store/useStore";
import { startSync } from "./lib/sync";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/shell.css";
import "./styles/cards.css";
import "./styles/screens.css";

let syncStarted = false;
/** Start tracking changes for sync once, after saved data has loaded (so loading isn't mistaken for edits). */
function beginSync() {
  if (syncStarted) return;
  syncStarted = true;
  void startSync();
}

/** Wait for saved data to load from IndexedDB before first render, so the app never flashes sample data. */
function Hydrated({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(useStore.persist.hasHydrated());
  useEffect(() => useStore.persist.onFinishHydration(() => setReady(true)), []);
  useEffect(() => { if (ready) beginSync(); }, [ready]);
  return ready ? <>{children}</> : null;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorScreen scope="app">
      <BrowserRouter>
        <Hydrated><App /></Hydrated>
      </BrowserRouter>
    </ErrorScreen>
  </React.StrictMode>,
);
