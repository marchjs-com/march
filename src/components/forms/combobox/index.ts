// Combobox: typeahead over static options or an async `search` (chips with `multiple`). WAI-ARIA combobox pattern:
// focus stays in the input, the active option is announced with aria-activedescendant.
import "../../actions/menu/menu.css";
import "./combobox.css";
import "../../../ui/field.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { floating } from "../../../ui/popover.ts";
import { model, ctl, cx, uid, debounce, listNav, fold, same, normOptions, type ControlProps, type Option, type OptionsProp } from "../../../forms/util.ts";
import { ownPart } from "../../../ui/parts.ts";
import { errorText } from "../../../ui/format.ts";
import { Chip } from "../../actions/chip/index.ts";
import { OptionList, type OptionItem } from "../option-list/index.ts";
import type { IconProp } from "../../../icons/types.ts";

export interface ComboboxProps<T = unknown> extends ControlProps<T | null | T[]> {
  /** Static options: [value] or [{ value, label, hint, disabled }], or a comma-separated text ("Kadıköy, Beşiktaş"). @tr Sabit seçenekler: [value] ya da [{ value, label, hint, disabled }], ya da virgülle ayrılmış bir metin ("Kadıköy, Beşiktaş"). */
  options?: OptionsProp;
  /** Async options for the typed text. @tr Yazılan metne göre eşzamansız seçenekler. */
  search?: ((q: string) => Promise<readonly unknown[]> | readonly unknown[]) | undefined;
  /** ms (250). @tr Arama öncesi bekleme, ms (250). */
  debounce?: number | undefined;
  /** Characters before searching (0 static / 1 async). @tr Aramadan önce gereken karakter sayısı (sabitte 0 / eşzamansızda 1). */
  minChars?: number | undefined;
  /** Most options shown in the list (default 50). @tr Listede gösterilen en fazla seçenek (varsayılan 50). */
  limit?: number | undefined;
  /** Placeholder of the text field. @tr Metin alanının yer tutucusu. */
  placeholder?: string | null | undefined;
  /** Draws an option row: `(option) => node`. @tr Bir seçenek satırını çizer: `(option) => node`. */
  renderOption?: ((o: Option) => unknown) | undefined;
  /** Label for a value that is not in the options. @tr Seçeneklerde olmayan bir değerin etiketi. */
  labelOf?: ((value: T) => string) | undefined;
  /** Typed text becomes the value. @tr Yazılan metin değer olur. */
  allowCustom?: boolean | undefined;
  /** Array value, chips. @tr Değer dizi olur, seçilenler chip olarak görünür. */
  multiple?: boolean | undefined;
  /** Called with the option when one is chosen. @tr Bir seçenek seçilince o seçenekle çağrılır. */
  onSelect?: ((o: Option) => void) | undefined;
  /** Texts the list and the chips write themselves (defaults: "Searching…", "Type to search", "No results", "Search failed: …", "Remove …"). @tr Liste ve chip'lerin kendi yazdığı metinler (varsayılanlar: "Searching…", "Type to search", "No results", "Search failed: …", "Remove …"). */
  labels?: {
    searching?: unknown; typeToSearch?: unknown; noResults?: unknown;
    searchFailed?: ((message: string) => unknown) | undefined;
    remove?: ((label: string) => string) | undefined;
  } | undefined;
  /** The remove button of a chip (`multiple`): `false` removes it (Backspace still removes), a node / text / `() => node` replaces the "×". @tr Chip'in kaldırma düğmesi (`multiple`): `false` kaldırır (Backspace yine siler), düğüm / metin / `() => node` "×" yerine geçer. */
  removeIcon?: IconProp;
}

/**
 * Props: options (static) or search(q) → Promise<options>; debounce (ms, 250); minChars (0 static / 1 async); limit (50);
 * placeholder; renderOption(o); labelOf(value) (label for a value not in options); allowCustom (typed text becomes the value);
 * multiple (array value, chips); onSelect(option). Options: [value] or [{ value, label, hint, disabled }].
 */
export function Combobox<T = unknown>(props: ComboboxProps<T>): unknown {
  const multi = !!props.multiple;
  const [get, set] = model<unknown>(props, multi ? [] : null);
  const getList = () => get() as unknown[] | null;
  const listId = uid("m-lb");
  const open = signal(false), q = signal(""), active = signal(-1), loading = signal(false), error = signal<string | null>(null), remote = signal<Option[] | null>(null);
  const seen = signal<Option[]>([], { equals: false }); // options picked from search results (for labels)
  const statics = computed(() => normOptions(props.options));
  const minChars = () => props.minChars ?? (props.search ? 1 : 0);
  const items = computed(() => {
    if (props.search) return remote() ?? [];
    const s = fold(q());
    const list = s ? statics().filter((o) => fold(o.label).includes(s) || fold(o.hint).includes(s)) : statics();
    return list.slice(0, props.limit ?? 50);
  });
  const labelOf = (v: unknown) => {
    if (v == null || v === "") return "";
    const o = statics().find((x) => same(x.value, v)) ?? seen().find((x) => same(x.value, v));
    return o ? o.label : props.labelOf ? props.labelOf(v as T) : String(v);
  };
  const isSel = (v: unknown) => (multi ? (getList() ?? []).some((x) => same(x, v)) : same(get(), v));
  let reqId = 0;
  const run = debounce(async (text: string) => {
    const id = ++reqId;
    loading.set(true); error.set(null);
    try {
      const r = normOptions(await props.search!(text));
      if (id === reqId) { remote.set(r); active.set(r.length ? 0 : -1); }
    } catch (e) { if (id === reqId) { remote.set([]); error.set(errorText(e)); } }
    finally { if (id === reqId) loading.set(false); }
  }, props.debounce ?? 250);
  onCleanup(() => { run.cancel(); reqId++; });
  const query = (text: string) => {
    if (!props.search) return;
    if (text.length < minChars()) { run.cancel(); reqId++; remote.set(null); loading.set(false); return; }
    loading.set(true);
    run(text);
  };
  let editing = false, input: HTMLInputElement, wrap: Element;
  const restore = () => { editing = false; if (!multi) input.value = untrack(() => labelOf(get())); };
  const openList = () => {
    if (props.disabled || props.readonly || open.peek()) return;
    open.set(true);
    const list = items.peek();
    const i = multi ? 0 : list.findIndex((o) => same(o.value, untrack(get)));
    active.set(list.length ? Math.max(0, i) : -1);
    if (props.search && remote.peek() == null) query(q.peek());
  };
  const close = () => { open.set(false); active.set(-1); };
  const pick = (i: number) => {
    const o = items.peek()[i];
    if (!o || o.disabled) return;
    if (props.search && !untrack(seen).some((x) => same(x.value, o.value))) seen.update((s) => [...s, o]);
    if (multi) {
      const cur = untrack(getList) ?? [];
      set(cur.some((x) => same(x, o.value)) ? cur.filter((x) => !same(x, o.value)) : [...cur, o.value]);
      q.set(""); input.value = "";
      if (props.search) query("");
    } else { set(o.value); close(); restore(); }
    props.onSelect?.(o);
  };
  const removeAt = (v: unknown) => set((untrack(getList) ?? []).filter((x) => !same(x, v)));
  const nav = listNav({ count: () => items.peek().length, active, onPick: pick, onOpen: openList, isOpen: () => open.peek() });
  input = h("input", {
    ...ctl(props), type: "text", role: "combobox", class: "m-input m-combo-input", autocomplete: "off", spellcheck: "false",
    "aria-autocomplete": "list", "aria-expanded": () => String(open()), "aria-controls": listId,
    "aria-activedescendant": () => (open() && active() >= 0 && items()[active()] ? `${listId}-${active()}` : null),
    placeholder: () => props.placeholder ?? null, readonly: () => !!props.readonly,
    onInput: (e: Event) => {
      const target = e.target as HTMLInputElement;
      editing = true;
      q.set(target.value);
      if (!open.peek()) openList();
      active.set(props.search ? -1 : items.peek().length ? 0 : -1);
      query(target.value);
      if (!multi && !target.value && !props.required) set(null);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (nav(e)) return;
      if (e.key === "Escape" && open.peek()) { e.preventDefault(); close(); restore(); }
      else if (e.key === "Enter" && props.allowCustom && input.value.trim()) {
        e.preventDefault();
        const v = input.value.trim();
        if (multi) { if (!(untrack(getList) ?? []).includes(v)) set([...(untrack(getList) ?? []), v]); input.value = ""; q.set(""); }
        else { set(v); editing = false; close(); }
      } else if (e.key === "Backspace" && multi && !input.value) { const cur = untrack(getList) ?? []; if (cur.length) removeAt(cur[cur.length - 1]); }
      else if (e.key === "Tab") close();
    },
    onBlur: (e: FocusEvent) => { close(); if (!props.allowCustom || multi) restore(); props.onBlur?.(e); },
    onClick: () => openList(),
  }) as HTMLInputElement;
  effect(() => { const l = multi ? "" : labelOf(get()); untrack(() => { if (!editing && input.value !== l) input.value = l; }); });
  // loading, empty and error states: the list's "empty" part, said as a status
  const status = (): unknown => {
    const lb = props.labels;
    return h("div", { class: "m-listbox-status", role: "status" },
      error() ? (lb?.searchFailed ? lb.searchFailed(error()!) : t`Search failed: ${error()}`)
        : loading() ? lb?.searching ?? t`Searching…`
          : props.search && remote() == null ? lb?.typeToSearch ?? t`Type to search` : lb?.noResults ?? t`No results`);
  };
  const rows = computed(() => items().map((o): OptionItem<Option> => ({ value: o, label: o.label, trailing: o.hint || undefined, disabled: !!o.disabled })));
  const chosen = computed(() => { const on = items().filter((o) => isSel(o.value)); return multi ? on : on[0] ?? null; });
  // the options are an OptionList driven from here: focus stays in the input, `active` is the highlight
  const panel = () => floating({
    anchor: wrap, class: "m-listbox", role: null, onClose: () => { close(); restore(); },
    children: h(OptionList<Option>, {
      id: listId, keys: false, active, multiple: multi, check: false, overflow: "wrap", label: () => props["aria-label"] ?? undefined,
      options: rows, value: chosen, empty: status, onPick: (o) => pick(items.peek().indexOf(o)),
      ...(props.renderOption ? { renderOption: (it: OptionItem<Option>) => props.renderOption!(it.value) } : null),
    }),
  });
  wrap = h("div", { class: () => cx("m-combo", multi && "m-multi", props.class), "class:m-disabled": () => !!props.disabled, onClick: (e: MouseEvent) => { if (e.target === wrap) input.focus(); } },
    multi ? () => (getList() ?? []).map((v) => {
      const label = labelOf(v);
      const fixed = props.readonly || props.disabled || props.removeIcon === false;
      return h(Chip, {
        class: "m-chip", removeLabel: props.labels?.remove?.(label) ?? t`Remove ${label}`, removeIcon: ownPart(props.removeIcon, () => undefined),
        ...(fixed ? null : { onRemove: () => { removeAt(v); input.focus(); } }),
      }, label);
    }) : null,
    input,
    () => (open() ? panel() : null));
  return wrap;
}
