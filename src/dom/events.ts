// March — event handlers. A plain handler (onClick, no modifiers) goes through _on: delegated to the document of a
// render() tree when it is one of the delegated events, else a direct listener. dom/props.ts adds the modifiers (on:x|y).
import { batch, onCleanup, useContext } from "../core/reactive.ts";
import { detaching } from "./insert.ts";

// Event delegation: `onClick`, `onInput`, `onKeyDown`… without modifiers, on elements of a tree mounted with render()
// into a document, are kept on the element and run by one document listener per event type, walking from the target
// up (bubble order; stopPropagation stops the walk; currentTarget is the element, as with a direct listener).
// `on:click` (the colon form, with or without modifiers) always adds a direct listener.
/** Delegated event type → the element key its handler is kept under (built once: no string per bound handler). */
export const DELEGATED = new Map(["click", "dblclick", "input", "keydown", "keyup"].map((t) => [t, `$m${t}`]));
/** The document a render() tree delegates its events to (null: direct listeners). */
export const DelegateRoot: { id: symbol; defaultValue: Document | null } = { id: Symbol("m.delegate"), defaultValue: null };
function dispatch(e: Event): void {
  // a March-only key: other libraries on the same page (Solid) keep their own delegated handlers under `$$click`
  const key = DELEGATED.get(e.type) as string;
  let n = (e.composedPath?.()[0] ?? e.target) as (Node & Record<string, unknown> & { host?: Node }) | null;
  try {
    while (n && n.nodeType !== 9) {
      const h = n[key] as ((this: Node, e: Event) => void) | undefined;
      if (h) {
        const at = n;
        Object.defineProperty(e, "currentTarget", { configurable: true, value: at });
        batch(() => h.call(at, e));
        if (e.cancelBubble) break;
      }
      n = (n.parentNode ?? n.host ?? null) as typeof n;
    }
  } finally { delete (e as unknown as Record<string, unknown>)["currentTarget"]; }
}


/**
 * A plain event handler (`onClick={fn}`, no modifiers) on an element: kept on the element for the delegated events of a
 * render() tree, else a direct listener removed with its owner. Compiler helper; h() and _prop() use it too.
 */
export function _on(el: Element, name: string, handler: unknown): void {
  if (handler == null || handler === false) return;
  if (globalThis.__MARCH_DEV__ !== false && typeof handler !== "function") throw new TypeError(`March: on${name} handler must be a function.`);
  // onClick-style handlers inside a render() tree: one listener per event type on the document
  const key = DELEGATED.get(name);
  if (key) {
    const d = useContext(DelegateRoot);
    if (d) {
      (el as unknown as Record<string, unknown>)[key] = handler;
      const on = ((d as unknown as { $m?: Set<string> }).$m ??= new Set());
      if (!on.has(name)) { on.add(name); d.addEventListener(name, dispatch); }
      return;
    }
  }
  const fn = (e: Event): void => batch(() => (handler as (this: Element, e: Event) => void).call(el, e));
  el.addEventListener(name, fn);
  onCleanup(() => { if (!detaching) el.removeEventListener(name, fn); });
}
