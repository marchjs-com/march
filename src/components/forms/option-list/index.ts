// OptionList (hadi-march/ui): a list of choices inside a panel — a theme or accent picker, a type menu, the
// suggestions under a field. Rows are a lead (icon, swatch, avatar), a label, a hint, a trailing part and a tick on
// the chosen one. Three roles: "radio" (one choice, default), "listbox" (one or many), "menu" (commands). Keys come
// from the list-nav behavior: arrows / Home / End move focus among the rows, or — with `keysFrom` — the keys of a
// field move a highlight (aria-activedescendant) while focus stays in the field.
import "./option-list.css";
import { signal, effect, untrack, onCleanup, getOwner, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, uid, icon, glyph, isRtl, listen, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { moveCursor, listNav } from "../../../behaviors/list-nav/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { check as checkIcon } from "../../../icons/glyphs/check.ts";

/** One choice. */
export interface OptionItem<T = string> {
  value: T;
  label: unknown;
  /** Second line (or text after the label when `inline`). */
  hint?: unknown | undefined;
  /** Before the label: an icon (IconDef, emoji) or any node (a swatch, an avatar). */
  icon?: unknown | undefined;
  /** At the end: a badge, a shortcut. */
  trailing?: unknown | undefined;
  disabled?: boolean | undefined;
  /** Rows with the same group name follow one heading. */
  group?: string | undefined;
}
/** What a custom row drawing gets. */
export interface OptionState { selected: () => boolean; active: () => boolean; index: number }

export interface OptionListProps<T = string> {
  options: MaybeFn<readonly OptionItem<T>[]>;
  /** The chosen value (an array with `multiple`): a signal (two-way), a value / accessor, or `bind:value`. */
  value?: Signal<T | null> | Signal<readonly T[]> | MaybeFn<T | readonly T[] | null | undefined>;
  setValue?: ((v: never) => void) | undefined;
  /** A row was chosen (click, Enter, Space). */
  onPick?: ((value: T, item: OptionItem<T>, e: Event | null) => void) | undefined;
  /** Several values can be chosen (listbox). */
  multiple?: boolean | undefined;
  /** "radio" (default): one of many · "listbox": options, one or many · "menu": commands (checked when a value is given). */
  mode?: "radio" | "listbox" | "menu" | undefined;
  /** The field whose keys drive the list (focus stays there; rows are highlighted through aria-activedescendant). */
  keysFrom?: Element | (() => Element | null | undefined) | undefined;
  /** The highlighted row with `keysFrom` (your own signal when you need to read or reset it). */
  active?: Signal<number> | undefined;
  /** Accessible name of the list. */
  label?: MaybeFn<string | undefined>;
  id?: string | undefined;
  /** The tick on a chosen row: true (default), false, your own icon, or `() => node` (called for every row). */
  check?: boolean | unknown | (() => unknown) | undefined;
  /** Rows per line (a grid of choices; default 1). */
  columns?: number | undefined;
  size?: MaybeFn<"sm" | "md" | undefined>;
  /** Hint beside the label instead of under it. */
  inline?: boolean | undefined;
  /** Shown when there are no options: text or a node (default "No results"); false for nothing. */
  empty?: unknown | undefined;
  /** Draw the inside of a row yourself. */
  renderOption?: ((item: OptionItem<T>, state: OptionState) => unknown) | undefined;
  /** Theme colour of the chosen row. */
  color?: ColorToken | undefined;
  class?: ClassProp | undefined;
}

const isSignal = (v: unknown): v is Signal<unknown> => typeof v === "function" && (v as Partial<Signal<unknown>>).signal === true;
const ROLES = { radio: ["radiogroup", "radio"], listbox: ["listbox", "option"], menu: ["menu", "menuitem"] } as const;

/** `<OptionList bind:value={$theme} label="Theme" options={[{ value: "light", label: "Light", icon: sun }, { value: "dark", label: "Dark", icon: moon }]} />` */
export function OptionList<T = string>(props: OptionListProps<T>): Element {
  const id = props.id ?? uid("hm-ol");
  const byField = props.keysFrom != null;
  const mode = byField ? "listbox" : props.mode ?? (props.multiple ? "listbox" : "radio");
  const [listRole, baseRowRole] = ROLES[mode];
  const hasValue = props.value !== undefined || props.setValue != null;
  // a menu without a value is a list of commands: nothing stays chosen
  const stateful = hasValue || mode !== "menu";
  const rowRole = mode === "menu" && stateful ? "menuitemradio" : baseRowRole;
  const sig = isSignal(props.value) ? props.value as Signal<unknown> : null;
  const own = signal<unknown>(props.multiple ? [] : null);
  const current = (): unknown => (props.value === undefined ? own() : sig ? sig() : val(props.value as MaybeFn<unknown>));
  const items = (): readonly OptionItem<T>[] => val(props.options) ?? [];
  const isSel = (v: T): boolean => { const c = current(); return props.multiple ? Array.isArray(c) && c.includes(v) : c === v; };
  const active = props.active ?? signal(-1);
  let root: HTMLElement | undefined;
  const rows = (): HTMLElement[] => Array.from(root?.querySelectorAll<HTMLElement>(".hm-option-list-row") ?? []);

  const pick = (i: number, e: Event | null): void => {
    const it = untrack(items)[i];
    if (!it || it.disabled) return;
    if (stateful) {
      const c = untrack(current);
      const next: unknown = props.multiple ? (Array.isArray(c) && c.includes(it.value) ? c.filter((x: T) => x !== it.value) : [...(Array.isArray(c) ? c : []), it.value]) : it.value;
      if (sig) sig.set(next); else if (props.value === undefined) own.set(next);
      props.setValue?.(next as never);
    }
    props.onPick?.(it.value, it, e);
  };

  // the one place a row is drawn (lead + label + hint + trailing + tick)
  const row = (it: OptionItem<T>, i: number): Element => {
    const selected = (): boolean => isSel(it.value), isActive = (): boolean => active() === i;
    const tick = props.check === false || !stateful ? null
      : h("span", { class: "hm-option-list-check", "aria-hidden": "true" }, props.check != null && props.check !== true ? icon(typeof props.check === "function" ? (props.check as () => unknown)() : props.check, "hm-option-list-own-check") : glyph(checkIcon));
    const inner = props.renderOption ? props.renderOption(it, { selected, active: isActive, index: i }) : [
      it.icon != null ? icon(it.icon, "hm-option-list-lead") : null,
      h("span", { class: "hm-option-list-text" },
        h("span", { class: "hm-option-list-label" }, it.label),
        it.hint != null ? h("span", { class: "hm-option-list-hint" }, it.hint) : null),
      it.trailing != null ? h("span", { class: "hm-option-list-trailing" }, it.trailing) : null];
    const state = rowRole === "option" ? { "aria-selected": () => String(selected()) } : rowRole === "menuitem" ? {} : { "aria-checked": () => String(selected()) };
    const common = {
      role: rowRole, ...state, "aria-disabled": it.disabled ? "true" : null, "data-index": String(i),
      class: () => cx("hm-option-list-row", selected() && "is-selected", byField && isActive() && "is-active", it.disabled && "is-disabled"),
    };
    if (byField) return h("div", { ...common, id: `${id}-${i}`, onPointerMove: () => { if (!it.disabled && active.peek() !== i) active.set(i); },
      onMouseDown: (e: Event) => e.preventDefault(), onClick: (e: Event) => pick(i, e) }, inner, tick);
    return h("button", { ...common, type: "button", disabled: !!it.disabled, tabindex: () => (tabStop() === i ? "0" : "-1"), onClick: (e: Event) => pick(i, e) }, inner, tick);
  };
  // focus mode: the Tab stop is the chosen row, else the first enabled one
  const tabStop = (): number => {
    const list = items();
    const chosen = list.findIndex((it) => !it.disabled && isSel(it.value));
    return chosen >= 0 ? chosen : list.findIndex((it) => !it.disabled);
  };

  const content = (): unknown => {
    const list = items();
    if (!list.length) return props.empty === false ? null : h("div", { class: "hm-option-list-empty", role: "presentation" }, props.empty ?? (() => t`No results`));
    const out: unknown[] = [];
    let group: string | undefined;
    list.forEach((it, i) => {
      if (it.group !== group) { group = it.group; if (group) out.push(h(SectionLabel, { class: "hm-option-list-group", role: "presentation" }, group)); }
      out.push(untrack(() => row(it, i)));
    });
    return out;
  };

  const cols = Math.max(1, props.columns ?? 1);
  root = h("div", {
    id, role: listRole, "aria-label": () => val(props.label) ?? null, "aria-multiselectable": props.multiple && listRole === "listbox" ? "true" : null,
    "aria-orientation": listRole === "menu" || cols > 1 ? null : "vertical", "data-hm-color": colorAttr(props.color),
    class: () => cx("hm-option-list", val(props.size) === "sm" && "hm-option-list-sm", cols > 1 && "hm-option-list-grid", cols > 1 && `hm-option-list-cols-${Math.min(cols, 6)}`, props.inline && "hm-option-list-inline", val(props.class)),
    onKeydown: byField ? null : (e: KeyboardEvent) => {
      // list-nav gives the next index; rows that are disabled are stepped over
      const list = rows(), from = list.indexOf(e.target as HTMLElement);
      if (from < 0) return;
      let next = moveCursor({ key: e.key, index: from, count: list.length, columns: cols, rtl: isRtl(root) });
      if (next == null) return;
      e.preventDefault();
      const dir = next >= from ? 1 : -1;
      while (list[next]?.hasAttribute("disabled") && next + dir >= 0 && next + dir < list.length) next += dir;
      if (list[next] && !list[next]!.hasAttribute("disabled")) list[next]!.focus();
    },
  }, content) as HTMLElement;

  if (byField) {
    // the field's keys move the highlight; the field points at the highlighted row
    const count = (): number => untrack(items).length;
    const keys = listNav({ count, active, onPick: (i) => pick(i, null), onMove: (i) => root?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView?.({ block: "nearest" }) });
    let field: Element | null | undefined, off: (() => void) | undefined;
    const attach = (): boolean => {
      field = typeof props.keysFrom === "function" ? props.keysFrom() : props.keysFrom;
      if (!field) return false;
      field.setAttribute("aria-controls", id);
      off = listen(field, { keydown: (e: KeyboardEvent) => { keys(e); } });
      sync();
      return true;
    };
    const sync = (): void => { const i = active(); if (field) { if (i >= 0 && i < count()) field.setAttribute("aria-activedescendant", `${id}-${i}`); else field.removeAttribute("aria-activedescendant"); } };
    effect(() => { items(); const n = count(); untrack(() => { if (active.peek() >= n) active.set(n ? 0 : -1); }); });
    effect(sync);
    if (!attach()) queueMicrotask(attach);
    if (getOwner()) onCleanup(() => { off?.(); field?.removeAttribute("aria-activedescendant"); });
  }
  return root;
}
