// Mount a component tree into a container. Returns a disposer that removes the nodes and runs every cleanup.
import { createRoot } from "../core/reactive.ts";
import { insert, clearBetween, removeNode } from "./h.ts";

/** `render(() => <App />, document.getElementById("app"))` */
export function render(fn: () => unknown, container: Element | DocumentFragment | ShadowRoot | null | undefined): () => void {
  if (!container || typeof container.insertBefore !== "function") throw new TypeError("March: render() needs a DOM container.");
  if (typeof fn !== "function") throw new TypeError("March: render() needs a function: render(() => <App />, el).");
  const doc = container.ownerDocument ?? globalThis.document;
  const start = doc.createComment("march"), end = doc.createComment("/march");
  container.append(start, end);
  return createRoot((dispose) => {
    insert(container, fn(), end);
    return () => { dispose(); clearBetween(start, end); removeNode(start); removeNode(end); };
  });
}
