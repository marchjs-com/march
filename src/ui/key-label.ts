// Key combinations without the shortcut registry: parse, match, label (⌘K / Ctrl+K), the primary modifier, undo keys.
// Pure functions, so a component that only shows "Save (Ctrl+S)" does not ship the registry of ui/keys.ts.

/** A parsed key combination. */
export interface ParsedKey { key: string; ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }
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

/** True while the primary modifier is held: Ctrl or ⌘ (keyboard and pointer events). */
export const isMod = (e: { ctrlKey: boolean; metaKey: boolean }): boolean => e.ctrlKey || e.metaKey;

/** A label with its shortcut for a tooltip: `labelWithKey("Save", "mod+s")` → "Save (Ctrl+S)"; no shortcut → the label. */
export const labelWithKey = (label: string, combo?: string | null): string => (combo ? `${label} (${formatKey(combo)})` : label);

/** What undoKeys() drives: an undo stack, or any object with the two steps. */
export interface UndoTarget { undo(): unknown; redo(): unknown }
/**
 * The undo / redo keys of an editor: mod+Z undoes, mod+Shift+Z and mod+Y redo. Call it from a keydown handler;
 * returns true when the key was one of them (the event is then prevented), so the handler can stop there.
 * `if (undoKeys(e, stack)) return;`
 */
export function undoKeys(e: KeyboardEvent, stack: UndoTarget | null | undefined): boolean {
  if (!isMod(e) || e.altKey) return false;
  const k = String(e.key ?? "").toLowerCase();
  const undo = k === "z" && !e.shiftKey, redo = (k === "z" && e.shiftKey) || (k === "y" && !e.shiftKey);
  if (!undo && !redo) return false;
  e.preventDefault();
  if (stack) void (redo ? stack.redo() : stack.undo());
  return true;
}
