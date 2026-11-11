// useForm (state, validation, submit), <Form> (auto-rendered from a schema or custom children), <Field> (label, control,
// help, error with the right aria wiring) and <EditForm> (load → edit → save with reason, toast and reload).
import { signal, computed, effect, batch, untrack, onCleanup, useContext, provide, reactive } from "../core/reactive.ts";
import { store, unwrap } from "../core/store.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { schema as makeSchema, options as schemaOptions } from "../schema/index.ts";
import { askReason } from "../ui/dialog.js";
import { toast } from "../ui/toast.js";
import { FieldContext, scoped, cx, uid } from "./util.js";
import { inputFor, GROUP_CONTROLS, INLINE_LABEL } from "./registry.js";

/** Context holding the nearest form (from <Form>, <Wizard>, <EditForm>). */
export const FormContext = { id: Symbol("hm.form"), defaultValue: null };
/** The enclosing form's controller (from useForm). */
export const useFormContext = () => useContext(FormContext);

const isPlain = (v) => v && typeof v === "object" && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
/** Deep copy of plain objects / arrays (Files, Dates and class instances are kept by reference). */
export function clone(v) {
  v = unwrap(v);
  if (!isPlain(v)) return v;
  if (Array.isArray(v)) return v.map(clone);
  const o = {};
  for (const k of Object.keys(v)) o[k] = clone(v[k]);
  return o;
}
/** Structural equality for form values. */
export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if ((a == null || a === "") && (b == null || b === "")) return true;
  if (!isPlain(a) || !isPlain(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
}

const CANCELLED = Object.freeze({ cancelled: true });

/**
 * Form state and behaviour for a schema.
 * @param {object} sch  a schema() or a plain spec
 * @param {object|(() => object)} [initial]
 * @param {{ onSubmit?: (values, form) => any, validateOn?: "blur"|"change"|"submit", onChange?: (name, value, values) => void, onInvalid?: (errors) => void }} [opts]
 */
export function useForm(sch, initial, opts = {}) {
  if (!sch?.fields) sch = makeSchema(sch ?? {});
  const fid = uid("hmf");
  const mode = opts.validateOn ?? "blur";
  const fresh = (v) => ({ ...sch.defaults(), ...clone((typeof v === "function" ? v() : v) ?? {}) });
  let base = fresh(initial);
  const baseVer = signal(0);
  const values = store(clone(base));
  const errors = store({});
  const touched = store({});
  const submitting = signal(false), submitError = signal(null), submitCount = signal(0);
  const els = new Map();

  const setErr = (name, msg) => { if (msg) errors[name] = msg; else if (untrack(() => name in errors)) delete errors[name]; };
  const check = (name) => { const m = untrack(() => sch.validateField(name, values[name], values)); setErr(name, m); return m; };
  const replaceErrors = (map) => batch(() => { for (const k of Object.keys(unwrap(errors))) if (!(k in map)) delete errors[k]; Object.assign(errors, map); });
  const idOf = (name) => `${fid}-${name}`;
  const focus = (name) => {
    const el = els.get(name) ?? globalThis.document?.getElementById(idOf(name));
    el?.focus?.();
    el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  };
  const focusFirst = (map) => { const n = sch.names().find((k) => map[k]) ?? Object.keys(map)[0]; if (n) focus(n); };
  const snapshot = () => untrack(() => clone(values));

  const form = {
    schema: sch, values, errors, touched, id: fid, idOf,
    submitting: () => submitting(), submitError: () => submitError(), submitCount: () => submitCount(),
    dirty: computed(() => { baseVer(); return sch.names().some((n) => !deepEqual(values[n], base[n])); }),
    valid: computed(() => sch.validate(values).ok),
    /** Values the form was loaded / reset / last saved with. */
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
    /** Mark touched and (blur / change modes) validate. */
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
    /** Restore the initial values, or start over from `v` (which becomes the new baseline for `dirty`). */
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
    /** Validate, focus the first invalid field, coerce with schema.parse and call onSubmit(values). */
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
      const out = {};
      for (const f of sch.fields) if (f.name in r.values && sch.isActive(f.name, snap)) out[f.name] = r.values[f.name];
      if (!opts.onSubmit) return out;
      const ver = baseVer.peek();
      submitting.set(true);
      try {
        const res = await opts.onSubmit(out, form);
        if (baseVer.peek() === ver) { base = snap; baseVer.set(ver + 1); }
        return res === undefined ? true : res;
      } catch (err) {
        if (err === CANCELLED || err?.cancelled) return false;
        const fe = err?.fieldErrors;
        if (fe && typeof fe === "object") {
          const known = {}, other = [];
          for (const [k, m] of Object.entries(fe)) (sch.field(k) ? (known[k] = String(m)) : other.push(String(m)));
          batch(() => Object.assign(errors, known));
          if (other.length) submitError.set(other.join(" "));
          focusFirst(known);
        } else submitError.set(err?.message ?? String(err));
        return false;
      } finally { submitting.set(false); }
    },
    /** Props for a plain element: `<input {...form.register("email")} />`. */
    register(name, { type } = {}) {
      return {
        id: idOf(name), name,
        value: () => values[name] ?? "",
        checked: type === "checkbox" ? () => !!values[name] : undefined,
        onInput: (e) => form.set(name, e.target.type === "checkbox" ? e.target.checked : e.target.value),
        onChange: type === "checkbox" ? (e) => form.set(name, e.target.checked) : undefined,
        onBlur: () => form.blur(name),
        "aria-invalid": () => (errors[name] ? "true" : null),
        "aria-describedby": () => (errors[name] ? `${idOf(name)}-error` : null),
        ref: (el) => { els.set(name, el); onCleanup(() => { if (els.get(name) === el) els.delete(name); }); },
      };
    },
    /** A rendered <Field> for a schema field. */
    field: (name, overrides = {}) => h(Field, { ...overrides, form, name }),
  };
  return form;
}

// ------------------------------------------------------------------ Field
const NOT_FORWARDED = new Set(["name", "label", "type", "help", "when", "validate", "default", "column", "format", "hidden", "control", "props",
  "requiredMessage", "pattern", "patternMessage", "span", "readonly", "disabled", "options", "value", "minLength", "section", "variant"]);

function controlFor(form, f, props, ctx) {
  const Comp = inputFor(f);
  if (!Comp) return null;
  const name = f.name;
  const p = { id: ctx.id, name, field: f };
  for (const k of Object.keys(f)) if (!NOT_FORWARDED.has(k)) p[k] = f[k];
  if (f.options) Object.defineProperty(p, "options", { get: () => schemaOptions(f), enumerable: true });
  if (f.type === "text" && f.max != null) p.maxLength = f.maxLength ?? f.max;
  if (["text", "textarea", "password", "email", "url", "phone"].includes(f.type)) { delete p.min; delete p.max; }
  if (f.type === "list") delete p.min;
  Object.assign(p, f.props ?? {}, props.controlProps ?? {});
  Object.defineProperty(p, "value", { get: () => form.values[name], enumerable: true });
  p.setValue = (v) => form.set(name, v);
  p.onBlur = () => form.blur(name);
  Object.defineProperty(p, "disabled", { get: () => !!(props.disabled || f.disabled || form.submitting()), enumerable: true });
  Object.defineProperty(p, "readonly", { get: () => !!(props.readonly || f.readonly || form.readonly?.()), enumerable: true });
  if (INLINE_LABEL.has(Comp)) p.label = props.label ?? f.label;
  return { Comp, el: untrack(() => Comp(p)) };
}

/**
 * Label + control + help + error. With `name` inside a form (or `form` prop) it renders the schema field's input;
 * otherwise wraps its children. Props: name, form, label, help, error, required, inline, compact, class, controlProps.
 */
export function Field(props) {
  return scoped(() => {
    const form = props.form ?? useContext(FormContext);
    const name = props.name;
    const f = form && name ? form.schema.field(name) : null;
    if (form && name && !f) throw new Error(`March forms: field "${name}" is not in the schema.`);
    const id = props.id ?? (form && name ? form.idOf(name) : uid("hm-f"));
    const labelId = `${id}-label`, helpId = `${id}-help`, errId = `${id}-error`;
    const error = () => props.error ?? (form && name ? form.errors[name] : null) ?? null;
    const help = () => props.help ?? f?.help ?? null;
    const label = () => props.label ?? f?.label ?? null;
    const required = () => !!(props.required ?? f?.required);
    const ctx = { id, labelId, invalid: () => !!error(), describedby: () => [help() ? helpId : null, error() ? errId : null].filter(Boolean).join(" ") };
    provide(FieldContext, ctx);
    const built = f ? controlFor(form, f, props, ctx) : null;
    const control = built ? built.el : props.children;
    const group = props.group ?? (built ? GROUP_CONTROLS.has(built.Comp) : false);
    const inlineLabel = built ? INLINE_LABEL.has(built.Comp) : false;
    const labelKids = [() => label(), () => (required() ? h("span", { class: "hm-req", "aria-hidden": "true" }, " *") : null)];
    const labelEl = inlineLabel ? null : group
      ? h("div", { class: "hm-label", id: labelId }, labelKids)
      : h("label", { class: "hm-label", id: labelId, for: id }, labelKids);
    return h("div", {
      class: cx("hm-field", props.inline && "hm-field-inline", props.compact && "hm-field-compact", f?.span && `hm-span-${f.span}`, props.class),
      "class:hm-field-invalid": () => !!error(), "data-field": name ?? null,
    },
    () => (label() != null && labelEl ? labelEl : null),
    h("div", { class: "hm-field-control" }, control,
      () => (help() ? h("div", { class: "hm-help", id: helpId }, help()) : null),
      h("div", { class: "hm-field-error", id: errId, "aria-live": "polite", hidden: () => !error() }, () => error() ?? "")));
  });
}

// ------------------------------------------------------------------ Form
/** Render the active schema fields (`names` or all), honouring `when`, `hidden` and layout. */
export function renderFields(form, names, { layout = "stack", cols = 2 } = {}) {
  const sch = form.schema;
  const list = (names ?? sch.names()).filter((n) => { const f = sch.field(n); return f && !f.hidden && f.type !== "hidden"; });
  return h("div", { class: layout === "grid" ? cx("hm-form-grid", `hm-cols-${cols}`) : "hm-form-stack" }, list.map((n) => {
    const on = computed(() => sch.isActive(n, form.values));
    return () => (on() ? untrack(() => h(Field, { form, name: n })) : null);
  }));
}

/** Submit / cancel bar with the submit error. */
export function FormActions(props) {
  const form = props.form ?? useFormContext();
  const cancel = props.cancel;
  return h("div", { class: cx("hm-form-actions", props.class) },
    () => (form.submitError() ? h("div", { class: "hm-form-error", role: "alert" }, form.submitError()) : null),
    h("div", { class: "hm-form-buttons" },
      props.extra ?? null,
      cancel ? h("button", { type: "button", class: "hm-btn", disabled: () => form.submitting(), onClick: () => (typeof cancel === "function" ? cancel(form) : form.reset()) }, () => props.cancelLabel ?? t`Cancel`) : null,
      h("button", { type: "submit", class: "hm-btn hm-btn-primary", disabled: () => form.submitting() || !!(props.requireDirty && !form.dirty()), "aria-busy": () => (form.submitting() ? "true" : null) },
        () => (form.submitting() ? [h("span", { class: "hm-loading hm-loading-sm", "aria-hidden": "true" }), " ", props.busyLabel ?? t`Saving…`] : props.submitLabel ?? t`Save`))));
}

/** Warn before leaving the page while the form has unsaved changes. */
function guardLeave(form, enabled) {
  effect(() => {
    if (!enabled() || !form.dirty()) return;
    const fn = (e) => { e.preventDefault(); e.returnValue = ""; return ""; };
    globalThis.addEventListener?.("beforeunload", fn);
    onCleanup(() => globalThis.removeEventListener?.("beforeunload", fn));
  });
}

/**
 * Form. Auto-renders every active schema field, or your children (reach the controller with useFormContext()).
 * Props: schema, initial, onSubmit, validateOn, form (an existing useForm), submitLabel, cancel (true = reset, or fn),
 * cancelLabel, layout ("stack" | "grid"), cols, sections [{ title, description, fields }], actions (false hides the bar),
 * confirmLeave, requireDirty, readonly, onReady(form), class.
 */
export function Form(props) {
  return scoped(() => {
    const form = props.form ?? useForm(props.schema, props.initial, { onSubmit: props.onSubmit, validateOn: props.validateOn, onChange: props.onChange });
    if (props.readonly != null && !props.form) form.readonly = () => !!props.readonly;
    provide(FormContext, form);
    props.onReady?.(form);
    guardLeave(form, () => !!props.confirmLeave);
    const custom = props.children;
    const layout = { layout: props.layout ?? "stack", cols: props.cols ?? 2 };
    const body = custom ?? (props.sections
      ? props.sections.map((s) => h("fieldset", { class: "hm-section" },
        s.title ? h("legend", { class: "hm-section-title" }, s.title) : null,
        s.description ? h("p", { class: "hm-section-desc" }, s.description) : null,
        renderFields(form, s.fields, { ...layout, cols: s.cols ?? layout.cols })))
      : renderFields(form, null, layout));
    const noBar = props.actions === false || props.readonly;
    return h("form", {
      class: cx("hm-form", props.class), novalidate: true, "aria-busy": () => (form.submitting() ? "true" : null),
      onSubmit: (e) => { e.preventDefault(); form.submit(); },
      onKeyDown: noBar ? (e) => { if (e.key === "Enter" && !e.defaultPrevented && e.target.tagName === "INPUT" && !["checkbox", "radio", "button", "file"].includes(e.target.type)) { e.preventDefault(); form.submit(); } } : null,
    }, body, noBar ? null : h(FormActions, { form, cancel: props.cancel, cancelLabel: props.cancelLabel, submitLabel: props.submitLabel, requireDirty: props.requireDirty, extra: props.extraActions }));
  });
}

// ------------------------------------------------------------------ EditForm
/**
 * Load → edit → save. Props: schema, load() → Promise<values>, save(values, { reason, changed }) → Promise<any>,
 * reason (min length number or { min, title, message, purposes, danger }), title, description, sections, layout, cols,
 * submitLabel, successMessage, onSaved(result, values), readonly, extra(form) → node, useResult, validateOn,
 * ask (reason prompt, default askReason), notify (default toast).
 */
export function EditForm(props) {
  return scoped(() => {
    const ask = props.ask ?? askReason;
    const notify = props.notify ?? toast;
    const state = signal("loading");
    const loadError = signal(null);
    let seq = 0;
    const form = useForm(props.schema, {}, { onSubmit: save, validateOn: props.validateOn });
    form.readonly = () => !!props.readonly;
    async function load(quiet) {
      const id = ++seq;
      if (!quiet) state.set("loading");
      loadError.set(null);
      try {
        const v = await props.load();
        if (id !== seq) return;
        form.reset(v ?? {});
        state.set("ready");
      } catch (e) {
        if (id !== seq) return;
        loadError.set(e?.message ?? String(e));
        if (!quiet) state.set("error");
      }
    }
    async function save(values) {
      let reason;
      if (props.reason) {
        const r = typeof props.reason === "number" ? { min: props.reason } : props.reason;
        reason = await ask({ title: r.title ?? t`Reason for this change`, message: r.message, min: r.min ?? 10, purposes: r.purposes, danger: r.danger, ok: props.submitLabel ?? t`Save` });
        if (reason == null || reason === "") throw CANCELLED;
      }
      const before = form.schema.parse(form.initial());
      const changed = {};
      for (const k of Object.keys(values)) if (!deepEqual(values[k], before[k])) changed[k] = values[k];
      const res = await props.save(values, { reason, changed });
      if (props.successMessage !== false) notify(props.successMessage ?? t`Saved`, { kind: "success" });
      if (props.useResult && res && typeof res === "object") form.reset(res);
      else if (props.load) await load(true);
      props.onSaved?.(res, values);
      return res;
    }
    provide(FormContext, form);
    load();
    const skeleton = () => h("div", { class: "hm-form-skeleton", role: "status", "aria-label": t`Loading` },
      Array.from({ length: Math.min(6, form.schema.fields.length || 3) }, () => h("div", { class: "hm-skeleton-field" }, h("div", { class: "hm-skeleton hm-skeleton-label" }), h("div", { class: "hm-skeleton hm-skeleton-input" }))));
    return h("section", { class: cx("hm-edit-form", props.class), "aria-busy": () => (state() === "loading" ? "true" : null) },
      props.title || props.description || props.load ? h("header", { class: "hm-edit-head" },
        h("div", null, props.title ? h("h2", { class: "hm-edit-title" }, props.title) : null, props.description ? h("p", { class: "hm-section-desc" }, props.description) : null),
        h("div", { class: "hm-edit-tools" },
          () => (state() === "ready" && form.dirty() ? h("span", { class: "hm-badge hm-dirty" }, t`Unsaved changes`) : null),
          h("button", { type: "button", class: "hm-btn hm-btn-sm", disabled: () => state() === "loading" || form.submitting(), onClick: () => load() }, t`Reload`))) : null,
      () => {
        const s = state();
        if (s === "loading") return skeleton();
        if (s === "error") return h("div", { class: "hm-error", role: "alert" }, h("p", null, loadError()), h("button", { type: "button", class: "hm-btn", onClick: () => load() }, t`Retry`));
        return untrack(() => h(Form, {
          form, sections: props.sections, layout: props.layout, cols: props.cols, submitLabel: props.submitLabel, confirmLeave: props.confirmLeave,
          readonly: reactive(() => props.readonly), cancel: () => form.reset(), cancelLabel: t`Reset`, requireDirty: true,
          extraActions: props.extra ? props.extra(form) : null,
        }));
      });
  });
}
