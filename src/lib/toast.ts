type Listener = (msg: string | null) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** Show a short confirmation, e.g. toast("Filed under question"). */
export function toast(msg: string, ms = 2800) {
  listeners.forEach((l) => l(msg));
  clearTimeout(timer);
  timer = setTimeout(() => listeners.forEach((l) => l(null)), ms);
}
export function onToast(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
