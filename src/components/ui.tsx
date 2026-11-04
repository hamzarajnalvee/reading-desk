// Small shared UI primitives. See /components in the running app for every variant.
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import type { Source } from "../data/types";
import { md } from "../lib/util";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md"; icon?: ReactNode };
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = "secondary", size = "md", icon, children, className = "", ...rest }, ref) {
  return (
    <button ref={ref} className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
});

export function IconButton({ label, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>{children}</button>;
}

export function Segmented<T extends string>({ value, options, onChange, size = "md", label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: "sm" | "md"; label: string }) {
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Pill({ children, tone = "neutral", onClick }: { children: ReactNode; tone?: "neutral" | "accent"; onClick?: () => void }) {
  const C = onClick ? "button" : "span";
  return <C className={`pill pill-${tone}`} onClick={onClick}>{children}</C>;
}

export function SourceChip({ source }: { source: Source }) {
  const host = source.url ? (() => { try { return new URL(source.url).hostname; } catch { return ""; } })() : "";
  const fav = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=32` : "";
  return (
    <span className="source-chip">
      {fav ? <img src={fav} alt="" width={14} height={14} /> : <i className="source-dot" />}
      <span className="site">{source.site || host || "Unknown source"}</span>
      {source.title && <><span className="sep">·</span><span className="title">{source.title}</span></>}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) { return <kbd className="kbd">{children}</kbd>; }

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: md(text) }} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3 className="serif">{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
