// Global keyboard shortcuts. `key("mod+k", fn, { when, description, inInputs })` — mod = ⌘ on macOS, Ctrl elsewhere.
// Shortcuts registered inside a component are removed with it. `shortcuts()` lists described shortcuts for a help dialog.
import { signal, getOwner, onCleanup, untrack } from "../core/reactive.ts";

/** A parsed key combination. */
export interface ParsedKey { key: string; ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }
export interface KeyOptions {
  when?: (e: KeyboardEvent) => boolean;
  description?: string | (() => string);
  inInputs?: boolean;
  preventDefault?: boolean;
  group?: string;
}
/** A described shortcut, as listed by shortcuts(). */
export interface ShortcutInfo { combo: string; label: string; description: string; group: string | null }
interface Entry extends KeyOptions { combo: string; parsed: ParsedKey; fn: (e: KeyboardEvent) => unknown }

const registry = signal<Entry[]>([], { name: "shortcuts" });
let installed = false;

/** True on Apple platforms (⌘ is the primary modifier). */
export function isMac(): boolean {
  const n = globalThis.navigator as (Navigator & { userAgentData?: { platform?: string } }) | undefined;
  return /mac|iphone|ipad|ipod/i.test(n?.userAgentData?.platform ?? n?.platform ?? "");
}

const ALIAS: Record<string, string> = { esc: "escape", del: "delete", space: " ", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", plus: "+", return: "enter" };
/** Parse "mod+shift+k" → { key, ctrl, meta, alt, shift }. */
export function parseKey(combo: string): ParsedKey {
  const parts = String(combo).toLowerCase().split("+");
  const out: ParsedKey = { key: "", ctrl: false, meta: false, alt: false, shift: false };
  parts.forEach((p, i) => {
    if (p === "" && i === parts.length - 1) p = "+"; // "ctrl++"
    if (p === "mod") { if (isMac()) out.meta = true; else out.ctrl = true; }
    else if (p === "ctrl" || p === "control") out.ctrl = true;
    else if (p === "cmd" || p === "meta") out.meta = true;
    else if (p === "alt" || p === "option") out.alt = true;
    else if (p === "shift") out.shift = true;
    else if (p) out.key = ALIAS[p] ?? p;
  });
  return out;
}

/** Does keyboard event `e` match `combo`? Shift is ignored for symbol keys ("?" needs shift on most layouts). */
export function matches(e: KeyboardEvent, combo: string | ParsedKey): boolean {
  const k = typeof combo === "string" ? parseKey(combo) : combo;
  const key = String(e.key ?? "").toLowerCase();
  if (key !== k.key) return false;
  const symbol = k.key.length === 1 && !/[a-z0-9]/.test(k.key);
  return !!e.ctrlKey === k.ctrl && !!e.metaKey === k.meta && !!e.altKey === k.alt && (symbol || !!e.shiftKey === k.shift);
}

/** Human label: "Ctrl+K" or "⌘K". */
export function formatKey(combo: string): string {
  const mac = isMac();
  const k = parseKey(combo);
  const names: Record<string, string> = { " ": "Space", escape: "Esc", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", enter: "Enter", backspace: mac ? "⌫" : "Backspace", delete: "Del" };
  const main = names[k.key] ?? k.key.toUpperCase();
  const mods = mac ? [k.ctrl && "⌃", k.alt && "⌥", k.shift && "⇧", k.meta && "⌘"] : [k.ctrl && "Ctrl", k.alt && "Alt", k.shift && "Shift", k.meta && "Win"];
  const m = mods.filter((x): x is string => !!x);
  return mac ? m.join("") + main : [...m, main].join("+");
}

const typing = (el: EventTarget | null): boolean => {
  const x = el as HTMLElement | null;
  return !!x && (x.tagName === "INPUT" || x.tagName === "TEXTAREA" || x.tagName === "SELECT" || x.isContentEditable || x.getAttribute?.("contenteditable") === "true");
};

function install(): void {
  if (installed || !globalThis.document) return;
  installed = true;
  globalThis.document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const list = untrack(registry);
    for (let i = list.length - 1; i >= 0; i--) { // newest first
      const s = list[i] as Entry;
      if (!matches(e, s.parsed)) continue;
      if (typing(e.target) && !s.inInputs) continue;
      if (s.when && !s.when(e)) continue;
      if (s.preventDefault !== false) e.preventDefault();
      s.fn(e);
      return;
    }
  });
}

/**
 * Register a global shortcut. Returns an unregister function (also called automatically with the current owner).
 * `combo` e.g. "mod+k", "/", "shift+?" ("g u" sequences are not supported; single chords only).
 */
export function key(combo: string, fn: (e: KeyboardEvent) => unknown, opts: KeyOptions = {}): () => void {
  install();
  const entry: Entry = { combo, parsed: parseKey(combo), fn, ...opts };
  registry.update((l) => [...l, entry]);
  const off = (): void => { registry.update((l) => l.filter((x) => x !== entry)); };
  if (getOwner()) onCleanup(off);
  return off;
}

/** Registered shortcuts that have a description (reactive): [{ combo, label, description, group }]. */
export function shortcuts(): ShortcutInfo[] {
  return registry().filter((s) => s.description).map((s) => ({
    combo: s.combo, label: formatKey(s.combo), group: s.group ?? null,
    description: typeof s.description === "function" ? s.description() : (s.description as string),
  }));
}
