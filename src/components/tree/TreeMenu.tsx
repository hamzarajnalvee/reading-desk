// The ⋯ menu in a tree's header: lock it against changes, or delete it.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, MoreHorizontal, Trash2, Unlock } from "lucide-react";
import type { Tree } from "../../data/types";
import { useStore } from "../../store/useStore";
import { toast } from "../../lib/toast";
import { plural } from "../../lib/util";

export function TreeMenu({ tree, branchCount }: { tree: Tree; branchCount: number }) {
  const { updateTree, deleteTree } = useStore.getState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  useEffect(() => { if (!open) setConfirming(false); }, [open]);

  const toggleLock = () => {
    updateTree(tree.id, { locked: !tree.locked });
    toast(tree.locked ? "Unlocked. You can change this tree again." : "Locked. Nothing in this tree can be changed until you unlock it.");
    setOpen(false);
  };
  const remove = () => {
    deleteTree(tree.id);
    toast(`Deleted “${tree.title}”`);
    navigate("/");
  };

  return (
    <div className="tree-menu" ref={ref}>
      <button className="icon-btn" aria-label="Tree options" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}><MoreHorizontal size={16} /></button>
      {open && (
        <div className="popover tree-menu-pop" role="menu">
          <button role="menuitem" onClick={toggleLock}>
            {tree.locked ? <><Unlock size={14} />Unlock tree</> : <><Lock size={14} />Lock tree</>}
          </button>
          {tree.locked ? (
            <p className="muted small pad">Unlock this tree to delete it.</p>
          ) : confirming ? (
            <div className="tree-menu-confirm">
              <p className="small">Delete “{tree.title}” and its {plural(branchCount, "branch", "branches")}? This can't be undone.</p>
              <div className="row">
                <button className="btn btn-danger btn-sm" onClick={remove}>Delete tree</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button role="menuitem" className="danger" onClick={() => setConfirming(true)}><Trash2 size={14} />Delete tree…</button>
          )}
        </div>
      )}
    </div>
  );
}
