// Mount a component tree into a container. Returns a disposer that removes the nodes and runs every cleanup.
import { createRoot, provide } from "../core/reactive.ts";
import { insert, clearBetween, removeNode } from "./insert.ts";
import { DelegateRoot } from "./events.ts";

/** `render(() => <App />, document.getElementById("app"))` */
export function render(fn: () => unknown, container: Element | DocumentFragment | ShadowRoot | null | undefined): () => void {
  // argument checks: development builds only (a production build fails on the same mistake with the browser's error)
  if (globalThis.__MARCH_DEV__ !== false) {
    if (!container || typeof container.insertBefore !== "function") throw new TypeError("March: render() needs a DOM container.");
    if (typeof fn !== "function") throw new TypeError("March: render() needs a function.");
  }
  const host = container as Element | DocumentFragment | ShadowRoot;
  const doc = host.ownerDocument ?? globalThis.document;
  const start = doc.createComment("march"), end = doc.createComment("/march");
  host.append(start, end);
  // a tree mounted in the document (not a shadow root, not detached) delegates onClick-style events to it
  let top: Node = host;
  while (top.parentNode) top = top.parentNode;
  return createRoot((dispose) => {
    if (top.nodeType === 9) provide(DelegateRoot, top as Document);
    insert(host, fn(), end);
    return () => { dispose(); clearBetween(start, end); removeNode(start); removeNode(end); };
  });
}
