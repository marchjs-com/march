// PropertyGrid (hadi-march/ui): an inspector. Grouped, searchable property rows, each edited with the form control of
// its type (TextInput, NumberInput, Slider, Toggle, Select, Segmented, ColorInput, Textarea, or any `control`).
// Every change is an undo step (Undo manager; typing in one field merges into one step), and unsaved changes are
// registered with the DirtyState manager (leave warning, saveAll). Rows show what differs from the saved values and can
// be reset one by one.
import "./property-grid.css";
import { signal, computed, untrack, onCleanup, type Signal } from "../../../core/reactive.ts";
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
  /** Shown under the label and read by screen readers. */
  description?: string;
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
  properties: MaybeFn<readonly PropertySpec[]>;
  /** The edited object: a signal, a live value with onChange / setValue, or `bind:value`. */
  value?: Values | Signal<Values> | null;
  setValue?: (v: Values) => void;
  onChange?: (v: Values) => void;
  /** Saved values to compare with (default: the value at start, then whatever onSave saved). */
  saved?: MaybeFn<Values | undefined>;
  onSave?: ((values: Values) => unknown) | undefined;
  /** Accessible name and the DirtyState / undo label ("Button properties"). */
  label?: MaybeFn<string | undefined>;
  /** Undo history (default: the app's undoStack()); false: none. */
  history?: UndoStack | false;
  /** Unsaved-changes registry (default: the app's dirtyState()); false: none. */
  dirty?: DirtyState | false;
  /** DirtyState id (default: generated). */
  id?: string;
  /** Group order (others follow in the order they appear). */
  groups?: readonly string[];
  /** Show the search field (default true). */
  search?: boolean | undefined;
  /** "auto" (default): label beside the editor, stacked when narrow; "stacked": always above. */
  layout?: "auto" | "stacked" | undefined;
  api?: (api: PropertyGridApi) => void;
  /** The Undo / Redo buttons in the header (default true; the history itself is `history`). */
  historyButtons?: boolean | undefined;
  /** The "reset to saved" button of each row (default true). */
  resetButtons?: boolean | undefined;
  /** The dot beside a changed row's name and the changed count of a group (default true). */
  changeMarks?: boolean | undefined;
  /** The footer with the change count, Revert and Save (default true). */
  footer?: boolean | undefined;
  /** Own texts; defaults are the translated ones. */
  labels?: {
    search?: string; general?: string; empty?: string; noMatch?: (query: string) => string;
    changed?: string; changedCount?: (n: number) => string; unsaved?: (n: number) => string; noChanges?: string;
    revert?: unknown; save?: unknown; undo?: string; redo?: string; reset?: (label: string) => string; resetTitle?: string;
  } | undefined;
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
  const base = props.id ?? uid("hm-pg");
  const [get, set] = model<Values>(props, {});
  const savedLocal = signal<Values>(untrack(() => ({ ...(val(props.saved) ?? get()) })));
  const saved = (): Values => val(props.saved) ?? savedLocal();
  const history = props.history === false ? null : (props.history ?? undoStack());
  const query = signal("");
  const list = computed(() => val(props.properties) ?? []);
  const visible = computed(() => { const v = get(); return list().filter((p) => !p.hidden?.(v)); });
  const changes = computed(() => { const v = get(), s = saved(); return list().filter((p) => !deepEqual(v[p.key], s[p.key])).map((p) => p.key); });
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
    const changed = (): boolean => changes().includes(p.key);
    const Comp = p.control ?? CONTROLS[p.type ?? "text"] ?? TextInput;
    const cp: Record<string, unknown> = { id, labelledby: labelId, options: p.options, min: p.min, max: p.max, step: p.step, placeholder: p.placeholder, suffix: p.unit };
    for (const k of Object.keys(cp)) if (cp[k] === undefined) delete cp[k];
    Object.defineProperty(cp, "value", { get: () => get()[p.key], enumerable: true });
    Object.defineProperty(cp, "readonly", { get: () => !!val(p.readonly), enumerable: true });
    Object.defineProperty(cp, "invalid", { get: () => !!errors()[p.key], enumerable: true });
    Object.defineProperty(cp, "describedby", { get: () => [p.description ? descId : "", errors()[p.key] ? errId : ""].filter(Boolean).join(" ") || null, enumerable: true });
    cp["setValue"] = (v: unknown) => change(p, v);
    const control = untrack(() => Comp(cp));
    return h("div", { class: () => cx("hm-pg-row", changed() && "is-changed", errors()[p.key] && "is-invalid"), "data-key": p.key },
      h("div", { class: "hm-pg-label" },
        h("label", { id: labelId, for: id, class: "hm-pg-name", title: () => labelOf(p) }, () => labelOf(p)),
        props.changeMarks === false ? null : () => (changed() ? h(StatusDot, { class: "hm-pg-dot", tone: "primary", size: "xs", title: L().changed ?? t`Changed`, label: L().changed ?? t`changed` }) : null),
        p.description && h("span", { id: descId, class: "hm-pg-desc" }, p.description)),
      h("div", { class: "hm-pg-editor" }, control,
        () => (errors()[p.key] ? h("span", { id: errId, class: "hm-pg-error", role: "alert" }, errors()[p.key]) : null)),
      props.resetButtons === false ? null : h(IconButton, {
        class: "hm-pg-reset", size: "xs", icon: resetIcon, tabindex: () => (changed() ? "0" : "-1"), "aria-hidden": () => (changed() ? null : "true"),
        label: () => resetName(p), title: () => L().resetTitle ?? t`Reset to saved`, onClick: () => resetKeys([p.key], resetName(p)),
      }));
  };
  // rows are built once and kept; search and `hidden` only show / hide them
  const rows = new Map<string, Element>();
  const rowOf = (p: PropertySpec): Element => { let r = rows.get(p.key); if (!r) rows.set(p.key, (r = row(p))); return r; };
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
  const body = (): unknown => grouped().map((g) => untrack(() => {
    const items = g.items.map((p) => { const el = rowOf(p); return () => (matches().has(p.key) ? el : null); });
    const shown = computed((): boolean => g.items.some((p) => matches().has(p.key)));
    const changedIn = (): number => g.items.filter((p) => changes().includes(p.key)).length;
    const head = [h(SectionLabel, { as: "span", size: "md", class: "hm-pg-group-name" }, g.name || (L().general ?? t`General`)),
      props.changeMarks === false ? null : () => (changedIn() ? h(Badge, { class: "hm-pg-count", size: "xs", tone: "primary", count: changedIn(), ariaLabel: L().changedCount?.(changedIn()) ?? t`${changedIn()} changed` }) : null)];
    const content = h("div", { class: "hm-pg-rows" }, items);
    // the group box is built once (body runs again when the groups change): rows are never moved while they are used
    const box = g.name || grouped().length > 1 ? h(Disclosure, { title: head, open: () => { query(); return true; }, class: "hm-pg-group", children: content }) : content;
    return () => (shown() ? box : null);
  }));

  props.api?.({ changes: () => changes(), save, revert, markSaved, focus: (k) => (globalThis.document?.getElementById(`${base}-${k}`) as HTMLElement | null)?.focus() });

  return h("section", { class: () => cx("hm-pg", props.layout === "stacked" && "hm-pg-stacked", val(props.class)), "aria-label": title },
    h(PanelHeader, { as: "div", size: "sm", divider: true, class: "hm-pg-head",
      actions: history && props.historyButtons !== false ? h(UndoRedo, { class: "hm-pg-history", history, size: "sm", shortcuts: false, labels: { undo: () => L().undo, redo: () => L().redo } }) : undefined,
      children: props.search === false ? undefined : h(SearchBox, { class: "hm-pg-search", inputClass: "hm-pg-search-input", size: "sm", debounce: 0, value: query,
        label: () => L().search ?? t`Search properties`, placeholder: () => L().search ?? t`Search properties` }) }),
    h("div", { class: "hm-pg-body" }, body,
      () => (matches().size ? null : h("div", { class: "hm-pg-empty", role: "status" }, h(Empty, { size: "sm", title: () => (query() ? L().noMatch?.(query()) ?? t`No property matches “${query()}”` : L().empty ?? t`No properties`) })))),
    // the footer: while something changed, or always when there is a Save (disabled with nothing to save)
    () => (props.footer !== false && (changes().length || props.onSave) ? untrack(() => h(PanelHeader, { as: "footer", size: "sm", divider: true, class: () => cx("hm-pg-foot", changes().length > 0 && "is-dirty"), role: "status",
      title: () => (changes().length ? L().unsaved?.(changes().length) ?? t`${changes().length} unsaved changes` : L().noChanges ?? t`No changes`),
      actions: [
        () => (changes().length ? h(Button, { variant: "ghost", size: "sm", class: "hm-pg-revert", onClick: revert }, L().revert ?? t`Revert`) : null),
        props.onSave && h(Button, { variant: "primary", size: "sm", class: "hm-pg-save", disabled: () => !changes().length, onClick: () => void save() }, L().save ?? t`Save`)],
    })) : null));
}
