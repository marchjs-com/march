// HotkeyManager: keyboard shortcuts with scopes, key sequences ("g h"), pause / resume and a reactive list for help
// screens. Parsing, matching and labels come from ui/keys.ts (mod = ⌘ on macOS, Ctrl elsewhere).
//
//   import { hotkeys } from "march/managers/hotkey";
//   hotkeys.bind("mod+k", openSearch, { description: "Search", group: "General" })
//   hotkeys.bind("g h", goHome, { description: "Go home" })              // a sequence: g, then h within 1 s
//   const leave = hotkeys.enter("editor")                                 // scope: "editor" bindings + global ones
//   hotkeys.bind("mod+b", bold, { scope: "editor" })
//   hotkeys.pending()   hotkeys.list()   hotkeys.pause()   hotkeys.resume()
//
// While a modal layer (dialog, drawer, palette) is open, only bindings with { modal: true } run: the page under it
// is inert, so its shortcuts are too. Typing in a field skips bindings unless { inInputs: true }.
import { signal, computed, untrack, getOwner, onCleanup } from "../../core/reactive.ts";
import { parseKey, matches, formatKey, type ParsedKey } from "../../ui/keys.ts";
import { layer } from "../layer/index.ts";
import { defineManager, emit } from "../manager.ts";

type Text = string | (() => string);
const read = (v: Text | undefined): string => (typeof v === "function" ? v() : v ?? "");

export interface HotkeyOptions {
  description?: Text;
  group?: Text;
  /** Active only while this scope is entered (default: global — always, unless a scope is "exclusive"). */
  scope?: string;
  /** Run while typing in an input / textarea / contenteditable (default false). */
  inInputs?: boolean;
  /** Run while a modal layer is open (default false). */
  modal?: boolean;
  /** Extra condition at key time. */
  when?: (e: KeyboardEvent) => boolean;
  /** preventDefault on match (default true). */
  preventDefault?: boolean;
}

/** One binding as listed for help screens. */
export interface HotkeyInfo { combo: string; label: string; description: string; group: string | null; scope: string | null; active: boolean }

export interface HotkeyConfig {
  /** Max pause between the keys of a sequence, ms (default 1000). */
  sequenceTimeout: number;
}

export interface Hotkeys {
  /** Bind a chord ("mod+s") or a sequence of chords separated by spaces ("g h"). Returns unbind (also with the owner). */
  bind(combo: string, fn: (e: KeyboardEvent) => unknown, opts?: HotkeyOptions): () => void;
  /** Enter a scope (stacked). `exclusive`: global bindings pause while it is the top scope. Returns leave. */
  enter(scope: string, opts?: { exclusive?: boolean }): () => void;
  /** Current scopes, outermost first (reactive). */
  scopes(): string[];
  /** Bindings with a description (reactive), with `active` = would run now. */
  list(): HotkeyInfo[];
  /** The keys typed so far of an unfinished sequence, e.g. "G" (reactive); "" when none. */
  pending(): string;
  pause(): void;
  resume(): void;
  paused(): boolean;
  /** Run the binding for `combo` as if pressed (tests, a help screen's "try it"). */
  trigger(combo: string): boolean;
  dispose(): void;
}

interface Binding extends HotkeyOptions { combo: string; steps: ParsedKey[]; fn: (e: KeyboardEvent) => unknown }
interface Scope { name: string; exclusive: boolean }

const typing = (el: EventTarget | null): boolean => {
  const x = el as HTMLElement | null;
  return !!x && (x.tagName === "INPUT" || x.tagName === "TEXTAREA" || x.tagName === "SELECT" || x.isContentEditable || x.getAttribute?.("contenteditable") === "true");
};
const label = (combo: string): string => combo.trim().split(/\s+/).map(formatKey).join(" ");

function create(cfg: HotkeyConfig): Hotkeys {
  const bindings = signal<Binding[]>([], { name: "hotkeys" });
  const scopeStack = signal<Scope[]>([], { name: "hotkeys.scopes" });
  const paused = signal(false, { name: "hotkeys.paused" });
  const typed = signal<ParsedKey[]>([], { name: "hotkeys.pending" });
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clearTyped = (): void => { if (timer) clearTimeout(timer); timer = null; if (untrack(typed).length) typed.set([]); };

  const inScope = (b: Binding, scopes: Scope[]): boolean => {
    const topScope = scopes.at(-1);
    if (!b.scope) return !topScope?.exclusive;
    return scopes.some((s) => s.name === b.scope);
  };
  const allowed = (b: Binding, e: KeyboardEvent | null, scopes: Scope[], modal: boolean): boolean =>
    inScope(b, scopes) && (!modal || !!b.modal) && (!e || !typing(e.target) || !!b.inInputs) && (!e || !b.when || b.when(e));

  const onKey = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (e.defaultPrevented || e.isComposing || untrack(paused)) return;
    if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
    const scopes = untrack(scopeStack);
    const modal = untrack(() => layer.modal());
    const list = untrack(bindings).filter((b) => allowed(b, e, scopes, modal));
    const prefix = untrack(typed);
    const at = prefix.length;
    // a binding whose steps so far match what was typed, and whose next step is this key
    const fits = (b: Binding): boolean => b.steps.length > at && prefix.every((p, i) => same(p, b.steps[i] as ParsedKey)) && matches(e, b.steps[at] as ParsedKey);
    const cands = list.filter(fits);
    if (!cands.length) {
      clearTyped();
      if (at > 0) return onKey(ev); // the sequence broke: try this key as a fresh start
      return;
    }
    // newest first: a later binding of the same keys wins
    const done = [...cands].reverse().find((b) => b.steps.length === at + 1);
    const longer = cands.some((b) => b.steps.length > at + 1);
    if (done && !longer) {
      clearTyped();
      if (done.preventDefault !== false) e.preventDefault();
      emit("hotkey", "run", { combo: done.combo, scope: done.scope ?? null });
      done.fn(e);
      return;
    }
    e.preventDefault();
    typed.set([...prefix, (cands[0] as Binding).steps[at] as ParsedKey]);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      // the timeout ends a prefix that is itself a complete binding ("g" and "g h"): run the short one
      if (done) { typed.set([]); done.fn(e); } else typed.set([]);
    }, cfg.sequenceTimeout);
  };
  globalThis.document?.addEventListener("keydown", onKey);

  const bind = (combo: string, fn: (e: KeyboardEvent) => unknown, opts: HotkeyOptions = {}): (() => void) => {
    const steps = combo.trim().split(/\s+/).map(parseKey);
    const b: Binding = { ...opts, combo, steps, fn };
    bindings.update((l) => [...l, b]);
    emit("hotkey", "bind", { combo, scope: opts.scope ?? null });
    const off = (): void => { bindings.update((l) => l.filter((x) => x !== b)); };
    if (getOwner()) onCleanup(off);
    return off;
  };

  const enter = (name: string, opts: { exclusive?: boolean } = {}): (() => void) => {
    const s: Scope = { name, exclusive: !!opts.exclusive };
    scopeStack.update((l) => [...l, s]);
    clearTyped();
    emit("hotkey", "scope", { enter: name });
    let inside = true;
    const leave = (): void => { if (!inside) return; inside = false; scopeStack.update((l) => l.filter((x) => x !== s)); emit("hotkey", "scope", { leave: name }); };
    if (getOwner()) onCleanup(leave);
    return leave;
  };

  const list = computed<HotkeyInfo[]>(() => {
    const scopes = scopeStack();
    const modal = layer.modal();
    return bindings().filter((b) => b.description).map((b) => ({
      combo: b.combo, label: label(b.combo), description: read(b.description), group: b.group ? read(b.group) : null,
      scope: b.scope ?? null, active: !paused() && allowed(b, null, scopes, modal),
    }));
  });

  return {
    bind,
    enter,
    scopes: () => scopeStack().map((s) => s.name),
    list,
    pending: () => typed().map((k) => formatKey(comboOf(k))).join(" "),
    pause: () => { paused.set(true); clearTyped(); },
    resume: () => paused.set(false),
    paused: () => paused(),
    trigger(combo) {
      const scopes = untrack(scopeStack);
      const modal = untrack(() => layer.modal());
      const b = [...untrack(bindings)].reverse().find((x) => x.combo === combo && allowed(x, null, scopes, modal));
      if (!b) return false;
      b.fn(new (globalThis.KeyboardEvent ?? Event)("keydown") as KeyboardEvent);
      return true;
    },
    dispose() {
      globalThis.document?.removeEventListener("keydown", onKey);
      clearTyped();
      bindings.set([]);
      scopeStack.set([]);
    },
  };
}

const same = (a: ParsedKey, b: ParsedKey): boolean => a.key === b.key && a.ctrl === b.ctrl && a.meta === b.meta && a.alt === b.alt && a.shift === b.shift;
const comboOf = (k: ParsedKey): string => [k.ctrl && "ctrl", k.meta && "meta", k.alt && "alt", k.shift && "shift", k.key === "+" ? "plus" : k.key].filter(Boolean).join("+");

const manager = defineManager<Hotkeys, HotkeyConfig>("hotkey", create, { sequenceTimeout: 1000 });

/** The hotkey manager. Every method goes to the one instance (created on first use). */
export const hotkeys: Hotkeys = {
  bind: (c, fn, o) => untrack(() => manager.get()).bind(c, fn, o),
  enter: (s, o) => untrack(() => manager.get()).enter(s, o),
  scopes: () => manager.get().scopes(),
  list: () => manager.get().list(),
  pending: () => manager.get().pending(),
  pause: () => manager.get().pause(),
  resume: () => manager.get().resume(),
  paused: () => manager.get().paused(),
  trigger: (c) => untrack(() => manager.get()).trigger(c),
  dispose: () => manager.dispose(),
};
/** Set the hotkey manager's options (merged into the current config). */
export const configureHotkeys = (config: Partial<HotkeyConfig>): void => manager.configure(config);
/** Stop the hotkey manager and remove its listeners; the next call starts it again. */
export const disposeHotkeys = (): void => manager.dispose();
/** The hotkey manager (get, configure, dispose). */
export const hotkeyManager = manager;
/** "g h" / "mod+k" → "G H" / "Ctrl+K" (or ⌘K). */
export const hotkeyLabel = label;
