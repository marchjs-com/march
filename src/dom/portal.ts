// Portals and layers: content rendered by one component, shown somewhere else in the document. Ownership, context
// (theme, i18n, providers) and cleanup stay with the component that renders it; only the DOM nodes move.
//
//   <Portal layer="dialog">…</Portal>          a layer above the page: one stack for dialogs, drawers, popovers, menus,
//                                              tooltips, the palette, toasts and effects — the last opened is on top,
//                                              a modal layer makes the page and the layers below it inert
//   <PortalTarget name="toolbar" />            a named place (the app shell's top bar, a side panel…)
//   <Portal to="toolbar" order={10}>…</Portal> content for it: several sources share one target, sorted by order; when
//                                              the source goes away its content leaves the target; when the target is
//                                              not there yet (a lazy shell part) the content waits and moves in later
//   openLayer("toast", node)                   imperative form (returns close)
import { signal, effect, onCleanup, getOwner, untrack, type Signal } from "../core/reactive.ts";
import { h, insert } from "./h.ts";

export type LayerKind = "popover" | "menu" | "tooltip" | "dialog" | "drawer" | "palette" | "lightbox" | "toast" | "fx" | "drag";
/** Layers that take the page's interaction away while open (everything under them becomes inert). */
const MODAL = new Set<LayerKind>(["dialog", "drawer", "palette", "lightbox"]);
/** Bands: most layers stack in the order they open; toasts and effects stay above them. */
const BAND: Partial<Record<LayerKind, string>> = { toast: "var(--hm-z-toast, 200)", fx: "var(--hm-z-drag, 250)", drag: "var(--hm-z-drag, 250)" };

interface Layer { el: HTMLElement; kind: LayerKind }
const stack: Layer[] = [];
let root: HTMLElement | null = null;
const inerted = new Set<Element>();
/** Bumped on every open / close, so layers() is reactive (the Layer manager and devtools follow the stack). */
const stackRev = signal(0, { name: "layers" });

// the few styles a portal needs are set here (CSSOM: CSP safe), so the core needs no stylesheet: a box adds no layout
// box; a layer covers the viewport without taking pointer events, its content takes them again (inherited)
const contents = (el: HTMLElement, pointer?: "auto"): HTMLElement => { el.style.setProperty("display", "contents"); if (pointer) el.style.setProperty("pointer-events", pointer); return el; };
function layerRoot(): HTMLElement {
  const d = globalThis.document;
  if (!root || !root.isConnected) { root = contents(h("div", { class: "hm-layers" }) as HTMLElement); d.body.appendChild(root); }
  return root;
}

/** Recompute order (z-index) and inertness after a layer opens or closes. */
function restack(): void {
  stackRev.update((n) => n + 1);
  stack.forEach((l, i) => l.el.style.setProperty("z-index", `calc(${BAND[l.kind] ?? "var(--hm-z-dialog, 100)"} + ${i})`));
  for (const el of inerted) el.removeAttribute("inert");
  inerted.clear();
  let top = -1;
  stack.forEach((l, i) => { if (MODAL.has(l.kind)) top = i; });
  if (top < 0) return;
  const set = (el: Element): void => { if (!el.hasAttribute("inert")) { el.setAttribute("inert", ""); inerted.add(el); } };
  for (const el of globalThis.document.body.children) if (el !== root && el.tagName !== "SCRIPT") set(el);
  stack.forEach((l, i) => { if (i < top && BAND[l.kind] === undefined) set(l.el); });
}

/** Put a node into a new layer of the stack; returns close (removes it and restacks). */
export function openLayer(kind: LayerKind, node: Node): () => void {
  const el = h("div", { class: "hm-layer", "data-layer": kind }) as HTMLElement;
  for (const [k, v] of [["position", "fixed"], ["inset", "0"], ["pointer-events", "none"]] as const) el.style.setProperty(k, v);
  // the content sits in a box that gives pointer events back (a Portal's own box, or a new one around a plain node)
  const isBox = (node as HTMLElement).classList?.contains?.("hm-portal");
  const box = isBox ? (node as HTMLElement) : contents(h("div", { class: "hm-portal" }) as HTMLElement, "auto");
  if (!isBox) box.appendChild(node);
  el.appendChild(box);
  const entry: Layer = { el, kind };
  stack.push(entry);
  layerRoot().appendChild(el);
  restack();
  let open = true;
  return () => {
    if (!open) return;
    open = false;
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    el.remove();
    restack();
  };
}

/** Open layers, bottom to top (for tests and devtools). */
export const layers = (): readonly { kind: LayerKind; el: HTMLElement }[] => { stackRev(); return stack.slice(); };
/** Layer kinds that make everything below them inert. */
export const isModalLayer = (kind: LayerKind): boolean => MODAL.has(kind);

// ------------------------------------------------------------------ named targets
const targets = new Map<string, Signal<Element | null>>();
const targetSig = (name: string): Signal<Element | null> => { let s = targets.get(name); if (!s) targets.set(name, (s = signal<Element | null>(null))); return s; };

export interface PortalTargetProps { name: string; class?: string; as?: string; label?: string; [attr: string]: unknown }
/** A named place that portals render into. Several can exist over time; the latest mounted one is used. */
export function PortalTarget(props: PortalTargetProps): Element {
  const { name, as, label } = props;
  const rest: Record<string, unknown> = { ...props };
  for (const k of ["name", "as", "label", "class"]) delete rest[k];
  const el = h(as ?? "div", { ...rest, class: `hm-portal-target${props.class ? ` ${props.class}` : ""}`, "data-portal-target": name, "aria-label": label ?? null }) as Element;
  const s = targetSig(name);
  const prev = untrack(s);
  s.set(el);
  if (getOwner()) onCleanup(() => { if (untrack(s) === el) s.set(prev?.isConnected ? prev : null); });
  return el;
}
/** The element of a named target (reactive), or null while there is none. */
export const portalTarget = (name: string): Element | null => targetSig(name)();

export interface PortalProps {
  /** A named target (<PortalTarget name>). */
  to?: string;
  /** Order among the sources of one target (ascending; equal = mount order). */
  order?: number;
  /** A layer of the stack (default "popover" when neither `to` nor `mount` is given). */
  layer?: LayerKind;
  /** A specific element. */
  mount?: Element | DocumentFragment;
  children?: unknown;
}

/** Render children somewhere else: a layer, a named target or an element. Returns nothing in place. */
export function Portal(props: PortalProps): null {
  const box = contents(h("div", { class: "hm-portal", "data-order": props.order ?? 0 }) as HTMLElement, "auto");
  insert(box, () => props.children);
  if (props.to) {
    const name = props.to, order = props.order ?? 0;
    effect(() => {
      const t = targetSig(name)();
      if (!t) { box.remove(); return; }
      if (box.parentNode === t) return;
      const after = [...t.children].find((c) => c !== box && Number((c as HTMLElement).dataset?.["order"] ?? 0) > order) ?? null;
      t.insertBefore(box, after);
    });
    onCleanup(() => box.remove());
  } else if (props.mount) {
    props.mount.appendChild(box);
    onCleanup(() => box.remove());
  } else onCleanup(openLayer(props.layer ?? "popover", box));
  return null;
}
