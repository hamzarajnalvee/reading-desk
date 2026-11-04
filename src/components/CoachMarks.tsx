// First-run tips on the tree screen. Four steps; dismissed for good once finished or skipped.
import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

const STEPS = [
  { target: "card", title: "Select any text to branch", body: "Add a note, look up a definition, or branch to another source. Claude only joins in when you choose Explain or Ask." },
  { target: "margin", title: "Branches live in the margin", body: "Each one is tied to the passage it came from. Click a branch to open it as the next card. Drag the dot after a selection into the margin to write a linked note." },
  { target: "card", title: "Slide between cards", body: "Earlier cards fold to the left. Click one, or press [ and ], to go back. Switch to Map to see the whole tree." },
  { target: "understanding", title: "Keep an understanding note", body: "Write what you've understood as you go. It stays with the tree, and you can keep adding to it." },
];

export function CoachMarks() {
  const step = useStore((s) => s.ui.coachStep);
  const setUI = useStore((s) => s.setUI);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (step >= STEPS.length) return;
    const place = () => {
      const t = document.querySelector(`[data-coach="${STEPS[step].target}"]`) || document.querySelector('[data-testid="card"]');
      if (!t) return;
      const r = t.getBoundingClientRect();
      const s = STEPS[step].target;
      const x = s === "margin" ? r.left - 340 : s === "understanding" ? r.right - 320 : r.left + 120;
      const y = s === "understanding" ? r.bottom + 12 : r.top + 140;
      setPos({ x: Math.max(16, Math.min(x, window.innerWidth - 336)), y: Math.max(80, Math.min(y, window.innerHeight - 220)) });
    };
    const t = setTimeout(place, 300);
    window.addEventListener("resize", place);
    return () => { clearTimeout(t); window.removeEventListener("resize", place); };
  }, [step]);
  if (step >= STEPS.length || !pos) return null;
  const s = STEPS[step];
  return (
    <div className="coach" style={{ left: pos.x, top: pos.y }} role="dialog" aria-label="Tip">
      <div className="mono-label">Tip {step + 1} of {STEPS.length}</div>
      <h4 className="serif">{s.title}</h4>
      <p>{s.body}</p>
      <div className="coach-actions">
        <button className="link-btn" onClick={() => setUI({ coachStep: STEPS.length })}>Skip</button>
        <button className="btn btn-primary btn-sm" onClick={() => setUI({ coachStep: step + 1 })}>{step === STEPS.length - 1 ? "Done" : "Next"}</button>
      </div>
    </div>
  );
}
