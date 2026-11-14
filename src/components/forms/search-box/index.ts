// SearchBox (hadi-march/ui): the search field — icon, input, clear button, shortcut hint. The value is debounced
// (`debounce={0}`: at once), Escape clears, Enter searches now. It can drive a list of options as a combobox
// (`controls` + `activeDescendant`, keys through `onKeyDown`). Every part can be turned off or replaced.
import "../../../ui/field.css";
import "./search-box.css";
import { signal, computed, untrack, effect, onCleanup, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { key } from "../../../ui/keys.ts";
import { val, cx, debounce, glyph, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import { search as searchIcon } from "../../../icons/glyphs/search.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";

export interface SearchBoxProps {
  /** A signal (two-way), or a value / accessor to follow. `bind:value` works too. */
  value?: Signal<string> | MaybeFn<string | null | undefined>;
  setValue?: (v: string) => void;
  /** The debounced value (also at once on Enter and on clear). */
  onSearch?: (q: string) => void;
  onEnter?: (q: string) => void;
  /** Every keystroke, before the debounce. */
  onInput?: ((q: string) => void) | undefined;
  /** ms (default 250); 0: every keystroke is written at once. */
  debounce?: number;
  /** `true`: "/" focuses the box; or another combo. The hint is shown at the end of the field. */
  shortcut?: boolean | string;
  /** The shortcut hint: true (default, the `shortcut` combo), false (the key works, no hint), or another combo / text to show. */
  shortcutHint?: boolean | string | undefined;
  placeholder?: MaybeFn<string | undefined>;
  /** Accessible name (default: the placeholder, else "Search"). */
  label?: MaybeFn<string | undefined>;
  /** md (default) or sm (toolbars, side panels). */
  size?: MaybeFn<"sm" | "md" | undefined>;
  /** "field" (default) or "plain": no border or ring (the input of a palette or a panel header). */
  variant?: MaybeFn<"field" | "plain" | undefined>;
  /** The leading icon: true (default, a magnifier), false, or your own icon. */
  icon?: boolean | unknown | undefined;
  /** The clear button: true (default), false, or your own icon for it. */
  clear?: boolean | unknown | undefined;
  /** Accessible name of the clear button (default "Clear search"). */
  clearLabel?: MaybeFn<string | undefined>;
  /** Extra class on the input element (the host's own hook for it). */
  inputClass?: string | undefined;
  /** Called with the input element (focus it, measure it). */
  inputRef?: ((el: HTMLInputElement) => void) | undefined;
  /** Keys of the input, before the box's own Escape / Enter; `preventDefault()` skips those. */
  onKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  /** Combobox: id of the list this box filters (sets role="combobox" and aria-controls). */
  controls?: string | undefined;
  /** Combobox: id of the highlighted option. */
  activeDescendant?: MaybeFn<string | null | undefined>;
  /** Combobox: whether the list is shown (default true while `controls` is set). */
  expanded?: MaybeFn<boolean | undefined>;
  disabled?: MaybeFn<boolean | undefined>;
  id?: string | undefined;
  class?: ClassProp;
}
const isSignal = (v: unknown): v is Signal<string> => typeof v === "function" && (v as Partial<Signal<string>>).signal === true;
/**
 * Debounced search input with a clear button. `<SearchBox bind:value={$q} onSearch={(q) => …} debounce={250} shortcut />`
 * `shortcut`: pressing "/" anywhere focuses it. `size="sm"`, `icon={false}`, `clear={false}`, `debounce={0}`.
 */
export function SearchBox(props: SearchBoxProps): Element {
  let input: HTMLInputElement | undefined;
  const sig = isSignal(props.value) ? props.value : null;
  const plain = (): string | null | undefined => val(props.value as MaybeFn<string | null | undefined>);
  const current = signal(String((sig ? sig.peek() : untrack(plain)) ?? ""));
  const write = (v: string): void => { if (sig) sig.set(v); props.setValue?.(v); };
  const send = (v: string): void => { write(v); props.onSearch?.(v); };
  const wait = props.debounce ?? 250;
  const later = wait > 0 ? debounce(send, wait) : null;
  const emit = (v: string): void => (later ? later(v) : send(v));
  const cancel = (): void => later?.cancel();
  onCleanup(cancel);
  // follow outside changes of a controlled value
  if (props.value !== undefined) effect(() => { const v = String((sig ? sig() : plain()) ?? ""); if (v !== untrack(current)) { current.set(v); if (input && input.value !== v) input.value = v; } });
  const combo = props.shortcut === true ? "/" : props.shortcut || "";
  if (combo) key(combo, () => input?.focus(), { description: () => t`Focus search` });
  const hint = props.shortcutHint === false ? "" : typeof props.shortcutHint === "string" ? props.shortcutHint : combo;
  const filled = computed(() => current() !== "");
  const clear = (): void => { current.set(""); if (input) input.value = ""; cancel(); props.onInput?.(""); send(""); input?.focus(); };
  const ownIcon = props.icon != null && typeof props.icon !== "boolean";
  const ownClear = props.clear != null && typeof props.clear !== "boolean";
  const combobox = props.controls != null;
  return h("div", {
    class: () => cx("m-search", val(props.size) === "sm" && "m-search-sm", val(props.variant) === "plain" && "m-search-plain", props.icon === false && "m-search-no-icon", val(props.class)),
    role: "search", },
  props.icon === false ? null : ownIcon ? icon(props.icon, "m-search-icon") : h("span", { class: "m-search-icon", "aria-hidden": "true" }, glyph(searchIcon)),
  h("input", {
    type: "search", id: props.id, class: () => cx("m-input m-search-input", val(props.size) === "sm" && "m-input-sm", props.inputClass), ref: (x: HTMLInputElement) => { input = x; props.inputRef?.(x); }, value: current.peek(),
    placeholder: () => val(props.placeholder) ?? t`Search…`, "aria-label": () => val(props.label) ?? val(props.placeholder) ?? t`Search`,
    autocomplete: "off", spellcheck: "false", disabled: () => !!val(props.disabled),
    role: combobox ? "combobox" : null, "aria-autocomplete": combobox ? "list" : null, "aria-controls": props.controls ?? null,
    "aria-expanded": combobox ? () => String(val(props.expanded) ?? true) : null,
    "aria-activedescendant": props.activeDescendant != null ? () => val(props.activeDescendant) || null : null,
    onInput: (e: Event) => { const v = (e.target as HTMLInputElement).value; current.set(v); props.onInput?.(v); emit(v); },
    onKeydown: (e: KeyboardEvent) => {
      props.onKeyDown?.(e);
      if (e.defaultPrevented) return;
      if (e.key === "Escape" && current.peek()) { e.preventDefault(); e.stopPropagation(); clear(); }
      else if (e.key === "Enter") { cancel(); send(current.peek()); props.onEnter?.(current.peek()); }
    },
  }),
  props.clear === false ? null : () => filled() && h(IconButton, { class: "m-search-clear", title: false, label: () => val(props.clearLabel) ?? t`Clear search`, icon: ownClear ? props.clear : glyph(xIcon), onClick: clear }),
  hint ? h("span", { class: "m-search-kbd", "aria-hidden": "true" }, h(Kbd, { keys: hint })) : null);
}
