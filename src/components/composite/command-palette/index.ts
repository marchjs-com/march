// CommandPalette (composite: Dialog, OverflowText; Ctrl/⌘+K): searches registered commands, NavMenu pages and actions with typo-tolerant ranking.
// Optional `ask(query)` hook (e.g. an AI intent search provided by the app) adds an "Ask" row; it runs on Enter, or by
// itself after 600 ms when local results are weak. Keyboard: ↑ ↓ PageUp PageDown Enter Esc.
// The view (search, ranking, dialog) is a separate chunk loaded on first open; hovering or focusing the button, or an
// idle moment after start, fetches it ahead of time.
import "./command-palette.css";
import "../../../ui/field.css";
import "../../../ui/display.css";
import { signal, untrack, onCleanup, createRoot, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { key, formatKey } from "../../../ui/keys.ts";
import { val, cx, glyph, type MaybeFn } from "../../../ui/util.ts";
import { search as searchIcon } from "../../../icons/glyphs/search.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { isOpen } from "./state.ts";
import type { Command } from "../../../ui/registry.ts";

export { registerCommands, registerPages } from "../../../ui/registry.ts";
export type { Command, CommandEntry, PageEntry } from "../../../ui/registry.ts";

/** A normalised palette entry (what `onRun` receives). */
export interface PaletteEntry {
  id: string;
  title: string;
  group: string;
  sub?: string | undefined;
  keywords?: string | undefined;
  icon?: unknown;
  shortcut?: string | undefined;
  href?: string | undefined;
  run: () => unknown;
}
/** One suggestion returned by the `ask` hook: the id of a command/page/action, or an `href` to open. */
export interface AskResult { id: string; reason?: string; href?: string; title?: string }

let mounted = 0;
type View = (props: CommandPaletteProps) => unknown;
let viewModule: Promise<View> | null = null;
/** Fetch the palette view now (it is otherwise loaded on first open). */
export function preloadPalette(): Promise<View> {
  return (viewModule ??= import("./view.ts").then((m) => m.PaletteView, (e: unknown) => { viewModule = null; throw e; }));
}
/** Open the command palette (mounts a default one if the app did not render <CommandPalette/>). */
export function openPalette(): void {
  if (!mounted && globalThis.document?.body) createRoot(() => h(CommandPalette, {}), null);
  isOpen.set(true);
}
/** Close the command palette. */
export const closePalette = (): void => { isOpen.set(false); };
/** Is the command palette open (reactive)? */
export const paletteOpen = (): boolean => isOpen();

export interface CommandPaletteProps {
  /** Optional intent search: resolves ids of commands/pages/actions (or hrefs) with a reason. */
  ask?: (query: string) => Promise<{ results?: readonly AskResult[] | null } | null | undefined>;
  /** ms before `ask` runs by itself when local results are weak (default 600). */
  askDelay?: number;
  placeholder?: MaybeFn<string | undefined>;
  /** Toggle shortcut (default "mod+k"); false = none. */
  shortcut?: string | false;
  /** Maximum local results (default 50). */
  limit?: number;
  /** Extra commands for this palette only. */
  commands?: readonly Command[] | null | undefined;
  onRun?: (entry: PaletteEntry) => void;
}

/**
 * `<CommandPalette ask={(q) => api.intent(q)} placeholder="…" shortcut="mod+k" limit={50} commands={[…]} />`
 * ask(query) → Promise<{ results: [{ id, reason }] }> (ids of commands/pages/actions). The dialog itself loads on first open.
 */
export function CommandPalette(props: CommandPaletteProps): unknown {
  mounted++;
  onCleanup(() => { mounted--; });
  if (props.shortcut !== false) key(props.shortcut ?? "mod+k", () => (isOpen.peek() ? isOpen.set(false) : openPalette()), { inInputs: true, description: () => t`Open command palette` });
  const view = signal<View | null>(null);
  let alive = true;
  onCleanup(() => { alive = false; });
  effect(() => { if (isOpen() && !untrack(view)) void preloadPalette().then((v) => { if (alive) view.set(v); }); });
  return () => { const V = view(); return V ? untrack(() => V(props)) : null; };
}

export interface PaletteButtonProps { label?: MaybeFn<string | undefined>; shortcut?: string; class?: string }
/** A search-field-looking button that opens the command palette: `<PaletteButton label="Search…" />` (shows Ctrl+K / ⌘K). */
export function PaletteButton(props: PaletteButtonProps = {}): Element {
  return h("button", { type: "button", class: cx("hm-pal-trigger", props.class), onClick: openPalette, onPointerenter: () => void preloadPalette(), onFocus: () => void preloadPalette(), "aria-keyshortcuts": "Control+K Meta+K" },
    glyph(searchIcon, "hm-svg hm-pal-trigger-icon"),
    h(OverflowText, { class: "hm-pal-trigger-label" }, () => val(props.label) ?? t`Search…`),
    h("kbd", { class: "hm-kbd hm-pal-trigger-kbd", "aria-hidden": "true" }, formatKey(props.shortcut ?? "mod+k")));
}
