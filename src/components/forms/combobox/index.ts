// Combobox: typeahead over static options or an async `search` (chips with `multiple`). WAI-ARIA combobox pattern:
// focus stays in the input, the active option is announced with aria-activedescendant.
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
import { ListRow } from "../../data/list-row/index.ts";

export interface ComboboxProps<T = unknown> extends ControlProps<T | null | T[]> {
  /** Static options: [value] or [{ value, label, hint, disabled }]. */
  options?: OptionsProp;
  /** Async options for the typed text. */
  search?: ((q: string) => Promise<readonly unknown[]> | readonly unknown[]) | undefined;
  /** ms (250). */
  debounce?: number | undefined;
  /** Characters before searching (0 static / 1 async). */
  minChars?: number | undefined;
  limit?: number | undefined;
  placeholder?: string | null | undefined;
  renderOption?: ((o: Option) => unknown) | undefined;
  /** Label for a value that is not in the options. */
  labelOf?: ((value: T) => string) | undefined;
  /** Typed text becomes the value. */
  allowCustom?: boolean | undefined;
  /** Array value, chips. */
  multiple?: boolean | undefined;
  onSelect?: ((o: Option) => void) | undefined;
  /** Texts the list and the chips write themselves (defaults: "Searching…", "Type to search", "No results", "Search failed: …", "Remove …"). */
  labels?: {
    searching?: unknown; typeToSearch?: unknown; noResults?: unknown;
    searchFailed?: ((message: string) => unknown) | undefined;
    remove?: ((label: string) => string) | undefined;
  } | undefined;
  /** The remove button of a chip (`multiple`): `false` removes it (Backspace still removes), a node / text / `() => node` replaces the "×". */
  removeIcon?: unknown;
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
  const listId = uid("hm-lb");
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
    ...ctl(props), type: "text", role: "combobox", class: "hm-input hm-combo-input", autocomplete: "off", spellcheck: "false",
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
  effect(() => { const i = active(); if (open() && i >= 0) untrack(() => globalThis.document?.getElementById(`${listId}-${i}`)?.scrollIntoView?.({ block: "nearest" })); });
  const status = (text: unknown) => h("div", { class: "hm-listbox-status", role: "status" }, text);
  const panel = () => floating({
    anchor: wrap, class: "hm-listbox", role: "listbox", id: listId, onClose: () => { close(); restore(); },
    attrs: { "aria-multiselectable": multi ? "true" : null, "aria-label": props["aria-label"] ?? null },
    children: () => {
      const list = items();
      const lb = props.labels;
      if (error()) return status(lb?.searchFailed ? lb.searchFailed(error()!) : t`Search failed: ${error()}`);
      if (loading() && !list.length) return status(lb?.searching ?? t`Searching…`);
      if (props.search && remote() == null) return status(lb?.typeToSearch ?? t`Type to search`);
      if (!list.length) return status(lb?.noResults ?? t`No results`);
      // an option is a ListRow (label + hint at the end, or your own drawing); focus stays in the input
      return list.map((o, i) => h(ListRow, {
        as: "div", role: "option", id: `${listId}-${i}`, class: () => cx("hm-option", active() === i && "hm-active"), overflow: "wrap",
        "aria-selected": () => String(isSel(o.value)), disabled: !!o.disabled,
        onMouseDown: (e: MouseEvent) => e.preventDefault(), onMouseMove: () => { if (active.peek() !== i) active.set(i); }, onClick: () => pick(i),
        ...(props.renderOption ? { children: props.renderOption(o) } : { title: o.label, trail: o.hint || undefined }),
      }));
    },
  });
  wrap = h("div", { class: () => cx("hm-combo", multi && "hm-multi", props.class), "class:hm-disabled": () => !!props.disabled, onClick: (e: MouseEvent) => { if (e.target === wrap) input.focus(); } },
    multi ? () => (getList() ?? []).map((v) => {
      const label = labelOf(v);
      const fixed = props.readonly || props.disabled || props.removeIcon === false;
      return h(Chip, {
        class: "hm-chip", removeLabel: props.labels?.remove?.(label) ?? t`Remove ${label}`, removeIcon: ownPart(props.removeIcon, () => undefined),
        ...(fixed ? null : { onRemove: () => { removeAt(v); input.focus(); } }),
      }, label);
    }) : null,
    input,
    () => (open() ? panel() : null));
  return wrap;
}
