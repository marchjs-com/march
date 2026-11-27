// March — children: put any renderable value into the DOM (text, nodes, arrays, live regions) and take nodes out
// again (leave transitions finish first). Every page that renders loads this module; element props live in dom/props.ts
// and dom/tpl.ts, components in dom/component.ts (h() in dom/h.ts brings them together).
import { effect, onCleanup, DEV } from "../core/reactive.ts";

export const doc = (): Document => globalThis.document;
export const LEAVE: unique symbol = Symbol("m.leave");
/** An element as March keeps it: its leave transition, the sx classes and the user's class value (dom/tpl.ts). */
export type MarchEl = Element & { [LEAVE]?: (() => Promise<void>) | null; __mClass?: string; __mUser?: unknown; style?: CSSStyleDeclaration };
/** >0 while a detached subtree is disposed (a <For> row whose top nodes are removed whole): cleanups skip DOM work
 * on nodes that go away with it. */
export let detaching = 0;
/** Dispose `fn` while its DOM leaves as a whole (no per-node removal inside). */
export function disposeDetached(fn: () => void): void { detaching++; try { fn(); } finally { detaching--; } }

/** Insert any renderable value into `parent` (before `before`). Functions become live regions. */
export function insert(parent: Node, value: unknown, before: Node | null = null, owned?: unknown): void {
  if (typeof value === "function") return region(parent, value as () => unknown, before, owned);
  if (Array.isArray(value)) { for (const v of value) insert(parent, v, before); return; }
  const n = toNode(value);
  if (n) parent.insertBefore(n, before);
}

function toNode(v: unknown): Node | null {
  if (v == null || v === true || v === false) return null;
  if (typeof v === "object" && (v as { nodeType?: number }).nodeType) return v as Node;
  // text (string, number, bigint); anything else is shown as text too, with a warning in development
  if ((globalThis.__MARCH_DEV__ !== false && DEV.enabled) && typeof v !== "string" && typeof v !== "number" && typeof v !== "bigint") DEV.warn("cannot render value", v);
  return doc().createTextNode(String(v));
}

function region(parent: Node, fn: () => unknown, before: Node | null, owned?: unknown): void {
  // A text node marks the start and, while the value is text (the usual case), is the region itself; an end marker
  // is added the first time the value is something else (nodes, a list, nothing). When the effect runs at once
  // (outside batch()), the text node is made with its first value: one node, one insert.
  let start = null as unknown as Text, end: Comment | null = null, last = ""; // last: the text written (no DOM read to compare)
  const place = (s: string): void => { parent.insertBefore((start = doc().createTextNode((last = s))), before); };
  effect(() => {
    const v = fn();
    if (!end && (typeof v === "string" || typeof v === "number")) {
      const s = "" + v;
      if (!start) place(s); else if (last !== s) start.data = last = s;
      return;
    }
    start || place("");
    const host = start.parentNode;
    if (!host) return;
    if (!end) { start.data = last = ""; host.insertBefore((end = doc().createComment("")), start.nextSibling); }
    clearBetween(start, end);
    insert(host, v, end);
  });
  start || place(""); // deferred (inside batch()) or the first run threw: the region keeps its place now
  // inside an element its own owner made (a template clone), the region leaves with that element: no cleanup
  if (!owned) onCleanup(() => { if (!detaching) { if (end) { clearBetween(start, end); removeNode(end); } removeNode(start); } });
}

/** Remove every node between two markers (leave transitions finish first). */
export function clearBetween(start: Node, end: Node): void {
  if (!start.parentNode) return;
  let n = start.nextSibling;
  while (n && n !== end) {
    const next: ChildNode | null = n.nextSibling;
    removeNode(n);
    n = next;
  }
}

export function removeNode(n: Node): void {
  const m = n as unknown as { [LEAVE]?: (() => Promise<void>) | null };
  const leave = m[LEAVE];
  if (leave && n.parentNode) {
    m[LEAVE] = null;
    void leave().then(() => n.parentNode?.removeChild(n));
    return;
  }
  if (n.parentNode) n.parentNode.removeChild(n);
}
