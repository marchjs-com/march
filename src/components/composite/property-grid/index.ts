// PropertyGrid (march/ui): an inspector. Grouped, searchable property rows, each edited with the form control of
// its type (TextInput, NumberInput, Slider, Toggle, Select, Segmented, ColorInput, Textarea, or any `control`).
// Every change is an undo step (Undo manager; typing in one field merges into one step), and unsaved changes are
// registered with the DirtyState manager (leave warning, saveAll). Rows show what differs from the saved values and can
// be reset one by one.
import "./property-grid.css";
import { signal, computed, untrack, onCleanup, getOwner, createRoot, reactive, type Signal } from "../../../core/reactive.ts";
import { load as loadStored, save as store } from "../../../core/util.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, uid, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { deepEqual } from "../../../core/equal.ts";
import { score } from "../../../ui/fold.ts";
import { Disclosure } from "../../../ui/disclosure.ts";
import { TextInput, Textarea, NumberInput, Slider, Toggle, Select, Segmented, ColorInput } from "../../../forms/inputs.ts";
import { model, type OptionsProp } from "../../../forms/util.ts";
import { undoStack, type UndoStack } from "../../../managers/undo/index.ts";
import { dirtyState, type DirtyState } from "../../../managers/dirty/index.ts";
import { history as resetIcon } from "../../../icons/glyphs/history.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { UndoRedo } from "../../actions/undo-redo/index.ts";
import { Badge } from "../../data/badge/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { Chip } from "../../actions/chip/index.ts";
import { chevronsUpDown } from "../../../icons/glyphs/chevronsUpDown.ts";
import { Tooltip } from "../../overlays/tooltip/index.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import tr from "./tr.ts";

messages("tr", tr);

type Values = Record<string, unknown>;
/** A control for a property: called with `value` (getter), `setValue`, `id`, `labelledby` and the property's options. */
export type PropertyControl = (props: Record<string, unknown>) => unknown;
export type PropertyType = "text" | "textarea" | "number" | "int" | "slider" | "switch" | "select" | "segmented" | "color";

/** One row of the grid. */
export interface PropertySpec {
  key: string;
  label: MaybeFn<string>;
  /** Editor (default "text"); `control` overrides it with any component. */
  type?: PropertyType;
  control?: PropertyControl;
  group?: string;
  /** Shown under the label (quiet, brighter on the row's hover) and read by screen readers; in full in the label's
   * tooltip. */
  description?: string;
  /** The property's own name (the prop: "size"), shown in the tooltip after the label ("Size: size"). */
  name?: string | undefined;
  options?: OptionsProp;
  min?: number;
  max?: number;
  step?: number;
  /** NumberInput: unit after the value ("px"). */
  unit?: string;
  placeholder?: string;
  readonly?: MaybeFn<boolean | undefined>;
  /** Hide the row for these values (e.g. a radius only when a border is on). */
  hidden?: (values: Values) => boolean;
  /** An error message, or null. */
  validate?: (value: unknown, values: Values) => string | null | undefined;
  /** Search words besides the label. */
  keywords?: string;
}

/** Imperative control (`api={(a) => grid = a}`). */
export interface PropertyGridApi {
  /** Keys that differ from the saved values (reactive). */
  changes: () => string[];
  /** Run onSave, then make the current values the saved ones. */
  save(): Promise<void>;
  /** Back to the saved values (one undo step). */
  revert(): void;
  /** Make the current values the saved ones (after saving elsewhere). */
  markSaved(): void;
  /** Focus a property's editor. */
  focus(key: string): void;
}

export interface PropertyGridProps {
  /** The property specs: key, label, type, control, group, description, options, limits, validate … (or an accessor). @tr Özellik tanımları: key, label, type, control, group, description, options, sınırlar, validate … (ya da bir erişimci). */
  properties: MaybeFn<readonly PropertySpec[]>;
  /** The edited object: a signal, a live value with onChange / setValue, or `bind:value`. @tr Düzenlenen nesne: bir sinyal, onChange / setValue ile canlı bir değer ya da `bind:value`. */
  value?: Values | Signal<Values> | null;
  /** Called with the new object on every edit (pairs with `value`). @tr Her düzenlemede yeni nesneyle çağrılır (`value` ile birlikte). */
  setValue?: (v: Values) => void;
  /** Called with the new object on every edit. @tr Her düzenlemede yeni nesneyle çağrılır. */
  onChange?: (v: Values) => void;
  /** Saved values to compare with (default: the value at start, then whatever onSave saved). @tr Karşılaştırılacak kayıtlı değerler (varsayılan: başlangıçtaki değer, sonra onSave'in kaydettiği). */
  saved?: MaybeFn<Values | undefined>;
  /** Saves the values; shows the Save button, and DirtyState's `saveAll()` runs it too. @tr Değerleri kaydeder; Save düğmesini gösterir, DirtyState'in `saveAll()`'ı da onu çalıştırır. */
  onSave?: ((values: Values) => unknown) | undefined;
  /** Accessible name and the DirtyState / undo label ("Button properties"). @tr Erişilebilir ad ve DirtyState / geri alma etiketi ("Button properties"). */
  label?: MaybeFn<string | undefined>;
  /** Undo history (default: the app's undoStack()); false: none. @tr Geri alma geçmişi (varsayılan: uygulamanın undoStack()'i); false: yok. */
  history?: UndoStack | false;
  /** Unsaved-changes registry (default: the app's dirtyState()); false: none. @tr Kaydedilmemiş değişiklik kaydı (varsayılan: uygulamanın dirtyState()'i); false: yok. */
  dirty?: DirtyState | false;
  /** DirtyState id (default: generated). @tr DirtyState kimliği (varsayılan: üretilir). */
  id?: string;
  /** Group order (others follow in the order they appear). @tr Grup sırası (diğerleri göründükleri sırayla gelir). */
  groups?: readonly string[];
  /** Show the search field (default true). @tr Arama alanını gösterir (varsayılan true). */
  search?: boolean | undefined;
  /** "auto" (default): label beside the editor, stacked when narrow; "stacked": always above. @tr "auto" (varsayılan): etiket düzenleyicinin yanında, dar alanda üst üste; "stacked": hep üstte. */
  layout?: "auto" | "stacked" | undefined;
  /** Receives the grid API: `changes()`, `save()`, `revert()`, `markSaved()`, `focus(key)`. @tr Izgara API'sini alır: `changes()`, `save()`, `revert()`, `markSaved()`, `focus(key)`. */
  api?: (api: PropertyGridApi) => void;
  /** The Undo / Redo buttons in the header (default true; the history itself is `history`). @tr Başlıktaki Undo / Redo düğmeleri (varsayılan true; geçmişin kendisi `history`). */
  historyButtons?: boolean | undefined;
  /** The "reset to saved" button of each row (default true). @tr Her satırın "kayıtlıya sıfırla" düğmesi (varsayılan true). */
  resetButtons?: boolean | undefined;
  /** The dot beside a changed row's name and the changed count of a group (default true). @tr Değişen satırın adının yanındaki nokta ve bir grubun değişiklik sayısı (varsayılan true). */
  changeMarks?: boolean | undefined;
  /** The footer with the change count, Revert and Save (default true). @tr Değişiklik sayısı, Revert ve Save içeren alt bilgi (varsayılan true). */
  footer?: boolean | undefined;
  /** With more than one group: a row of tools at the top — open / close every group, and a chip per group (lit while it
   * is open; a press opens or closes it). Default true. @tr Birden çok grupta üstte bir araç satırı: bütün grupları
   * aç / kapat ve her grup için bir çip (açıkken seçili; basınca açar ya da kapatır). Varsayılan true. */
  groupTools?: boolean | undefined;
  /** Keep which groups are closed in localStorage under "m.pg.<persist>" (they open as they were left). @tr Hangi grupların kapalı olduğunu localStorage'da "m.pg.<persist>" altında tutar (bırakıldıkları gibi açılır). */
  persist?: string | undefined;
  /** The groups open at first (the others closed) until the user opens or closes one; default: every group. @tr Başta açık gruplar (diğerleri kapalı), kullanıcı birini açıp kapatana kadar; varsayılan: hepsi. */
  openGroups?: readonly string[] | undefined;
  /** Own texts; defaults are the translated ones. @tr Kendi metinlerin; varsayılanlar çevrilmiş olanlar. */
  labels?: {
    search?: string; general?: string; empty?: string; noMatch?: (query: string) => string;
    changed?: string; changedCount?: (n: number) => string; unsaved?: (n: number) => string; noChanges?: string;
    revert?: unknown; save?: unknown; undo?: string; redo?: string; reset?: (label: string) => string; resetTitle?: string;
    openAll?: string; closeAll?: string; sections?: string;
  } | undefined;
  /** Extra classes on the section (`m-pg`). @tr Bölüme (`m-pg`) eklenen ek sınıflar. */
  class?: ClassProp;
}

const CONTROLS: Record<PropertyType, PropertyControl> = {
  text: TextInput as PropertyControl, textarea: Textarea as PropertyControl, number: NumberInput as PropertyControl,
  int: ((p: Record<string, unknown>) => NumberInput({ ...p, decimals: 0 } as never)) as PropertyControl,
  slider: Slider as PropertyControl, switch: Toggle as PropertyControl, select: Select as PropertyControl,
  segmented: Segmented as PropertyControl, color: ColorInput as PropertyControl,
};

/** `<PropertyGrid properties={[{ key: "width", label: "Width", type: "number", group: "Layout", unit: "px" }]} bind:value={$props} onSave={save} />` */
export function PropertyGrid(props: PropertyGridProps): Element {
  const base = props.id ?? uid("m-pg");
  const [get, set] = model<Values>(props, {});
  const savedLocal = signal<Values>(untrack(() => ({ ...(val(props.saved) ?? get()) })));
  const saved = (): Values => val(props.saved) ?? savedLocal();
  const history = props.history === false ? null : (props.history ?? undoStack());
  const query = signal("");
  const list = computed(() => val(props.properties) ?? []);
  const visible = computed(() => { const v = get(); return list().filter((p) => !p.hidden?.(v)); });
  const changes = computed(() => { const v = get(), s = saved(); return list().filter((p) => !deepEqual(v[p.key], s[p.key])).map((p) => p.key); });
  // every row and group asks "is this key changed?" on each edit: a set answers without scanning the list
  const changedSet = computed(() => new Set(changes()));
  const labelOf = (p: PropertySpec): string => val(p.label) ?? p.key;
  const title = (): string => val(props.label) ?? t`Properties`;
  const L = (): NonNullable<PropertyGridProps["labels"]> => props.labels ?? {};
  const resetName = (p: PropertySpec): string => L().reset?.(labelOf(p)) ?? t`Reset ${labelOf(p)}`;

  // write one key; an undo step unless replaying (typing in one field within a second merges into one step)
  const write = (key: string, v: unknown): void => { set({ ...untrack(get), [key]: v }); };
  const change = (p: PropertySpec, v: unknown): void => {
    const prev = untrack(get)[p.key];
    if (deepEqual(prev, v)) return;
    write(p.key, v);
    history?.push({ label: t`Change ${labelOf(p)}`, undo: () => write(p.key, prev), redo: () => write(p.key, v), merge: `${base}.${p.key}` });
  };
  const resetKeys = (keys: string[], label: string): void => {
    if (!keys.length) return;
    const before = untrack(get), s = untrack(saved);
    const after = { ...before };
    for (const k of keys) after[k] = s[k];
    set(after);
    history?.push({ label, undo: () => set({ ...untrack(get), ...Object.fromEntries(keys.map((k) => [k, before[k]])) }), redo: () => set({ ...untrack(get), ...Object.fromEntries(keys.map((k) => [k, s[k]])) }) });
  };
  const markSaved = (): void => { savedLocal.set({ ...untrack(get) }); history?.markSaved(); };
  const save = async (): Promise<void> => { await props.onSave?.(untrack(get)); markSaved(); };
  const revert = (): void => resetKeys(untrack(changes), t`Revert ${title()}`);

  if (props.dirty !== false) {
    const d = props.dirty ?? dirtyState();
    const off = d.track(base, () => changes().length > 0, untrack(title), props.onSave ? save : undefined);
    onCleanup(off);
  }

  // ---------------------------------------------------------------- rows
  const errors = computed(() => { const v = get(); const out: Record<string, string> = {}; for (const p of list()) { const e = p.validate?.(v[p.key], v); if (e) out[p.key] = e; } return out; });
  const row = (p: PropertySpec): Element => {
    const id = `${base}-${p.key}`, labelId = `${id}-l`, descId = `${id}-d`, errId = `${id}-e`;
    const changed = (): boolean => changedSet().has(p.key);
    const Comp = p.control ?? CONTROLS[p.type ?? "text"] ?? TextInput;
    const cp: Record<string, unknown> = { id, labelledby: labelId, options: p.options, min: p.min, max: p.max, step: p.step, placeholder: p.placeholder, suffix: p.unit };
    for (const k of Object.keys(cp)) if (cp[k] === undefined) delete cp[k];
    Object.defineProperty(cp, "value", { get: () => get()[p.key], enumerable: true });
    Object.defineProperty(cp, "readonly", { get: () => !!val(p.readonly), enumerable: true });
    Object.defineProperty(cp, "invalid", { get: () => !!errors()[p.key], enumerable: true });
    Object.defineProperty(cp, "describedby", { get: () => [p.description ? descId : "", errors()[p.key] ? errId : ""].filter(Boolean).join(" ") || null, enumerable: true });
    cp["setValue"] = (v: unknown) => change(p, v);
    const control = untrack(() => Comp(cp));
    // the name is the label of the editor's one form field (a text box, a select, a switch's checkbox, a combobox's
    // input; given an id when it has none); an editor of several choices (radios, buttons) is named by aria-labelledby
    // and its name is plain text (a label would pick its first choice when clicked)
    const fields = control instanceof Element
      ? [control, ...control.querySelectorAll("input, select, textarea")].filter((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && (e as HTMLInputElement).type !== "radio" && (e as HTMLInputElement).type !== "hidden")
      : [];
    const field = fields.length === 1 ? fields[0]! : null;
    if (field && !field.id) field.id = `${id}-f`;
    // no form field but one control (a Switch, a single button): it is named by the row's label too
    if (!field && control instanceof Element) {
      const one = [control, ...control.querySelectorAll("button, [role=switch], [role=checkbox], [tabindex]")].filter((e) => e.matches("button, [role=switch], [role=checkbox], [tabindex]"));
      if (one.length === 1 && !one[0]!.hasAttribute("aria-label") && !one[0]!.hasAttribute("aria-labelledby")) one[0]!.setAttribute("aria-labelledby", labelId);
    }
    const label = h("div", { class: "m-pg-label" },
      h(field ? "label" : "span", { id: labelId, ...(field ? { for: field.id } : {}), class: "m-pg-name", title: () => (p.description ? null : labelOf(p)) }, () => labelOf(p)),
      props.changeMarks === false ? null : () => (changed() ? h(StatusDot, { class: "m-pg-dot", tone: "primary", size: "xs", title: L().changed ?? t`Changed`, label: L().changed ?? t`changed` }) : null),
      p.description && h("span", { id: descId, class: "m-pg-desc" }, p.description));
    // a described property: its label and name, then the whole text, in a tooltip over the label
    const tip = (): string => { const l = labelOf(p), n = p.name && p.name !== l ? `: ${p.name}` : ""; return `${l}${n}\n${p.description}`; };
    return h("div", { class: () => cx("m-pg-row", changed() && "is-changed", errors()[p.key] && "is-invalid"), "data-key": p.key },
      p.description ? h(Tooltip, { text: tip, placement: "top", delay: 400, class: "m-pg-tip", children: label }) : label,
      h("div", { class: "m-pg-editor" }, control,
        () => (errors()[p.key] ? h("span", { id: errId, class: "m-pg-error", role: "alert" }, errors()[p.key]) : null)),
      props.resetButtons === false ? null : h(IconButton, {
        class: "m-pg-reset", size: "xs", icon: resetIcon, tabindex: () => (changed() ? "0" : "-1"), "aria-hidden": () => (changed() ? null : "true"),
        label: () => resetName(p), title: () => L().resetTitle ?? t`Reset to saved`, onClick: () => resetKeys([p.key], resetName(p)),
      }));
  };
  // rows are built once per spec and kept; search and `hidden` only show / hide them; a new spec for a key builds its
  // row again (the old one is disposed)
  const rows = new Map<string, { spec: PropertySpec; el: Element; dispose: () => void }>();
  // built under the grid itself, not under the section that first shows them: a section drawn again (a row shown or
  // hidden, a group opened) would otherwise take the kept rows' labels, marks and editors with it
  const owner = getOwner();
  const rowOf = (p: PropertySpec): Element => {
    const r = rows.get(p.key);
    if (r?.spec === p) return r.el;
    r?.dispose();
    const next = createRoot((dispose) => ({ spec: p, el: row(p), dispose }), owner);
    rows.set(p.key, next);
    return next.el;
  };
  onCleanup(() => { for (const r of rows.values()) r.dispose(); rows.clear(); });
  // equal sets are the same value: a value change that hides or shows nothing must not touch the rows (a slider
  // being dragged stays the same node, keeps focus and pointer capture)
  const matches = computed(() => {
    const q = query().trim();
    return new Set(visible().filter((p) => !q || score(q, labelOf(p), [p.key, p.group ?? "", p.keywords ?? "", p.description ?? ""]) > 0).map((p) => p.key));
  }, { equals: (a, b) => !!a && !!b && a.size === b.size && [...a].every((k) => b.has(k)) });
  const grouped = computed(() => {
    const order = [...(props.groups ?? [])];
    for (const p of list()) { const g = p.group ?? ""; if (!order.includes(g)) order.push(g); }
    return order.map((g) => ({ name: g, items: list().filter((p) => (p.group ?? "") === g) })).filter((x) => x.items.length);
  });
  // the groups closed by hand (a search opens them all while it lasts)
  const keyOf = props.persist ? `m.pg.${props.persist}` : "";
  // the user's own choice (kept with `persist`) wins; else `openGroups` closes the other groups at first
  const stored = keyOf ? loadStored<string[] | null>(keyOf, null) : null;
  const closed = signal<ReadonlySet<string>>(new Set(stored ?? (props.openGroups ? untrack(grouped).map((g) => g.name).filter((n) => !props.openGroups!.includes(n)) : [])));
  /** Close or open groups by the user's hand: kept from now on. */
  const choose = (next: ReadonlySet<string>): void => { closed.set(next); if (keyOf) store(keyOf, [...next]); };
  const setOpen = (name: string, open: boolean): void => {
    const now = closed.peek();
    if (open !== now.has(name)) return;
    const next = new Set(now);
    if (open) next.delete(name); else next.add(name);
    choose(next);
  };
  const isOpen = (name: string): boolean => !!query() || !closed().has(name);
  const groupName = (g: { name: string }): string => g.name || (L().general ?? t`General`);
  const allOpen = (): boolean => grouped().every((g) => isOpen(g.name));
  const tools = (): unknown => (props.groupTools === false || grouped().length < 2 ? null : h("div", { class: "m-pg-tools", role: "group", "aria-label": () => L().sections ?? t`Sections` },
    h(IconButton, { class: "m-pg-all", icon: chevronsUpDown, size: "xs", variant: "ghost", label: () => (allOpen() ? L().closeAll ?? t`Close all` : L().openAll ?? t`Open all`),
      onClick: () => choose(allOpen() ? new Set(grouped().map((g) => g.name)) : new Set()) }),
    () => grouped().map((g) => untrack(() => h(Chip, { size: "sm", selected: () => isOpen(g.name), onClick: () => setOpen(g.name, !isOpen(g.name)) }, groupName(g))))));
  const body = (): unknown => grouped().map((g) => untrack(() => {
    const items = g.items.map((p) => { const el = rowOf(p); return () => (matches().has(p.key) ? el : null); });
    const shown = computed((): boolean => g.items.some((p) => matches().has(p.key)));
    const changedIn = (): number => g.items.filter((p) => changedSet().has(p.key)).length;
    const head = [h(SectionLabel, { as: "span", size: "md", class: "m-pg-group-name" }, g.name || (L().general ?? t`General`)),
      props.changeMarks === false ? null : () => (changedIn() ? h(Badge, { class: "m-pg-count", size: "xs", tone: "primary", variant: "solid", count: changedIn(), ariaLabel: L().changedCount?.(changedIn()) ?? t`${changedIn()} changed` }) : null)];
    const content = h("div", { class: "m-pg-rows" }, items);
    // the group box is built once (body runs again when the groups change): rows are never moved while they are used
    const box = g.name || grouped().length > 1 ? h(Disclosure, { title: head, open: reactive(() => isOpen(g.name)), onToggle: (o: boolean) => { if (!query()) setOpen(g.name, o); }, class: "m-pg-group", children: content }) : content;
    return () => (shown() ? box : null);
  }));

  props.api?.({ changes: () => changes(), save, revert, markSaved, focus: (k) => (globalThis.document?.getElementById(`${base}-${k}`) as HTMLElement | null)?.focus() });

  return h("section", { class: () => cx("m-pg", props.layout === "stacked" && "m-pg-stacked", val(props.class)), "aria-label": title },
    h(PanelHeader, { as: "div", size: "sm", divider: true, class: "m-pg-head",
      actions: history && props.historyButtons !== false ? h(UndoRedo, { class: "m-pg-history", history, size: "sm", shortcuts: false, labels: { undo: () => L().undo, redo: () => L().redo } }) : undefined,
      children: [props.search === false ? null : h(SearchBox, { class: "m-pg-search", inputClass: "m-pg-search-input", size: "sm", debounce: 0, value: query,
        label: () => L().search ?? t`Search properties`, placeholder: () => L().search ?? t`Search properties` }), tools] }),
    h("div", { class: "m-pg-body" }, body,
      () => (matches().size ? null : h("div", { class: "m-pg-empty", role: "status" }, h(Empty, { size: "sm", title: () => (query() ? L().noMatch?.(query()) ?? t`No property matches “${query()}”` : L().empty ?? t`No properties`) })))),
    // the footer: while something changed, or always when there is a Save (disabled with nothing to save)
    () => (props.footer !== false && (changes().length || props.onSave) ? untrack(() => h(PanelHeader, { as: "footer", size: "sm", divider: true, class: () => cx("m-pg-foot", changes().length > 0 && "is-dirty"), role: "status",
      title: () => (changes().length ? L().unsaved?.(changes().length) ?? t`${changes().length} unsaved changes` : L().noChanges ?? t`No changes`),
      actions: [
        () => (changes().length ? h(Button, { variant: "ghost", size: "sm", class: "m-pg-revert", onClick: revert }, L().revert ?? t`Revert`) : null),
        props.onSave && h(Button, { variant: "primary", size: "sm", class: "m-pg-save", disabled: () => !changes().length, onClick: () => void save() }, L().save ?? t`Save`)],
    })) : null));
}
