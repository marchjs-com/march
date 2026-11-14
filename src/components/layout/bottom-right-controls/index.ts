// Page corners (hadi-march/layout): four fixed corners — top-start, top-end, bottom-start, bottom-end (start/end
// mirror in RTL) — that page-wide controls put themselves into: a back-to-top button, a chat bubble, a feedback button,
// a connection badge. Controls do not each pick a fixed position and overlap: they stack in their corner, in `order`.
// BottomRightControls is the bottom-end corner (the one most controls want).
//
//   addCornerControl("bottom-end", node, 10)       // lower order = nearer the corner edge; returns off()
//   <BottomRightControls />                         // optional: render the corner yourself (else made on first use)
import "./bottom-right-controls.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { onCleanup } from "../../../core/reactive.ts";
import { owned } from "../../../ui/observe.ts";
import { openLayer } from "../../../dom/portal.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../core/util.ts";

export type Corner = "top-start" | "top-end" | "bottom-start" | "bottom-end";
/** The four corners a control can sit in, in logical terms (start / end follow the writing direction). */
export const CORNERS: readonly Corner[] = ["top-start", "top-end", "bottom-start", "bottom-end"];

const hosts = new Map<Corner, HTMLElement>();
const orders = new WeakMap<Node, number>();

/** What a rendered corner accepts. */
export interface CornerControlsProps {
  corner?: Corner;
  /** Accessible name of the corner group (default "Page controls"). */
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}

function make(corner: Corner, props: CornerControlsProps = {}): HTMLElement {
  return h("div", { class: () => cx(`m-corner m-corner-${corner}`, val(props.class)), "data-corner": corner, role: "group", "aria-label": () => val(props.label) ?? t`Page controls` }) as HTMLElement;
}

/** The element of a corner: the rendered one, else made and put at the end of <body>. */
export function cornerControls(corner: Corner = "bottom-end"): HTMLElement {
  const el = hosts.get(corner);
  if (el && el.isConnected) return el;
  const made = make(corner);
  // a layer of the page (under dialogs, which make it inert while open), never body.append
  openLayer("popover", made);
  hosts.set(corner, made);
  return made;
}

/** Put a control into a corner, kept in `order` (lower = nearer the edge). Returns off(); inside a component it is
 *  also taken out when the component goes away. */
export function addCornerControl(corner: Corner, node: Node, order = 0): () => void {
  const el = cornerControls(corner);
  orders.set(node, order);
  let before: Node | null = null;
  for (let c = el.firstChild; c; c = c.nextSibling) if ((orders.get(c) ?? 0) > order) { before = c; break; }
  el.insertBefore(node, before);
  return owned((): void => { node.parentNode?.removeChild(node); });
}

/** Renders a corner in place; controls added to it go in here (a corner made earlier hands its controls over). */
export function CornerControls(props: CornerControlsProps = {}): Element {
  const corner = props.corner ?? "bottom-end";
  const el = make(corner, props);
  const old = hosts.get(corner);
  if (old && old !== el) { while (old.firstChild) el.appendChild(old.firstChild); old.remove(); }
  hosts.set(corner, el);
  onCleanup(() => { if (hosts.get(corner) === el) hosts.delete(corner); });
  return el;
}

/** The bottom-end corner (right in LTR, left in RTL). */
export function BottomRightControls(props: Omit<CornerControlsProps, "corner"> = {}): Element {
  return CornerControls({ corner: "bottom-end", get label() { return props.label; }, get class() { return props.class; } });
}
/** Put a control into the bottom-end corner. */
export const addBottomRightControl = (node: Node, order = 0): (() => void) => addCornerControl("bottom-end", node, order);
/** The bottom-end corner element. */
export const bottomRightControls = (): HTMLElement => cornerControls("bottom-end");
