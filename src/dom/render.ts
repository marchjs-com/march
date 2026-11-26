// Mount a component tree into a container. Returns a disposer that removes the nodes and runs every cleanup.
import { createRoot, provide } from "../core/reactive.ts";
import { insert, clearBetween, removeNode } from "./insert.ts";
import { DelegateRoot } from "./events.ts";

/** `render(() => <App />, document.getElementById("app"))` */
export function render(fn: () => unknown, container: Element | DocumentFragment | ShadowRoot | null | undefined): () => void {
  if (!container || typeof container.insertBefore !== "function") throw new TypeError("March: render() needs a DOM container.");
  if (typeof fn !== "function") throw new TypeError("March: render() needs a function.");
  const doc = container.ownerDocument ?? globalThis.document;
  const start = doc.createComment("march"), end = doc.createComment("/march");
  container.append(start, end);
  // a tree mounted in the document (not a shadow root, not detached) delegates onClick-style events to it
  let top: Node = container;
  while (top.parentNode) top = top.parentNode;
  return createRoot((dispose) => {
    if (top.nodeType === 9) provide(DelegateRoot, top as Document);
    insert(container, fn(), end);
    return () => { dispose(); clearBetween(start, end); removeNode(start); removeNode(end); };
  });
}
