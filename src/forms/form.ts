// useForm (state, validation, submit), <Form> (auto-rendered from a schema or custom children), <Field> (label, control,
// help, error with the right aria wiring) and <EditForm> (load → edit → save with reason, toast and reload).
import "./form.css";
import "../ui/field.css";
import { signal, computed, effect, batch, untrack, onCleanup, useContext, provide, type Accessor } from "../core/reactive.ts";
import { store, unwrap } from "../core/store.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { schema as makeSchema, options as schemaOptions, type Schema, type SchemaSpec, type FieldValue, type Values, type Field as SchemaField } from "../schema/index.ts";
import { scoped, cx, uid, live, type FieldCtx, type ClassProp } from "./util.ts";
import { inputFor, GROUP_CONTROLS, INLINE_LABEL } from "./registry.ts";
import { Field, FormContext, setControlBuilder, type FieldProps, type BuiltControl } from "./field.ts";
export { Field, FormContext, type FieldProps } from "./field.ts";
import { colorAttr, type ColorToken } from "../theme/colors.ts";
import { isPlain, deepEqual } from "../core/equal.ts";
import { errorText } from "../ui/format.ts";
import { Button } from "../components/actions/button/index.ts";
import { Alert } from "../components/feedback/alert/index.ts";

/** When fields validate: on blur (default), on every change, or only on submit. */
export type ValidateOn = "blur" | "change" | "submit";
/** Field names of a value type. */
export type FieldName<V> = keyof V & string;

/** Options of useForm(). */
export interface FormOptions<V> {
  /** Called with the coerced values of the active fields; throw `{ fieldErrors }` to show server errors per field. */
  onSubmit?: { bivarianceHack(values: V, form: FormController<V>): unknown }["bivarianceHack"] | undefined;
  validateOn?: ValidateOn | undefined;
  onChange?: { bivarianceHack(name: FieldName<V>, value: V[FieldName<V>], values: V): void }["bivarianceHack"] | undefined;
  onInvalid?: ((errors: Record<string, string>) => void) | undefined;
}

/** Props from `form.register(name)` for a plain element. */
export interface RegisterProps {
  id: string;
  name: string;
  value: () => unknown;
  checked: (() => boolean) | undefined;
  onInput: (e: Event) => void;
  onChange: ((e: Event) => void) | undefined;
  onBlur: () => void;
  "aria-invalid": () => "true" | null;
  "aria-describedby": () => string | null;
  ref: (el: Element) => void;
}

/** Form state and behaviour (from useForm). `values` is a reactive store of the record type `V`. */
export interface FormController<V = Values> {
  schema: Schema<V>;
  values: V;
  /** Message per field name. */
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  id: string;
  /** DOM id of a field's control. */
  idOf(name: string): string;
  submitting(): boolean;
  submitError(): string | null;
  submitCount(): number;
  dirty: Accessor<boolean>;
  valid: Accessor<boolean>;
  /** Values the form was loaded / reset / last saved with. */
  initial(): V;
  get<K extends keyof V>(name: K): V[K];
  error(name: FieldName<V>): string | null;
  set<K extends keyof V>(name: K, v: V[K]): void;
  /** Mark touched and (blur / change modes) validate. */
  blur(name: FieldName<V>): void;
  /** Validate one field or all; true when valid. */
  validate(name?: FieldName<V>): boolean;
  setErrors(map: Partial<Record<FieldName<V>, string>>, opts?: { focus?: boolean }): void;
  clearErrors(): void;
  focus(name: FieldName<V>): void;
  /** Restore the initial values, or start over from `v` (which becomes the new baseline for `dirty`). */
  reset(v?: Partial<V> | (() => Partial<V>) | null): void;
  /** Validate, focus the first invalid field, coerce with schema.parse and call onSubmit(values). */
  submit(e?: Event): Promise<unknown>;
  /** Props for a plain element: `<input {...form.register("email")} />`. */
  register(name: FieldName<V>, opts?: { type?: string }): RegisterProps;
  /** A rendered <Field> for a schema field. */
  field(name: FieldName<V>, overrides?: Omit<FieldProps<V>, "form" | "name">): unknown;
  /** Set by <Form readonly> / <EditForm>. */
  readonly?: (() => boolean) | undefined;
}

/** Context holding the nearest form (from <Form>, <Wizard>, <EditForm>). */
/** The enclosing form's controller (from useForm). */
export const useFormContext = <V = Values>(): FormController<V> | null => useContext(FormContext) as FormController<V> | null;

/** Deep copy of plain objects / arrays (Files, Dates and class instances are kept by reference). */
export function clone<T>(v: T): T {
  v = unwrap(v);
  if (!isPlain(v)) return v;
  if (Array.isArray(v)) return v.map(clone) as T;
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(v)) o[k] = clone(v[k]);
  return o as T;
}
export { deepEqual };

/** Thrown from onSubmit to end a submit quietly (EditForm: the reason prompt was dismissed). */
export const CANCELLED = Object.freeze({ cancelled: true });
/** Value type of a plain spec (Infer without the Schema branch). */
type SpecValues<S> = { -readonly [K in keyof S]: FieldValue<S[K]> };
type Initial<V> = Partial<V> | (() => Partial<V>) | null | undefined;

/**
 * Form state and behaviour for a schema.
 * @param sch  a schema() or a plain spec
 * @param initial  values (or a function returning them) over the schema defaults
 * @param opts  onSubmit(values, form), validateOn ("blur" | "change" | "submit"), onChange(name, value, values), onInvalid(errors)
 */
export function useForm<V>(sch: Schema<V>, initial?: Initial<V>, opts?: FormOptions<V>): FormController<V>;
export function useForm<S extends SchemaSpec>(spec?: S | null, initial?: Initial<SpecValues<S>>, opts?: FormOptions<SpecValues<S>>): FormController<SpecValues<S>>;
export function useForm<V = Values>(sch?: Schema<V> | SchemaSpec | null, initial?: Initial<V>, opts?: FormOptions<V>): FormController<V>;
export function useForm(spec?: Schema | SchemaSpec | null, initial?: Initial<Values>, opts: FormOptions<Values> = {}): FormController {
  const sch: Schema = (spec as Partial<Schema> | null | undefined)?.fields ? (spec as Schema) : makeSchema((spec ?? {}) as SchemaSpec);
  const fid = uid("mf");
  const mode = opts.validateOn ?? "blur";
  const fresh = (v: Initial<Values>): Values => ({ ...sch.defaults(), ...clone((typeof v === "function" ? v() : v) ?? {}) });
  let base = fresh(initial);
  const baseVer = signal(0);
  const values = store(clone(base));
  const errors = store<Record<string, string>>({});
  const touched = store<Record<string, boolean>>({});
  const submitting = signal(false), submitError = signal<string | null>(null), submitCount = signal(0);
  const els = new Map<string, HTMLElement>();

  const setErr = (name: string, msg: string | null) => { if (msg) errors[name] = msg; else if (untrack(() => name in errors)) delete errors[name]; };
  const check = (name: string) => { const m = untrack(() => sch.validateField(name, values[name], values)); setErr(name, m); return m; };
  const replaceErrors = (map: Record<string, string>) => batch(() => { for (const k of Object.keys(unwrap(errors))) if (!(k in map)) delete errors[k]; Object.assign(errors, map); });
  const idOf = (name: string) => `${fid}-${name}`;
  const focus = (name: string) => {
    const el = els.get(name) ?? globalThis.document?.getElementById(idOf(name));
    el?.focus?.();
    el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  };
  const focusFirst = (map: Record<string, unknown>) => { const n = sch.names().find((k) => map[k]) ?? Object.keys(map)[0]; if (n) focus(n); };
  const snapshot = () => untrack(() => clone(values));

  const form: FormController = {
    schema: sch, values, errors, touched, id: fid, idOf,
    submitting: () => submitting(), submitError: () => submitError(), submitCount: () => submitCount(),
    dirty: computed(() => { baseVer(); return sch.names().some((n) => !deepEqual(values[n], base[n])); }),
    valid: computed(() => sch.validate(values).ok),
    initial: () => { baseVer(); return clone(base); },
    get: (name) => values[name],
    error: (name) => errors[name] ?? null,
    set(name, v) {
      batch(() => {
        values[name] = v;
        if (mode === "change" || untrack(submitCount) > 0 || untrack(() => name in errors)) check(name);
      });
      opts.onChange?.(name, v, values);
    },
    blur(name) {
      touched[name] = true;
      if (mode !== "submit" || untrack(submitCount) > 0) check(name);
    },
    validate(name) {
      if (name) return !check(name);
      const r = sch.validate(snapshot());
      replaceErrors(r.errors);
      return r.ok;
    },
    setErrors(map, { focus: f = true } = {}) { batch(() => Object.assign(errors, map)); if (f) focusFirst(map); },
    clearErrors: () => replaceErrors({}),
    focus,
    reset(v) {
      if (v !== undefined) base = fresh(v);
      const next = clone(base);
      batch(() => {
        for (const k of Object.keys(unwrap(values))) if (!(k in next)) delete values[k];
        for (const k of Object.keys(next)) values[k] = next[k];
        replaceErrors({});
        for (const k of Object.keys(unwrap(touched))) delete touched[k];
        submitCount.set(0); submitError.set(null);
        baseVer.set(baseVer.peek() + 1);
      });
    },
    async submit(e) {
      e?.preventDefault?.();
      if (submitting.peek()) return false;
      const snap = snapshot();
      const r = sch.validate(snap);
      batch(() => {
        submitCount.set(submitCount.peek() + 1);
        submitError.set(null);
        replaceErrors(r.errors);
        for (const f of sch.fields) touched[f.name] = true;
      });
      if (!r.ok) { focusFirst(r.errors); opts.onInvalid?.(r.errors); return false; }
      const out: Values = {};
      for (const f of sch.fields) if (f.name in r.values && sch.isActive(f.name, snap)) out[f.name] = r.values[f.name];
      if (!opts.onSubmit) return out;
      const ver = baseVer.peek();
      submitting.set(true);
      try {
        const res = await opts.onSubmit(out, form);
        if (baseVer.peek() === ver) { base = snap; baseVer.set(ver + 1); }
        return res === undefined ? true : res;
      } catch (err) {
        const ex = err as { cancelled?: unknown; fieldErrors?: unknown; message?: string } | null | undefined;
        if (err === CANCELLED || ex?.cancelled) return false;
        const fe = ex?.fieldErrors;
        if (fe && typeof fe === "object") {
          const known: Record<string, string> = {}, other: string[] = [];
          for (const [k, m] of Object.entries(fe)) (sch.field(k) ? (known[k] = String(m)) : other.push(String(m)));
          batch(() => Object.assign(errors, known));
          if (other.length) submitError.set(other.join(" "));
          focusFirst(known);
        } else submitError.set(errorText(err));
        return false;
      } finally { submitting.set(false); }
    },
    register(name, { type } = {}) {
      return {
        id: idOf(name), name,
        value: () => values[name] ?? "",
        checked: type === "checkbox" ? () => !!values[name] : undefined,
        onInput: (e) => { const el = e.target as HTMLInputElement; form.set(name, el.type === "checkbox" ? el.checked : el.value); },
        onChange: type === "checkbox" ? (e) => form.set(name, (e.target as HTMLInputElement).checked) : undefined,
        onBlur: () => form.blur(name),
        "aria-invalid": () => (errors[name] ? "true" : null),
        "aria-describedby": () => (errors[name] ? `${idOf(name)}-error` : null),
        ref: (el) => { els.set(name, el as HTMLElement); onCleanup(() => { if (els.get(name) === el) els.delete(name); }); },
      };
    },
    field: (name, overrides = {}) => h(Field, { ...overrides, form, name }),
  };
  return form;
}

// ------------------------------------------------------------------ Field
// <Field> lives in field.ts (no input registry, so a page that only wraps its own control in a Field does not download
// every input). A field bound to a schema needs a form, and the form installs the schema control builder here.
const NOT_FORWARDED = new Set(["name", "label", "type", "help", "when", "validate", "default", "column", "format", "hidden", "control", "props",
  "requiredMessage", "pattern", "patternMessage", "span", "readonly", "disabled", "options", "value", "minLength", "section", "variant"]);

function controlFor(form: FormController, f: SchemaField, props: FieldProps, ctx: FieldCtx): BuiltControl | null {
  const Comp = inputFor(f);
  if (!Comp) return null;
  const name = f.name;
  const p: Record<string, unknown> = { id: ctx.id, name, field: f };
  for (const k of Object.keys(f)) if (!NOT_FORWARDED.has(k)) p[k] = f[k];
  if (f.options) Object.defineProperty(p, "options", { get: () => schemaOptions(f), enumerable: true });
  if (f.type === "text" && f.max != null) p["maxLength"] = f.maxLength ?? f.max;
  if (["text", "textarea", "password", "email", "url", "phone"].includes(f.type)) { delete p["min"]; delete p["max"]; }
  if (f.type === "list") delete p["min"];
  Object.assign(p, f["props"] ?? {}, props.controlProps ?? {});
  Object.defineProperty(p, "value", { get: () => form.values[name], enumerable: true });
  p["setValue"] = (v: unknown) => form.set(name, v);
  p["onBlur"] = () => form.blur(name);
  Object.defineProperty(p, "disabled", { get: () => !!(props.disabled || f.disabled || form.submitting()), enumerable: true });
  Object.defineProperty(p, "readonly", { get: () => !!(props.readonly || f.readonly || form.readonly?.()), enumerable: true });
  if (INLINE_LABEL.has(Comp)) p["label"] = props.label ?? f.label;
  return { el: untrack(() => Comp(p)), group: GROUP_CONTROLS.has(Comp), inlineLabel: INLINE_LABEL.has(Comp) };
}

setControlBuilder(controlFor);

// ------------------------------------------------------------------ Form
/** Layout of auto-rendered fields. */
export interface FieldsLayout { layout?: "stack" | "grid" | undefined; cols?: number | undefined }

/** Render the active schema fields (`names` or all), honouring `when`, `hidden` and layout. */
export function renderFields<V>(form: FormController<V>, names?: readonly FieldName<V>[] | null, layout?: FieldsLayout): Element;
export function renderFields(form: FormController, names?: readonly string[] | null, { layout = "stack", cols = 2 }: FieldsLayout = {}): Element {
  const sch = form.schema;
  const list = (names ?? sch.names()).filter((n) => { const f = sch.field(n); return f && !f.hidden && f.type !== "hidden"; });
  return h("div", { class: layout === "grid" ? cx("m-form-grid", `m-cols-${cols}`) : "m-form-stack" }, list.map((n) => {
    const on = computed(() => sch.isActive(n, form.values));
    return () => (on() ? untrack(() => h(Field, { form, name: n })) : null);
  }));
}

/** Props of <FormActions>. */
export interface FormActionsProps<V = Values> {
  form?: FormController<V> | null | undefined;
  /** true = reset, or a function. */
  cancel?: boolean | ((form: FormController<V>) => unknown) | null | undefined;
  cancelLabel?: unknown;
  submitLabel?: unknown;
  busyLabel?: unknown;
  /** Disable submit until something changed. */
  requireDirty?: boolean | undefined;
  /** Extra buttons before cancel / submit. */
  extra?: unknown;
  class?: ClassProp;
}

/** Submit / cancel bar with the submit error. */
export function FormActions<V = Values>(props: FormActionsProps<V>): unknown;
export function FormActions(props: FormActionsProps): unknown {
  const form = (props.form ?? useFormContext())!;
  const cancel = props.cancel;
  return h("div", { class: cx("m-form-actions", props.class) },
    () => (form.submitError() ? h(Alert, { tone: "danger", class: "m-form-error" }, form.submitError()) : null),
    h("div", { class: "m-form-buttons" },
      props.extra ?? null,
      cancel ? h(Button, { disabled: () => form.submitting(), onClick: () => (typeof cancel === "function" ? cancel(form) : form.reset()) }, () => props.cancelLabel ?? t`Cancel`) : null,
      h(Button, { type: "submit", variant: "primary", loading: () => form.submitting(), disabled: () => !!(props.requireDirty && !form.dirty()) },
        () => (form.submitting() ? props.busyLabel ?? t`Saving…` : props.submitLabel ?? t`Save`))));
}

/** Warn before leaving the page while the form has unsaved changes. */
export function guardLeave(form: FormController, enabled: () => boolean): void {
  effect(() => {
    if (!enabled() || !form.dirty()) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; return ""; };
    globalThis.addEventListener?.("beforeunload", fn);
    onCleanup(() => globalThis.removeEventListener?.("beforeunload", fn));
  });
}

/** A titled group of fields in <Form sections>. */
export interface FormSection<V> {
  title?: unknown;
  description?: unknown;
  fields: readonly FieldName<V>[];
  cols?: number | undefined;
}

/** Props of <Form>. */
export interface FormProps<V = Values> extends FieldsLayout {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  schema?: Schema<V> | SchemaSpec | undefined;
  initial?: Initial<V>;
  onSubmit?: ((values: V, form: FormController<V>) => unknown) | undefined;
  validateOn?: ValidateOn | undefined;
  onChange?: FormOptions<V>["onChange"];
  /** An existing useForm() controller. */
  form?: FormController<V> | undefined;
  submitLabel?: unknown;
  /** true = reset, or a function. */
  cancel?: boolean | ((form: FormController<V>) => unknown) | null | undefined;
  cancelLabel?: unknown;
  sections?: readonly FormSection<V>[] | null | undefined;
  /** false hides the submit bar. */
  actions?: boolean | undefined;
  confirmLeave?: boolean | undefined;
  requireDirty?: boolean | undefined;
  readonly?: boolean | null | undefined;
  onReady?: ((form: FormController<V>) => void) | undefined;
  extraActions?: unknown;
  class?: ClassProp;
  children?: unknown;
}

/**
 * Form. Auto-renders every active schema field, or your children (reach the controller with useFormContext()).
 * Props: schema, initial, onSubmit, validateOn, form (an existing useForm), submitLabel, cancel (true = reset, or fn),
 * cancelLabel, layout ("stack" | "grid"), cols, sections [{ title, description, fields }], actions (false hides the bar),
 * confirmLeave, requireDirty, readonly, onReady(form), class.
 */
export function Form<V = Values>(props: FormProps<V>): unknown;
export function Form(props: FormProps): unknown {
  return scoped(() => {
    const form = props.form ?? useForm(props.schema, props.initial, { onSubmit: props.onSubmit, validateOn: props.validateOn, onChange: props.onChange });
    if (props.readonly != null && !props.form) form.readonly = () => !!props.readonly;
    provide(FormContext, form);
    props.onReady?.(form);
    guardLeave(form, () => !!props.confirmLeave);
    const custom = props.children;
    const layout = { layout: props.layout ?? "stack", cols: props.cols ?? 2 };
    const body = custom ?? (props.sections
      ? props.sections.map((s) => h("fieldset", { class: "m-section" },
        s.title ? h("legend", { class: "m-section-title" }, s.title) : null,
        s.description ? h("p", { class: "m-section-desc" }, s.description) : null,
        renderFields(form, s.fields, { ...layout, cols: s.cols ?? layout.cols })))
      : renderFields(form, null, layout));
    const noBar = props.actions === false || props.readonly;
    return h("form", { "data-m-color": () => colorAttr(props.color),
      class: cx("m-form", props.class), novalidate: true, "aria-busy": () => (form.submitting() ? "true" : null),
      onSubmit: (e: Event) => { e.preventDefault(); form.submit(); },
      onKeyDown: noBar ? (e: KeyboardEvent) => { const el = e.target as HTMLInputElement; if (e.key === "Enter" && !e.defaultPrevented && el.tagName === "INPUT" && !["checkbox", "radio", "button", "file"].includes(el.type)) { e.preventDefault(); form.submit(); } } : null,
    }, body, noBar ? null : h(FormActions, { form, cancel: props.cancel, cancelLabel: props.cancelLabel, submitLabel: props.submitLabel, requireDirty: props.requireDirty, extra: props.extraActions }));
  });
}
