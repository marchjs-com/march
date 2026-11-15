// LayerManager: one view of the portal layer stack (dom/portal.ts) — which layer is on top, z-order, the order Escape
// closes them in, and the page scroll lock while a layer that asks for it is open.
//
//   import { layer } from "march/managers/layer";
//   const l = layer.open("popover", node, { onEscape: close, lockScroll: false });   // returns a handle
//   l.close()   l.isTop()   l.index()
//   layer.stack()   layer.top()   layer.modal()   layer.scrollLocked()     // reactive
//   const unlock = layer.lockScroll()                                        // ref-counted, restores on the last unlock
//
// Escape closes the top layer that has an onEscape (a layer opened elsewhere, e.g. a dialog, handles its own Escape;
// one press closes one layer). Layers in the toast / effect bands never take Escape.
import { signal, computed, getOwner, onCleanup, untrack } from "../../core/reactive.ts";
import { openLayer, layers, isModalLayer, type LayerKind } from "../../dom/portal.ts";
import { defineManager, emit } from "../manager.ts";

export interface LayerOptions {
  /** Called on Escape while this is the top layer that listens. Return false to keep it open (and let Escape through). */
  onEscape?: () => unknown;
  /** Lock page scroll while open (default: true for modal kinds — dialog, drawer, palette, lightbox). */
  lockScroll?: boolean;
  /** Name for devtools and the stack listing. */
  label?: string;
}

/** One open layer as the manager sees it. */
export interface LayerInfo { kind: LayerKind; el: HTMLElement; label: string | null; escapable: boolean; modal: boolean; index: number }

export interface LayerHandle {
  readonly el: HTMLElement;
  readonly kind: LayerKind;
  close(): void;
  /** Is this the top layer of the stack (reactive)? */
  isTop(): boolean;
  /** Position in the stack, 0 = bottom (reactive); -1 once closed. */
  index(): number;
}

export interface LayerConfig {
  /** Escape closes the top escapable layer (default true). */
  escape: boolean;
  /** Keep the scrollbar's width as padding while scroll is locked, so the page does not shift (default true). */
  keepGutter: boolean;
}

export interface Layers {
  open(kind: LayerKind, node: Node, opts?: LayerOptions): LayerHandle;
  /** Every open layer, bottom to top (reactive), including layers opened by Portal, dialogs and toasts. */
  stack(): LayerInfo[];
  /** Top layer outside the toast / effect bands, or null (reactive). */
  top(): LayerInfo | null;
  /** A modal layer is open (reactive): the page below is inert. */
  modal(): boolean;
  /** Close the top escapable layer, as Escape would. Returns true when one closed. */
  escape(): boolean;
  /** Lock page scroll; returns unlock. Locks are counted: the page scrolls again after the last unlock. */
  lockScroll(): () => void;
  scrollLocked(): boolean;
  dispose(): void;
}

/** Kinds above the ordinary stack (they never take Escape and never count as "top"). */
const BANDED = new Set<LayerKind>(["toast", "fx", "drag"]);

interface Entry { opts: LayerOptions; close: () => void }

function create(cfg: LayerConfig): Layers {
  const own = new WeakMap<HTMLElement, Entry>();
  const locks = signal(0, { name: "layer.scrollLocks" });
  const doc = globalThis.document as Document | undefined;
  let saved: { overflow: string; pad: string } | null = null;

  const applyLock = (on: boolean): void => {
    const root = doc?.documentElement;
    if (!root?.style) return;
    if (on && !saved) {
      const gutter = cfg.keepGutter ? Math.max(0, (globalThis.innerWidth ?? 0) - (root.clientWidth || (globalThis.innerWidth ?? 0))) : 0;
      saved = { overflow: root.style.getPropertyValue("overflow"), pad: root.style.getPropertyValue("padding-inline-end") };
      root.style.setProperty("overflow", "hidden");
      if (gutter) root.style.setProperty("padding-inline-end", `${gutter}px`);
      root.setAttribute("data-m-scroll-locked", "");
    } else if (!on && saved) {
      const s = saved;
      saved = null;
      if (s.overflow) root.style.setProperty("overflow", s.overflow); else root.style.removeProperty("overflow");
      if (s.pad) root.style.setProperty("padding-inline-end", s.pad); else root.style.removeProperty("padding-inline-end");
      root.removeAttribute("data-m-scroll-locked");
    }
  };
  const lockScroll = (): (() => void) => {
    locks.update((n) => n + 1);
    if (untrack(locks) === 1) { applyLock(true); emit("layer", "scroll-lock", { locked: true }); }
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      locks.update((n) => Math.max(0, n - 1));
      if (untrack(locks) === 0) { applyLock(false); emit("layer", "scroll-lock", { locked: false }); }
    };
  };

  const stack = computed<LayerInfo[]>(() => layers().map((l, index) => {
    const e = own.get(l.el);
    return { kind: l.kind, el: l.el, label: e?.opts.label ?? null, escapable: !!e?.opts.onEscape && !BANDED.has(l.kind), modal: isModalLayer(l.kind), index };
  }));
  const top = computed<LayerInfo | null>(() => { const s = stack(); for (let i = s.length - 1; i >= 0; i--) if (!BANDED.has((s[i] as LayerInfo).kind)) return s[i] as LayerInfo; return null; },
    { equals: (a, b) => a?.el === b?.el && a?.index === b?.index });
  const modal = computed(() => stack().some((l) => l.modal));


  const escape = (): boolean => {
    const t = untrack(top);
    const e = t && own.get(t.el);
    if (!e?.opts.onEscape) return false; // the top layer is someone else's (a dialog): it handles its own Escape
    if (e.opts.onEscape() === false) return false;
    emit("layer", "escape", { kind: (t as LayerInfo).kind, label: (t as LayerInfo).label });
    return true;
  };
  // capture phase on the document: runs before the dialog's bubbling listener, which skips defaultPrevented events
  const onKey = (ev: Event): void => {
    const k = ev as KeyboardEvent;
    if (k.key !== "Escape" || k.defaultPrevented || k.isComposing) return;
    if (escape()) k.preventDefault();
  };
  if (cfg.escape) globalThis.document?.addEventListener("keydown", onKey, true);

  const open = (kind: LayerKind, node: Node, opts: LayerOptions = {}): LayerHandle => {
    const closeLayer = openLayer(kind, node);
    const el = untrack(layers).at(-1)?.el as HTMLElement;
    if (opts.label) el.setAttribute("data-layer-label", opts.label);
    const unlock = (opts.lockScroll ?? isModalLayer(kind)) ? lockScroll() : null;
    let open = true;
    const close = (): void => {
      if (!open) return;
      open = false;
      own.delete(el);
      closeLayer();
      unlock?.();
      emit("layer", "close", { kind, label: opts.label ?? null });
    };
    own.set(el, { opts, close });
    emit("layer", "open", { kind, label: opts.label ?? null });
    if (getOwner()) onCleanup(close);
    const index = (): number => stack().findIndex((l) => l.el === el);
    return { el, kind, close, isTop: () => top()?.el === el, index };
  };

  return {
    open,
    stack,
    top,
    modal,
    escape,
    lockScroll,
    scrollLocked: () => locks() > 0,
    dispose() {
      globalThis.document?.removeEventListener("keydown", onKey, true);
      for (const l of untrack(layers)) own.get(l.el)?.close();
      locks.set(0);
      applyLock(false);
    },
  };
}

const manager = defineManager<Layers, LayerConfig>("layer", create, { escape: true, keepGutter: true });

/** The layer manager. Every method goes to the one instance (created on first use). */
export const layer: Layers = {
  open: (k, n, o) => untrack(() => manager.get()).open(k, n, o),
  stack: () => manager.get().stack(),
  top: () => manager.get().top(),
  modal: () => manager.get().modal(),
  escape: () => manager.get().escape(),
  lockScroll: () => untrack(() => manager.get()).lockScroll(),
  scrollLocked: () => manager.get().scrollLocked(),
  dispose: () => manager.dispose(),
};
/** Set the layer manager's options (merged into the current config). */
export const configureLayers = (config: Partial<LayerConfig>): void => manager.configure(config);
/** Stop the layer manager and remove its listeners; the next call starts it again. */
export const disposeLayers = (): void => manager.dispose();
/** The layer manager (get, configure, dispose). */
export const layerManager = manager;
export type { LayerKind };
