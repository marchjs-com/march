// OptionList (march/ui): a list of choices inside a panel — a theme or accent picker, a type menu, the
// suggestions under a field. Rows are a lead (icon, swatch, avatar), a label, a hint, a trailing part and a tick on
// the chosen one. Three roles: "radio" (one choice, default), "listbox" (one or many), "menu" (commands). Keys come
// from the list-nav behavior: arrows / Home / End move focus among the rows, or — with `keysFrom` — the keys of a
// field move a highlight (aria-activedescendant) while focus stays in the field. `keys={false}`: the owner drives the
// list (a combobox with its own open / close keys): rows are highlighted from `active`, no listener is added.
import "./option-list.css";
import { signal, effect, untrack, onCleanup, getOwner, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, uid, icon, glyph, isRtl, listen, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { moveCursor, listNav } from "../../../behaviors/list-nav/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { check as checkIcon } from "../../../icons/glyphs/check.ts";
import type { Handler } from "../../../core/util.ts";

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
  /** The rows: `[{ value, label, hint?, icon?, disabled? }]` (or an accessor). @tr Satırlar: `[{ value, label, hint?, icon?, disabled? }]` (ya da bir erişimci). */
  options: MaybeFn<readonly OptionItem<T>[]>;
  /** The chosen value (an array with `multiple`): a signal (two-way), a value / accessor, or `bind:value`. @tr Seçilen değer (`multiple` ile dizi): sinyal (iki yönlü), değer / erişimci ya da `bind:value`. */
  value?: Signal<T | null> | Signal<readonly T[]> | MaybeFn<T | readonly T[] | null | undefined>;
  /** Writes the chosen value back (set by `bind:value`). @tr Seçilen değeri geri yazar (`bind:value` bunu verir). */
  setValue?: ((v: never) => void) | undefined;
  /** A row was chosen (click, Enter, Space). @tr Bir satır seçildi (tıklama, Enter, Space). */
  onPick?: Handler<[value: T, item: OptionItem<T>, e: Event | null]> | undefined;
  /** Several values can be chosen (listbox). @tr Birden çok değer seçilebilir (listbox). */
  multiple?: boolean | undefined;
  /** "radio" (default): one of many · "listbox": options, one or many · "menu": commands (checked when a value is given). @tr "radio" (varsayılan): birden biri · "listbox": seçenekler, bir ya da çok · "menu": komutlar (değer verilince işaretli). */
  mode?: "radio" | "listbox" | "menu" | undefined;
  /** The field whose keys drive the list (focus stays there; rows are highlighted through aria-activedescendant). @tr Tuşları listeyi yöneten alan (odak orada kalır; satırlar aria-activedescendant ile vurgulanır). */
  keysFrom?: Element | (() => Element | null | undefined) | undefined;
  /** The highlighted row with `keysFrom` (your own signal when you need to read or reset it). @tr `keysFrom` ile vurgulanan satır (okumanız ya da sıfırlamanız gerekirse kendi sinyaliniz). */
  active?: Signal<number> | undefined;
  /**
   * `false`: the list listens to no keys and touches no field. Rows are options with the ids `<id>-<index>`, the
   * highlight is your `active` signal (the row scrolls into view); you handle the keys and aria-activedescendant.
   * @tr `false`: liste hiçbir tuşu dinlemez, hiçbir alana dokunmaz. Satırlar `<id>-<index>` id'li seçeneklerdir, vurgu sizin `active` sinyalinizdir (satır görünüme kayar); tuşları ve aria-activedescendant'ı siz yönetirsiniz.
   */
  keys?: boolean | undefined;
  /** A label that does not fit: "ellipsis" (default) cuts it, "wrap" breaks it into lines. @tr Sığmayan etiket: "ellipsis" (varsayılan) keser, "wrap" satırlara böler. */
  overflow?: "ellipsis" | "wrap" | undefined;
  /** Accessible name of the list. @tr Listenin erişilebilir adı. */
  label?: MaybeFn<string | undefined>;
  /** Id of the list; rows get `<id>-<index>` (default: generated). @tr Listenin id'si; satırlar `<id>-<index>` alır (varsayılan: üretilir). */
  id?: string | undefined;
  /** The tick on a chosen row: true (default), false, your own icon, or `() => node` (called for every row). @tr Seçilen satırdaki tik: true (varsayılan), false, kendi ikonunuz ya da `() => node` (her satır için çağrılır). */
  check?: boolean | unknown | (() => unknown) | undefined;
  /** Rows per line (a grid of choices; default 1). @tr Satır başına öğe sayısı (seçenek ızgarası; varsayılan 1). */
  columns?: number | undefined;
  /** Row size: `sm` or `md` (default). @tr Satır boyutu: `sm` ya da `md` (varsayılan). */
  size?: MaybeFn<"sm" | "md" | undefined>;
  /** Hint beside the label instead of under it. @tr İpucu etiketin altında değil yanında. */
  inline?: boolean | undefined;
  /** Shown when there are no options: text or a node (default "No results"); false for nothing. @tr Seçenek yokken gösterilen: metin ya da düğüm (varsayılan "No results"); hiçbir şey için false. */
  empty?: unknown | undefined;
  /** Draw the inside of a row yourself. @tr Satırın içini kendiniz çizin. */
  renderOption?: ((item: OptionItem<T>, state: OptionState) => unknown) | undefined;
  /** Extra CSS classes on the list. @tr Listeye eklenen CSS sınıfları. */
  class?: ClassProp | undefined;
}

const isSignal = (v: unknown): v is Signal<unknown> => typeof v === "function" && (v as Partial<Signal<unknown>>).signal === true;
const ROLES = { radio: ["radiogroup", "radio"], listbox: ["listbox", "option"], menu: ["menu", "menuitem"] } as const;

/** `<OptionList bind:value={$theme} label="Theme" options={[{ value: "light", label: "Light", icon: sun }, { value: "dark", label: "Dark", icon: moon }]} />` */
export function OptionList<T = string>(props: OptionListProps<T>): Element {
  const id = props.id ?? uid("m-ol");
  const driven = props.keys === false;
  const byField = driven || props.keysFrom != null;
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
  const rows = (): HTMLElement[] => Array.from(root?.querySelectorAll<HTMLElement>(".m-option-list-row") ?? []);

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

  // the one place a row is drawn: a ListRow (lead + label + hint + trailing) with the tick at its end
  const row = (it: OptionItem<T>, i: number): Element => {
    const selected = (): boolean => isSel(it.value), isActive = (): boolean => active() === i;
    const tick = props.check === false || !stateful ? null
      : h("span", { class: "m-option-list-check", "aria-hidden": "true" }, props.check != null && props.check !== true ? icon(typeof props.check === "function" ? (props.check as () => unknown)() : props.check, "m-option-list-own-check") : glyph(checkIcon));
    const trail = it.trailing != null || tick ? [it.trailing ?? null, tick] : undefined;
    return h(ListRow, {
      as: byField ? "div" : "button", role: rowRole, "data-index": String(i), interactive: true, overflow: props.overflow ?? "ellipsis",
      class: () => cx("m-option-list-row", byField && isActive() && "is-active"),
      size: () => (val(props.size) === "sm" ? "sm" : "md"), disabled: !!it.disabled, onClick: (e: MouseEvent) => pick(i, e),
      // ListRow says the choice by the role: aria-checked (radio, menuitemradio) or aria-selected (option); a command has no state
      ...(rowRole === "menuitem" ? {} : { selected }),
      ...(byField ? { id: `${id}-${i}`, onPointerMove: () => { if (!it.disabled && active.peek() !== i) active.set(i); }, onMouseDown: (e: Event) => e.preventDefault() }
        : { tabindex: () => (tabStop() === i ? "0" : "-1") }),
      ...(props.renderOption ? { children: props.renderOption(it, { selected, active: isActive, index: i }), trail: tick ?? undefined } : { lead: it.icon ?? undefined, title: it.label, sub: it.hint ?? undefined, trail }),
    }) as Element;
  };
  // focus mode: the Tab stop is the chosen row, else the first enabled one
  const tabStop = (): number => {
    const list = items();
    const chosen = list.findIndex((it) => !it.disabled && isSel(it.value));
    return chosen >= 0 ? chosen : list.findIndex((it) => !it.disabled);
  };

  const content = (): unknown => {
    const list = items();
    if (!list.length) return props.empty === false ? null : h("div", { class: "m-option-list-empty", role: "presentation" }, props.empty ?? (() => t`No results`));
    const out: unknown[] = [];
    let group: string | undefined;
    list.forEach((it, i) => {
      if (it.group !== group) { group = it.group; if (group) out.push(h(SectionLabel, { class: "m-option-list-group", role: "presentation" }, group)); }
      out.push(untrack(() => row(it, i)));
    });
    return out;
  };

  const cols = Math.max(1, props.columns ?? 1);
  root = h("div", {
    id, role: listRole, "aria-label": () => val(props.label) ?? null, "aria-multiselectable": props.multiple && listRole === "listbox" ? "true" : null,
    "aria-orientation": listRole === "menu" || cols > 1 ? null : "vertical", class: () => cx("m-option-list", val(props.size) === "sm" && "m-option-list-sm", cols > 1 && "m-option-list-grid", cols > 1 && `m-option-list-cols-${Math.min(cols, 6)}`, props.inline && "m-option-list-inline", val(props.class)),
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

  // driven from outside: only keep the highlighted row in view
  if (driven) effect(() => { const i = active(); if (i >= 0) untrack(() => root?.querySelector<HTMLElement>(`[data-index="${i}"]`)?.scrollIntoView?.({ block: "nearest" })); });
  else if (byField) {
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
    // a list removed before the microtask runs must not listen to the field afterwards
    let gone = false;
    if (!attach()) queueMicrotask(() => { if (!gone) attach(); });
    if (getOwner()) onCleanup(() => { gone = true; off?.(); field?.removeAttribute("aria-activedescendant"); });
  }
  return root;
}
