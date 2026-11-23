// Global keyboard shortcuts. `key("mod+k", fn, { when, description, inInputs })` — mod = ⌘ on macOS, Ctrl elsewhere.
// Shortcuts registered inside a component are removed with it. `shortcuts()` lists described shortcuts for a help dialog.
import { signal, getOwner, onCleanup, untrack } from "../core/reactive.ts";
import { parseKey, matches, formatKey, type ParsedKey } from "./key-label.ts";

// the labels and matching live in key-label.ts (no registry); re-exported here, this stays the public module
export { isMac, parseKey, matches, formatKey, isMod, labelWithKey, undoKeys, type ParsedKey, type UndoTarget } from "./key-label.ts";

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
