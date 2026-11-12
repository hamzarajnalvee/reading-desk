// When something fails while drawing the app, show what went wrong and a way back, instead of a blank page.
// `scope="app"` covers the whole window; `scope="card"` covers one card, so the rest of the tree keeps working.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Copy, RotateCw } from "lucide-react";

interface Props { scope: "app" | "card"; children: ReactNode; title?: string }
interface State { error: Error | null; stack: string }

/** Errors that mean the app's own files are out of step (an update, or the dev server's cache), which a reload fixes. */
const STALE = /reading 'use[A-Z]\w*'|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Invalid hook call/i;

export class ErrorScreen extends Component<Props, State> {
  state: State = { error: null, stack: "" };
  static getDerivedStateFromError(error: Error): Partial<State> { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ stack: `${error.stack || error.message}\n\nComponents:${info.componentStack || ""}` });
    console.error(error);
  }
  private copy = () => {
    const { error, stack } = this.state;
    void navigator.clipboard?.writeText(`${error?.message}\n\n${stack}\n\n${location.href}\n${navigator.userAgent}`).catch(() => {});
  };
  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    const stale = STALE.test(error.message);
    const app = this.props.scope === "app";
    return (
      <div className={`error-screen ${app ? "es-app" : "es-card"}`} role="alert" data-testid="error-screen">
        <div className="es-box">
          <AlertTriangle size={app ? 28 : 22} className="es-icon" aria-hidden />
          <h2 className="serif">{app ? "Reading Desk stopped showing this page" : `This card couldn't be shown${this.props.title ? `: ${this.props.title}` : ""}`}</h2>
          <p>{stale
            ? "The app's files changed while it was open (an update, or new packages on the dev server). Reloading picks up the new files."
            : app ? "Something went wrong while drawing the page." : "Something went wrong while drawing this card. The rest of the tree still works."}</p>
          <p className="muted small">Your trees, notes, highlights and files are saved on this device and aren't affected.</p>
          <div className="row">
            <button className="btn btn-primary btn-sm" onClick={() => location.reload()}><RotateCw size={13} />Reload</button>
            {!app && !stale && <button className="btn btn-secondary btn-sm" onClick={() => this.setState({ error: null, stack: "" })}>Try again</button>}
            <button className="btn btn-ghost btn-sm" onClick={this.copy}><Copy size={13} />Copy details</button>
          </div>
          <details className="es-details">
            <summary>What went wrong</summary>
            <pre>{error.message}{stack ? `\n\n${stack}` : ""}</pre>
          </details>
        </div>
      </div>
    );
  }
}
