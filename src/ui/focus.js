// Focus helpers: focusable lookup, Tab trapping, roving focus in lists.
const FOCUSABLE = "button,input,select,textarea,a[href],[tabindex],[contenteditable]";

/** Focusable descendants of `root`, in DOM order (disabled, hidden and tabindex="-1" skipped). */
export function focusables(root) {
  return root.querySelectorAll(FOCUSABLE).filter((el) => {
    if (el.disabled || el.getAttribute("tabindex") === "-1" || el.getAttribute("aria-hidden") === "true") return false;
    for (let n = el; n && n !== root; n = n.parentNode) if (n.hidden) return false;
    return true;
  });
}

/** Keep Tab / Shift+Tab inside `root`. Returns the keydown handler (attach it to root). */
export function trapTab(root) {
  return (e) => {
    if (e.key !== "Tab") return;
    const list = focusables(root);
    if (!list.length) { e.preventDefault(); root.focus?.(); return; }
    const first = list[0], last = list[list.length - 1];
    const active = root.ownerDocument.activeElement;
    if (e.shiftKey && (active === first || !root.contains(active))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !root.contains(active))) { e.preventDefault(); first.focus(); }
  };
}

/** Focus `[data-autofocus]`, else the first focusable, else `root` itself. */
export function focusFirst(root) {
  const el = root.querySelector("[data-autofocus]") ?? focusables(root)[0] ?? root;
  el.focus?.();
}

/** Move focus among `items` with arrow keys / Home / End. Returns true when the key was handled. */
export function roving(e, items, { horizontal = false, wrap = true } = {}) {
  const prev = horizontal ? "ArrowLeft" : "ArrowUp", next = horizontal ? "ArrowRight" : "ArrowDown";
  if (![prev, next, "Home", "End"].includes(e.key) || !items.length) return false;
  const i = items.indexOf(e.target.ownerDocument.activeElement);
  let j = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : i + (e.key === next ? 1 : -1);
  if (j < 0) j = wrap ? items.length - 1 : 0;
  if (j >= items.length) j = wrap ? 0 : items.length - 1;
  e.preventDefault();
  items[j].focus();
  return items[j];
}
