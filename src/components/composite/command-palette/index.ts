// CommandPalette (composite: Dialog, OverflowText; Ctrl/⌘+K): searches registered commands, NavMenu pages and actions with typo-tolerant ranking.
// Optional `ask(query)` hook (e.g. an AI intent search provided by the app) adds an "Ask" row; it runs on Enter, or by
// itself after 600 ms when local results are weak. Keyboard: ↑ ↓ PageUp PageDown Enter Esc.
// The view (search, ranking, dialog) is a separate chunk loaded on first open; hovering or focusing the button, or an
// idle moment after start, fetches it ahead of time.
import "./command-palette.css";
import { signal, untrack, onCleanup, createRoot, effect } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { key } from "../../../ui/keys.ts";
import { val, cx, glyph, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { isIconDef } from "../../../icons/svg.ts";
import { search as searchIcon } from "../../../icons/glyphs/search.ts";
import { OverflowText } from "../../typography/overflow-text/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
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

/** The texts CommandPalette writes itself; every one is optional (default: the built-in text). */
export interface CommandPaletteLabels {
  /** Name of the dialog. */
  dialog?: string;
  /** Name of the search field. */
  search?: string;
  results?: string;
  /** Shown when nothing matches. */
  empty?: string;
  /** The key hint under the list. */
  hint?: string;
  /** Heading above the `ask` suggestions. */
  suggested?: string;
  asking?: string;
  askFailed?: string;
  /** The "Ask" row. */
  ask?: (query: string) => string;
}

export interface CommandPaletteProps {
  /** Optional intent search: resolves ids of commands/pages/actions (or hrefs) with a reason. @tr İsteğe bağlı niyet araması: komut / sayfa / eylem id'lerini (ya da adresleri) bir gerekçeyle döndürür. */
  ask?: (query: string) => Promise<{ results?: readonly AskResult[] | null } | null | undefined>;
  /** ms before `ask` runs by itself when local results are weak (default 600). @tr Yerel sonuçlar zayıfken `ask`'ın kendiliğinden çalışmasından önceki süre, ms (varsayılan 600). */
  askDelay?: number;
  /** Placeholder of the search field (default: the built-in text). @tr Arama alanının yer tutucusu (varsayılan: yerleşik metin). */
  placeholder?: MaybeFn<string | undefined>;
  /** Toggle shortcut (default "mod+k"); false = none. @tr Aç / kapa kısayolu (varsayılan "mod+k"); false = yok. */
  shortcut?: string | false;
  /** Maximum local results (default 50). @tr En fazla yerel sonuç sayısı (varsayılan 50). */
  limit?: number;
  /** Extra commands for this palette only. @tr Yalnız bu palete ait ek komutlar. */
  commands?: readonly Command[] | null | undefined;
  /** Called with the entry that ran. @tr Çalışan girdiyle çağrılır. */
  onRun?: (entry: PaletteEntry) => void;
  /** Own texts (dialog and field names, empty state, key hint, the Ask row). @tr Kendi metinlerin (pencere ve alan adları, boş durum, tuş ipucu, Ask satırı). */
  labels?: MaybeFn<CommandPaletteLabels | undefined>;
  /** The key hint under the list: true (default), false, or your own content. @tr Listenin altındaki tuş ipucu: true (varsayılan), false ya da kendi içeriğin. */
  hint?: unknown;
  /** Own content for "no results" (default: the `labels.empty` text). @tr "Sonuç yok" için kendi içeriğin (varsayılan: `labels.empty` metni). */
  empty?: unknown;
  /** Icon of the Ask row (default: sparkles); false: none. @tr Ask satırının ikonu (varsayılan: sparkles); false: yok. */
  askIcon?: unknown;
  /** Extra class on the dialog. @tr Pencereye eklenen sınıf. */
  class?: ClassProp;
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

export interface PaletteButtonProps {
  /** The button's text (default "Search…"). @tr Düğmenin metni (varsayılan "Search…"). */
  label?: MaybeFn<string | undefined>;
  /** The shortcut shown in the hint (default "mod+k"). @tr İpucunda gösterilen kısayol (varsayılan "mod+k"). */
  shortcut?: string;
  /** The search icon: default, false (none), or your own (an icon of march/icons, text or a node). @tr Arama ikonu: varsayılan, false (yok) ya da kendi ikonun (march/icons ikonu, metin ya da düğüm). */
  icon?: unknown;
  /** The shortcut hint (Ctrl+K / ⌘K) at the end. Default true. @tr Sondaki kısayol ipucu (Ctrl+K / ⌘K). Varsayılan true. */
  kbd?: boolean | undefined;
  /** Extra classes on the button. @tr Düğmeye eklenen sınıflar. */
  class?: string;
}
/** A search-field-looking button that opens the command palette: `<PaletteButton label="Search…" />` (shows Ctrl+K / ⌘K). */
export function PaletteButton(props: PaletteButtonProps = {}): Element {
  return h("button", { type: "button", class: cx("m-pal-trigger", props.class), onClick: openPalette, onPointerenter: () => void preloadPalette(), onFocus: () => void preloadPalette(), "aria-keyshortcuts": "Control+K Meta+K" },
    props.icon === false ? null : props.icon == null ? glyph(searchIcon, "m-svg m-pal-trigger-icon") : isIconDef(props.icon) ? glyph(props.icon, "m-svg m-pal-trigger-icon") : icon(props.icon, "m-icon m-pal-trigger-icon"),
    h(OverflowText, { class: "m-pal-trigger-label" }, () => val(props.label) ?? t`Search…`),
    props.kbd === false ? null : h("span", { class: "m-pal-trigger-kbd", "aria-hidden": "true" }, h(Kbd, { keys: props.shortcut ?? "mod+k" })));
}
