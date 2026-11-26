// FocusManager: where keyboard focus is and where it goes back to. Focus traps (stacked: only the newest is active),
// focus restore, focus-visible (the last input was a keyboard) and roving tabindex for toolbars, lists and grids.
//
//   import { focus } from "march/managers/focus";
//   const release = focus.trap(panel)            // Tab stays inside; release() gives focus back to where it was
//   const back = focus.remember(); …; back()     // restore later
//   focus.visible()                              // reactive: the user is moving with the keyboard (data-m-focus-visible on <html>)
//   focus.roving(toolbar, { orientation: "horizontal" })   // one Tab stop, arrow keys inside
//   <div focus:trap>…</div>   <div focus:roving="horizontal">…</div>
//
// The low-level pieces (focusables, trapTab, focusFirst, roving) come from ui/focus.ts and are reused, not copied.
// Roving lives in the behaviors layer (src/behaviors/roving-focus); the trap stack stays here (only the newest trap is
// active, which needs one app-wide owner).
import { signal, untrack, getOwner, runWithOwner, onCleanup } from "../../core/reactive.ts";
import { registerNamespace } from "../../dom/props.ts";
import { focusables, trapTab, focusFirst } from "../../ui/focus.ts";
import { rovingFocus, type RovingOptions } from "../../behaviors/roving-focus/index.ts";
import { defineManager, emit } from "../manager.ts";

export type Modality = "keyboard" | "pointer";

export interface TrapOptions {
  /** Focus this element first (default: [data-autofocus], else the first focusable, else the container). */
  initial?: HTMLElement | null;
  /** Give focus back on release (default true). */
  restore?: boolean;
  /** Focus that leaves the container (a click outside, a script) is pulled back (default true). */
  contain?: boolean;
}

export type { RovingOptions };

export interface FocusConfig {
  /** Write data-m-focus-visible on <html> while the keyboard is in use (default true). */
  markRoot: boolean;
}

export interface Focus {
  /** Trap Tab inside `el`. Traps stack; the newest is active. Returns release. Released with the current owner. */
  trap(el: HTMLElement, opts?: TrapOptions): () => void;
  /** Is a trap active (reactive)? */
  trapped(): boolean;
  /** Remember the focused element now; the returned function focuses it again (if still in the page). */
  remember(): () => void;
  /** Move focus to `el`, or to its first focusable child. */
  focusIn(el: HTMLElement): void;
  /** The last input was a keyboard (reactive): show focus rings. */
  visible(): boolean;
  modality(): Modality;
  /** Arrow keys move among the items of `container`; only the active item is a Tab stop. Returns stop. */
  roving(container: HTMLElement, opts?: RovingOptions): () => void;
  /** The focused element (reactive, follows focusin). */
  active(): Element | null;
  dispose(): void;
}

interface Trap { el: HTMLElement; opts: TrapOptions; restore: () => void; onKey: (e: KeyboardEvent) => void }

function create(cfg: FocusConfig): Focus {
  const doc = globalThis.document as Document | undefined;
  const offs: (() => void)[] = [];
  const on = (t: EventTarget | undefined, type: string, fn: (e: Event) => void, capture = true): void => {
    if (!t?.addEventListener) return;
    t.addEventListener(type, fn, capture);
    offs.push(() => t.removeEventListener(type, fn, capture));
  };

  // ---- modality / focus-visible
  const modality = signal<Modality>("pointer", { name: "focus.modality" });
  const active = signal<Element | null>(doc?.activeElement ?? null, { name: "focus.active" });
  const setModality = (m: Modality): void => {
    if (untrack(modality) === m) return;
    modality.set(m);
    if (cfg.markRoot) { const r = doc?.documentElement; if (m === "keyboard") r?.setAttribute("data-m-focus-visible", ""); else r?.removeAttribute("data-m-focus-visible"); }
    emit("focus", "modality", { modality: m });
  };
  on(doc, "keydown", (e) => { const k = e as KeyboardEvent; if (!k.metaKey && !k.ctrlKey && !k.altKey) setModality("keyboard"); });
  on(doc, "pointerdown", () => setModality("pointer"));
  on(doc, "mousedown", () => setModality("pointer"));

  // ---- traps
  const traps = signal<Trap[]>([], { name: "focus.traps" });
  const top = (): Trap | undefined => untrack(traps).at(-1);
  const remember = (): (() => void) => {
    const el = doc?.activeElement as HTMLElement | null;
    return () => { if (el && el !== doc?.body && el.isConnected) el.focus?.(); };
  };
  on(doc, "focusin", (e) => {
    active.set(e.target as Element);
    const t = top();
    // behavior: contain — focus that escaped the active trap goes back in
    if (t && t.opts.contain !== false && !t.el.contains(e.target as Node)) focusFirst(t.el);
  });
  on(doc, "keydown", (e) => { const t = top(); if (t) t.onKey(e as KeyboardEvent); });

  const trap = (el: HTMLElement, opts: TrapOptions = {}): (() => void) => {
    // behavior: trap — Tab and Shift+Tab cycle inside el (ui/focus.ts trapTab)
    const entry: Trap = { el, opts, restore: remember(), onKey: trapTab(el) };
    traps.update((l) => [...l, entry]);
    if (!el.hasAttribute("tabindex") && !focusables(el).length) el.setAttribute("tabindex", "-1");
    if (opts.initial) opts.initial.focus?.(); else focusFirst(el);
    emit("focus", "trap", { depth: untrack(traps).length });
    let held = true;
    const release = (): void => {
      if (!held) return;
      held = false;
      const wasTop = top() === entry;
      traps.update((l) => l.filter((x) => x !== entry));
      if (opts.restore !== false && wasTop) entry.restore();
      emit("focus", "release", { depth: untrack(traps).length });
    };
    if (getOwner()) onCleanup(release);
    return release;
  };

  // behavior: roving tabindex (src/behaviors/roving-focus), released with the current owner
  const roving = (container: HTMLElement, opts: RovingOptions = {}): (() => void) => {
    const stop = rovingFocus(container, opts);
    if (getOwner()) onCleanup(stop);
    return stop;
  };

  return {
    trap,
    trapped: () => traps().length > 0,
    remember,
    focusIn: (el) => { if (focusables(el).length || el.hasAttribute("tabindex")) focusFirst(el); },
    visible: () => modality() === "keyboard",
    modality: () => modality(),
    roving,
    active: () => active(),
    dispose() {
      for (const off of offs.splice(0)) off();
      traps.set([]);
      doc?.documentElement?.removeAttribute("data-m-focus-visible");
    },
  };
}

const manager = defineManager<Focus, FocusConfig>("focus", create, { markRoot: true });

/** The focus manager. Every method goes to the one instance (created on first use). */
export const focus: Focus = {
  trap: (el, o) => untrack(() => manager.get()).trap(el, o),
  trapped: () => manager.get().trapped(),
  remember: () => untrack(() => manager.get()).remember(),
  focusIn: (el) => untrack(() => manager.get()).focusIn(el),
  visible: () => manager.get().visible(),
  modality: () => manager.get().modality(),
  roving: (c, o) => untrack(() => manager.get()).roving(c, o),
  active: () => manager.get().active(),
  dispose: () => manager.dispose(),
};
/** Set the focus manager's options (merged into the current config). */
export const configureFocus = (config: Partial<FocusConfig>): void => manager.configure(config);
/** Stop the focus manager and remove its listeners; the next call starts it again. */
export const disposeFocus = (): void => manager.dispose();
/** The focus manager (get, configure, dispose). */
export const focusManager = manager;

// focus:trap on an element: trap while it is mounted (the value false turns it off).
// focus:roving="horizontal" | "vertical" | "both": roving tabindex among its focusable children.
registerNamespace("focus", (el, name, value) => {
  const v = typeof value === "function" ? (value as () => unknown)() : value;
  if (v === false) return;
  const node = el as HTMLElement;
  // after mount (the node must be in the page to take focus), released with the element's owner
  const owner = getOwner();
  if (name === "trap") queueMicrotask(() => { if (node.isConnected) runWithOwner(owner, () => focus.trap(node)); });
  else if (name === "roving") queueMicrotask(() => runWithOwner(owner, () => focus.roving(node, { orientation: (typeof v === "string" ? v : "vertical") as NonNullable<RovingOptions["orientation"]> })));
  else throw new Error(`March: focus:${name} — use focus:trap or focus:roving.`);
});
