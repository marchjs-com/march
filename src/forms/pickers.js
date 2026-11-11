// Combobox (typeahead over static options or an async `search`) and MultiSelect (chips). WAI-ARIA combobox pattern:
// focus stays in the input, the active option is announced with aria-activedescendant.
import { signal, computed, effect, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { floating } from "../ui/popover.js";
import { model, ctl, cx, uid, debounce, listNav, fold, same, normOptions, extend } from "./util.js";

/**
 * Props: options (static) or search(q) → Promise<options>; debounce (ms, 250); minChars (0 static / 1 async); limit (50);
 * placeholder; renderOption(o); labelOf(value) (label for a value not in options); allowCustom (typed text becomes the value);
 * multiple (array value, chips); onSelect(option). Options: [value] or [{ value, label, hint, disabled }].
 */
export function Combobox(props) {
  const multi = !!props.multiple;
  const [get, set] = model(props, multi ? [] : null);
  const listId = uid("hm-lb");
  const open = signal(false), q = signal(""), active = signal(-1), loading = signal(false), error = signal(null), remote = signal(null);
  const seen = signal([], { equals: false }); // options picked from search results (for labels)
  const statics = computed(() => normOptions(props.options));
  const minChars = () => props.minChars ?? (props.search ? 1 : 0);
  const items = computed(() => {
    if (props.search) return remote() ?? [];
    const s = fold(q());
    const list = s ? statics().filter((o) => fold(o.label).includes(s) || fold(o.hint).includes(s)) : statics();
    return list.slice(0, props.limit ?? 50);
  });
  const labelOf = (v) => {
    if (v == null || v === "") return "";
    const o = statics().find((x) => same(x.value, v)) ?? seen().find((x) => same(x.value, v));
    return o ? o.label : props.labelOf ? props.labelOf(v) : String(v);
  };
  const isSel = (v) => (multi ? (get() ?? []).some((x) => same(x, v)) : same(get(), v));
  let reqId = 0;
  const run = debounce(async (text) => {
    const id = ++reqId;
    loading.set(true); error.set(null);
    try {
      const r = normOptions(await props.search(text));
      if (id === reqId) { remote.set(r); active.set(r.length ? 0 : -1); }
    } catch (e) { if (id === reqId) { remote.set([]); error.set(e?.message ?? String(e)); } }
    finally { if (id === reqId) loading.set(false); }
  }, props.debounce ?? 250);
  onCleanup(() => { run.cancel(); reqId++; });
  const query = (text) => {
    if (!props.search) return;
    if (text.length < minChars()) { run.cancel(); reqId++; remote.set(null); loading.set(false); return; }
    loading.set(true);
    run(text);
  };
  let editing = false, input, wrap;
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
  const pick = (i) => {
    const o = items.peek()[i];
    if (!o || o.disabled) return;
    if (props.search && !untrack(seen).some((x) => same(x.value, o.value))) seen.update((s) => [...s, o]);
    if (multi) {
      const cur = untrack(get) ?? [];
      set(cur.some((x) => same(x, o.value)) ? cur.filter((x) => !same(x, o.value)) : [...cur, o.value]);
      q.set(""); input.value = "";
      if (props.search) query("");
    } else { set(o.value); close(); restore(); }
    props.onSelect?.(o);
  };
  const removeAt = (v) => set((untrack(get) ?? []).filter((x) => !same(x, v)));
  const nav = listNav({ count: () => items.peek().length, active, onPick: pick, onOpen: openList, isOpen: () => open.peek() });
  input = h("input", {
    ...ctl(props), type: "text", role: "combobox", class: "hm-input hm-combo-input", autocomplete: "off", spellcheck: "false",
    "aria-autocomplete": "list", "aria-expanded": () => String(open()), "aria-controls": listId,
    "aria-activedescendant": () => (open() && active() >= 0 && items()[active()] ? `${listId}-${active()}` : null),
    placeholder: () => props.placeholder ?? null, readonly: () => !!props.readonly,
    onInput: (e) => {
      editing = true;
      q.set(e.target.value);
      if (!open.peek()) openList();
      active.set(props.search ? -1 : items.peek().length ? 0 : -1);
      query(e.target.value);
      if (!multi && !e.target.value && !props.required) set(null);
    },
    onKeyDown: (e) => {
      if (nav(e)) return;
      if (e.key === "Escape" && open.peek()) { e.preventDefault(); close(); restore(); }
      else if (e.key === "Enter" && props.allowCustom && input.value.trim()) {
        e.preventDefault();
        const v = input.value.trim();
        if (multi) { if (!(untrack(get) ?? []).includes(v)) set([...(untrack(get) ?? []), v]); input.value = ""; q.set(""); }
        else { set(v); editing = false; close(); }
      } else if (e.key === "Backspace" && multi && !input.value) { const cur = untrack(get) ?? []; if (cur.length) removeAt(cur[cur.length - 1]); }
      else if (e.key === "Tab") close();
    },
    onBlur: (e) => { close(); if (!props.allowCustom || multi) restore(); props.onBlur?.(e); },
    onClick: () => openList(),
  });
  effect(() => { const l = multi ? "" : labelOf(get()); untrack(() => { if (!editing && input.value !== l) input.value = l; }); });
  effect(() => { const i = active(); if (open() && i >= 0) untrack(() => globalThis.document?.getElementById(`${listId}-${i}`)?.scrollIntoView?.({ block: "nearest" })); });
  const status = (text) => h("div", { class: "hm-listbox-status", role: "status" }, text);
  const panel = () => floating({
    anchor: wrap, class: "hm-listbox", role: "listbox", id: listId, onClose: () => { close(); restore(); },
    attrs: { "aria-multiselectable": multi ? "true" : null, "aria-label": props["aria-label"] ?? null },
    children: () => {
      const list = items();
      if (error()) return status(t`Search failed: ${error()}`);
      if (loading() && !list.length) return status(t`Searching…`);
      if (props.search && remote() == null) return status(t`Type to search`);
      if (!list.length) return status(t`No results`);
      return list.map((o, i) => h("div", {
        role: "option", id: `${listId}-${i}`, class: "hm-option", "class:hm-active": () => active() === i,
        "aria-selected": () => String(isSel(o.value)), "aria-disabled": o.disabled ? "true" : null,
        onMouseDown: (e) => e.preventDefault(), onMouseMove: () => { if (active.peek() !== i) active.set(i); }, onClick: () => pick(i),
      }, props.renderOption ? props.renderOption(o) : [h("span", { class: "hm-option-label" }, o.label), o.hint ? h("small", { class: "hm-hint" }, o.hint) : null]));
    },
  });
  wrap = h("div", { class: cx("hm-combo", multi && "hm-multi", props.class), "class:hm-disabled": () => !!props.disabled, onClick: (e) => { if (e.target === wrap) input.focus(); } },
    multi ? () => (get() ?? []).map((v) => {
      const label = labelOf(v);
      return h("span", { class: "hm-chip" }, h("span", { class: "hm-chip-label" }, label),
        props.readonly || props.disabled ? null : h("button", { type: "button", class: "hm-chip-x", "aria-label": t`Remove ${label}`, onClick: () => { removeAt(v); input.focus(); } }, "×"));
    }) : null,
    input,
    () => (open() ? panel() : null));
  return wrap;
}

/** Multiple choice with chips; same props as Combobox (static options or async search). Value: array. */
export const MultiSelect = (props) => Combobox(extend(props, { multiple: () => true }));
