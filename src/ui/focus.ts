// Focus helpers: focusable lookup, Tab trapping, roving focus in lists.
const FOCUSABLE = "button,input,select,textarea,a[href],[tabindex],[contenteditable]";

type Focusable = HTMLElement & { disabled?: boolean };

/** Focusable descendants of `root`, in DOM order (disabled, hidden and tabindex="-1" skipped). */
export function focusables(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<Focusable>(FOCUSABLE)).filter((el) => {
    if (el.disabled || el.getAttribute("tabindex") === "-1" || el.getAttribute("aria-hidden") === "true") return false;
    for (let n: Node | null = el; n && n !== root; n = n.parentNode) if ((n as HTMLElement).hidden) return false;
    return true;
  });
}

/** Keep Tab / Shift+Tab inside `root`. Returns the keydown handler (attach it to root). */
export function trapTab(root: HTMLElement): (e: KeyboardEvent) => void {
  return (e) => {
    if (e.key !== "Tab") return;
    const list = focusables(root);
    const first = list[0], last = list[list.length - 1];
    if (!first || !last) { e.preventDefault(); root.focus?.(); return; }
    const active = root.ownerDocument.activeElement;
    if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus(); }
  };
}

/** Focus `[data-autofocus]`, else the first focusable, else `root` itself. */
export function focusFirst(root: HTMLElement): void {
  const el = root.querySelector<HTMLElement>("[data-autofocus]") ?? focusables(root)[0] ?? root;
  el.focus?.();
}

export interface RovingOptions { horizontal?: boolean; wrap?: boolean; /** Right to left: ArrowLeft is "next" (horizontal only). */ rtl?: boolean }

/** Move focus among `items` with arrow keys / Home / End. Returns the focused item when the key was handled, else false. */
export function roving<T extends HTMLElement>(e: KeyboardEvent, items: readonly T[], { horizontal = false, wrap = true, rtl = false }: RovingOptions = {}): T | false {
  const prev = horizontal ? (rtl ? "ArrowRight" : "ArrowLeft") : "ArrowUp", next = horizontal ? (rtl ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
  if (![prev, next, "Home", "End"].includes(e.key) || !items.length) return false;
  const i = items.indexOf((e.target as Node).ownerDocument?.activeElement as T);
  let j = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : i + (e.key === next ? 1 : -1);
  if (j < 0) j = wrap ? items.length - 1 : 0;
  if (j >= items.length) j = wrap ? 0 : items.length - 1;
  e.preventDefault();
  const el = items[j] as T;
  el.focus();
  return el;
}
