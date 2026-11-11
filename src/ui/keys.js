// Global keyboard shortcuts. `key("mod+k", fn, { when, description, inInputs })` — mod = ⌘ on macOS, Ctrl elsewhere.
// Shortcuts registered inside a component are removed with it. `shortcuts()` lists described shortcuts for a help dialog.
import { signal, getOwner, onCleanup, untrack } from "../core/reactive.ts";

const registry = signal([], { name: "shortcuts" });
let installed = false;

/** True on Apple platforms (⌘ is the primary modifier). */
export function isMac() {
  const n = globalThis.navigator;
  return /mac|iphone|ipad|ipod/i.test(n?.userAgentData?.platform ?? n?.platform ?? "");
}

const ALIAS = { esc: "escape", del: "delete", space: " ", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", plus: "+", return: "enter" };
/** Parse "mod+shift+k" → { key, ctrl, meta, alt, shift }. */
export function parseKey(combo) {
  const parts = String(combo).toLowerCase().split("+");
  const out = { key: "", ctrl: false, meta: false, alt: false, shift: false };
  parts.forEach((p, i) => {
    if (p === "" && i === parts.length - 1) p = "+"; // "ctrl++"
    if (p === "mod") isMac() ? (out.meta = true) : (out.ctrl = true);
    else if (p === "ctrl" || p === "control") out.ctrl = true;
    else if (p === "cmd" || p === "meta") out.meta = true;
    else if (p === "alt" || p === "option") out.alt = true;
    else if (p === "shift") out.shift = true;
    else if (p) out.key = ALIAS[p] ?? p;
  });
  return out;
}

/** Does keyboard event `e` match `combo`? Shift is ignored for symbol keys ("?" needs shift on most layouts). */
export function matches(e, combo) {
  const k = typeof combo === "string" ? parseKey(combo) : combo;
  const key = String(e.key ?? "").toLowerCase();
  if (key !== k.key) return false;
  const symbol = k.key.length === 1 && !/[a-z0-9]/.test(k.key);
  return !!e.ctrlKey === k.ctrl && !!e.metaKey === k.meta && !!e.altKey === k.alt && (symbol || !!e.shiftKey === k.shift);
}

/** Human label: "Ctrl+K" or "⌘K". */
export function formatKey(combo) {
  const mac = isMac();
  const k = parseKey(combo);
  const names = { " ": "Space", escape: "Esc", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", enter: "Enter", backspace: mac ? "⌫" : "Backspace", delete: "Del" };
  const main = names[k.key] ?? k.key.toUpperCase();
  const mods = mac ? [k.ctrl && "⌃", k.alt && "⌥", k.shift && "⇧", k.meta && "⌘"] : [k.ctrl && "Ctrl", k.alt && "Alt", k.shift && "Shift", k.meta && "Win"];
  const m = mods.filter(Boolean);
  return mac ? m.join("") + main : [...m, main].join("+");
}

const typing = (el) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable || el.getAttribute?.("contenteditable") === "true");

function install() {
  if (installed || !globalThis.document) return;
  installed = true;
  globalThis.document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const list = untrack(registry);
    for (let i = list.length - 1; i >= 0; i--) { // newest first
      const s = list[i];
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
 * @param {string} combo e.g. "mod+k", "/", "shift+?", "g u" is not supported (single chords only)
 * @param {(e: KeyboardEvent) => any} fn
 * @param {{ when?: (e) => boolean, description?: string|(() => string), inInputs?: boolean, preventDefault?: boolean, group?: string }} [opts]
 */
export function key(combo, fn, opts = {}) {
  install();
  const entry = { combo, parsed: parseKey(combo), fn, ...opts };
  registry.update((l) => [...l, entry]);
  const off = () => registry.update((l) => l.filter((x) => x !== entry));
  if (getOwner()) onCleanup(off);
  return off;
}

/** Registered shortcuts that have a description (reactive): [{ combo, label, description, group }]. */
export function shortcuts() {
  return registry().filter((s) => s.description).map((s) => ({
    combo: s.combo, label: formatKey(s.combo), group: s.group ?? null,
    description: typeof s.description === "function" ? s.description() : s.description,
  }));
}
