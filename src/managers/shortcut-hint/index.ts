// ShortcutHintManager: makes shortcuts discoverable. Holding a key (default Alt) shows a badge on every element that
// has a shortcut (aria-keyshortcuts, data-hotkey — command: buttons set aria-keyshortcuts themselves); "?" opens a
// help list of every described shortcut (HotkeyManager bindings and ui/keys.ts shortcuts), grouped.
//
//   import { shortcutHints } from "march/managers/shortcut-hint";
//   shortcutHints.visible()   shortcutHints.show()   shortcutHints.hide()   shortcutHints.openHelp()
//   shortcutHints.entries()   // [{ combo, label, description, group, active }] (reactive)
//   <ShortcutHints />         // from ./ui (lazy): draws the badges and the help dialog; mount once
//
// This module holds the state and the keys only; the drawing lives in ./ui so it loads when needed.
import { signal, computed, untrack } from "../../core/reactive.ts";
import { t } from "../../core/i18n.ts";
import { shortcuts as keyShortcuts } from "../../ui/keys.ts";
import { hotkeys } from "../hotkey/index.ts";
import { defineManager, emit } from "../manager.ts";

/** One line of the help list. */
export interface ShortcutEntry { combo: string; label: string; description: string; group: string | null; active: boolean }

export interface ShortcutHintConfig {
  /** Key held to show the badges ("Alt", "Control", "Shift", "Meta"); null turns holding off. Default "Alt". */
  holdKey: string | null;
  /** How long it is held before the badges show, ms (default 450). */
  holdMs: number;
  /** Shortcut that opens the help list (default "?"); null for none. */
  helpKey: string | null;
  /** Elements that count as having a shortcut. */
  selector: string;
}

export interface ShortcutHints {
  visible(): boolean;
  show(): void;
  hide(): void;
  /** Ask the help list to open (<ShortcutHints /> opens it). */
  openHelp(): void;
  closeHelp(): void;
  helpOpen(): boolean;
  /** Described shortcuts from both registries (reactive), grouped order kept. */
  entries(): ShortcutEntry[];
  /** Elements with a shortcut right now (not hidden). */
  targets(root?: ParentNode): HTMLElement[];
  dispose(): void;
}

function create(cfg: ShortcutHintConfig): ShortcutHints {
  const visible = signal(false, { name: "shortcutHints.visible" });
  const help = signal(false, { name: "shortcutHints.help" });
  const doc = globalThis.document;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stopTimer = (): void => { if (timer) clearTimeout(timer); timer = null; };
  const show = (): void => { if (!untrack(visible)) { visible.set(true); emit("shortcut-hint", "show"); } };
  const hide = (): void => { stopTimer(); if (untrack(visible)) { visible.set(false); emit("shortcut-hint", "hide"); } };

  const down = (e: Event): void => {
    const k = e as KeyboardEvent;
    if (!cfg.holdKey) return;
    if (k.key === cfg.holdKey && !k.repeat) { stopTimer(); timer = setTimeout(show, cfg.holdMs); return; }
    if (k.key !== cfg.holdKey) { stopTimer(); hide(); } // a chord (Alt+S): the user is using it, not looking
  };
  const up = (e: Event): void => { if ((e as KeyboardEvent).key === cfg.holdKey) hide(); };
  doc?.addEventListener("keydown", down, true);
  doc?.addEventListener("keyup", up, true);
  globalThis.addEventListener?.("blur", hide);

  const offHelp = cfg.helpKey ? hotkeys.bind(cfg.helpKey, () => help.set(true), { description: () => t("Keyboard shortcuts"), group: () => t("Help"), modal: false }) : null;

  const entries = computed<ShortcutEntry[]>(() => {
    const fromHotkeys = hotkeys.list().map((x): ShortcutEntry => ({ combo: x.combo, label: x.label, description: x.description, group: x.group, active: x.active }));
    const fromKeys = keyShortcuts().map((x): ShortcutEntry => ({ combo: x.combo, label: x.label, description: x.description, group: x.group, active: true }));
    const seen = new Set<string>();
    return [...fromHotkeys, ...fromKeys].filter((x) => { const id = `${x.combo}|${x.description}`; if (seen.has(id)) return false; seen.add(id); return true; });
  });

  const targets = (root: ParentNode = doc as Document): HTMLElement[] => !root ? [] : Array.from(root.querySelectorAll<HTMLElement>(cfg.selector))
    .filter((el) => !el.closest("[hidden],[inert],[aria-hidden=true]") && !(el as HTMLButtonElement).disabled);

  return {
    visible: () => visible(),
    show,
    hide,
    openHelp: () => help.set(true),
    closeHelp: () => help.set(false),
    helpOpen: () => help(),
    entries,
    targets,
    dispose() {
      stopTimer();
      doc?.removeEventListener("keydown", down, true);
      doc?.removeEventListener("keyup", up, true);
      globalThis.removeEventListener?.("blur", hide);
      offHelp?.();
      visible.set(false);
      help.set(false);
    },
  };
}

/** aria-keyshortcuts ("Control+Shift+S", first of several) or data-hotkey ("mod+shift+s") → a combo for formatKey. */
export function comboOf(el: Element): string | null {
  const d = el.getAttribute("data-hotkey");
  if (d) return d;
  const a = el.getAttribute("aria-keyshortcuts");
  return a ? (a.split(/\s+/)[0] as string).toLowerCase() : null;
}

const manager = defineManager<ShortcutHints, ShortcutHintConfig>("shortcut-hint", create, {
  holdKey: "Alt", holdMs: 450, helpKey: "?", selector: "[aria-keyshortcuts],[data-hotkey]",
});

/** The shortcut hint manager. Every method goes to the one instance (created on first use). */
export const shortcutHints: ShortcutHints = {
  visible: () => manager.get().visible(),
  show: () => untrack(() => manager.get()).show(),
  hide: () => untrack(() => manager.get()).hide(),
  openHelp: () => untrack(() => manager.get()).openHelp(),
  closeHelp: () => untrack(() => manager.get()).closeHelp(),
  helpOpen: () => manager.get().helpOpen(),
  entries: () => manager.get().entries(),
  targets: (r) => untrack(() => manager.get()).targets(r),
  dispose: () => manager.dispose(),
};
/** Set the shortcut hint manager's options (merged into the current config). */
export const configureShortcutHints = (config: Partial<ShortcutHintConfig>): void => manager.configure(config);
/** Stop the shortcut hint manager and remove its listeners; the next call starts it again. */
export const disposeShortcutHints = (): void => manager.dispose();
/** The shortcut hint manager (get, configure, dispose). */
export const shortcutHintManager = manager;
