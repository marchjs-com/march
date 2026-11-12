// Wizard: one form split into steps. Each step validates its own fields (and an optional validate fn) before Next.
import "./wizard.css";
import "../ui/button.css";
import { signal, computed, untrack, provide } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { schema as makeSchema, type Schema, type SchemaSpec, type Values } from "../schema/index.ts";
import { scoped, cx, uid, type ClassProp } from "./util.ts";
import { useForm, renderFields, FormContext, type FormController, type FieldName, type ValidateOn } from "./form.ts";
import { colorAttr, type ColorToken } from "../theme/colors.ts";
import { Progress } from "../ui/progress.ts";

const specOf = (s: Schema): SchemaSpec => Object.fromEntries(s.fields.map((f) => [f.name, f]));

/** One step of a <Wizard>. */
export interface WizardStep<V = Values> {
  title?: string | undefined;
  description?: unknown;
  /** Field names shown and validated in this step (default: the step schema's fields). */
  fields?: readonly FieldName<V>[] | undefined;
  /** A schema for this step (merged into the wizard's schema when `schema` is not given). */
  schema?: Schema | undefined;
  /** Extra check: errors by field name, a message, or null. */
  validate?: ((values: V) => Partial<Record<FieldName<V>, string>> | string | null | undefined) | undefined;
  /** Custom body instead of the auto-rendered fields. */
  render?: ((form: FormController<V>) => unknown) | undefined;
}

/** Navigation handed to onReady. */
export interface WizardApi { index: () => number; next: () => void; back: () => void; go: (i: number) => void }

/** Props of <Wizard>. */
export interface WizardProps<V = Values> {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  steps: readonly WizardStep<V>[];
  /** Optional when every step has its own schema. */
  schema?: Schema<V> | undefined;
  initial?: Partial<V> | (() => Partial<V>) | undefined;
  onSubmit?: ((values: V, form: FormController<V>) => unknown) | undefined;
  submitLabel?: unknown;
  layout?: "stack" | "grid" | undefined;
  cols?: number | undefined;
  validateOn?: ValidateOn | undefined;
  onStep?: ((index: number) => void) | undefined;
  onReady?: ((form: FormController<V>, api: WizardApi) => void) | undefined;
  /** An existing useForm() controller. */
  form?: FormController<V> | undefined;
  class?: ClassProp;
}

/**
 * Props: steps [{ title, description, fields?: [names], schema?: schema(), validate?(values) → {name: msg} | string | null,
 * render?(form) → node }], schema (optional when every step has its own), initial, onSubmit(values), submitLabel, layout,
 * cols, onStep(index), form (an existing useForm).
 */
export function Wizard<V = Values>(props: WizardProps<V>): unknown;
export function Wizard(props: WizardProps): unknown {
  return scoped(() => {
    const steps = props.steps;
    const sch = props.schema ?? makeSchema(Object.assign({}, ...steps.map((s) => (s.schema ? specOf(s.schema) : {}))) as SchemaSpec);
    const form = props.form ?? useForm(sch, props.initial, { onSubmit: props.onSubmit, validateOn: props.validateOn ?? "blur" });
    provide(FormContext, form);
    const index = signal(0);
    const stepError = signal<string | null>(null);
    const id = uid("hm-wiz");
    const namesOf = (s: WizardStep) => s.fields ?? s.schema?.names() ?? [];
    const last = () => index() === steps.length - 1;
    /** Validate one step; returns true when it may be left. */
    const check = (i: number) => {
      const s = steps[i]!;
      const vals = untrack(() => form.values);
      const errs: Record<string, string> = {};
      for (const n of namesOf(s)) { const m = untrack(() => form.schema.validateField(n, vals[n], vals)); if (m) errs[n] = m; }
      const extra = untrack(() => s.validate?.(vals));
      let msg: string | null = null;
      if (typeof extra === "string") msg = extra;
      else if (extra) Object.assign(errs, extra);
      for (const n of namesOf(s)) { form.touched[n] = true; if (!errs[n] && form.errors[n]) delete form.errors[n]; }
      stepError.set(msg);
      if (Object.keys(errs).length) { form.setErrors(errs); return false; }
      return !msg;
    };
    const go = (i: number) => { index.set(i); stepError.set(null); props.onStep?.(i); globalThis.document?.getElementById(`${id}-title`)?.focus?.(); };
    const next = () => { if (check(index.peek())) { if (index.peek() < steps.length - 1) go(index.peek() + 1); else form.submit(); } };
    const back = () => { if (index.peek() > 0) go(index.peek() - 1); };
    const api: WizardApi = { index: () => index(), next, back, go: (i) => { if (i < index.peek() || [...Array(i).keys()].every(check)) go(i); } };
    props.onReady?.(form, api);
    const current = computed(() => index());
    return h("form", { "data-hm-color": colorAttr(props.color),
      class: cx("hm-wizard", props.class), novalidate: true, "aria-busy": () => (form.submitting() ? "true" : null),
      onSubmit: (e: Event) => { e.preventDefault(); next(); },
    },
    h("ol", { class: "hm-steps", "aria-label": t`Progress` }, steps.map((s, i) => h("li", {
      class: "hm-step", "class:hm-step-done": () => i < index(), "class:hm-step-current": () => i === index(), "aria-current": () => (i === index() ? "step" : null),
    }, h("button", { type: "button", class: "hm-step-btn", disabled: () => i > index(), onClick: () => api.go(i) },
      h("span", { class: "hm-step-num", "aria-hidden": "true" }, String(i + 1)), h("span", { class: "hm-step-title" }, s.title ?? t`Step ${i + 1}`))))),
    // the Progress component (its own CSS travels with it; the old .hm-progress markup was only styled by file.css)
    h(Progress, { class: "hm-wizard-progress", value: () => index() + 1, max: steps.length, size: "sm", label: () => t`Step ${index() + 1} of ${steps.length}` }),
    () => {
      const i = current();
      const s = steps[i]!;
      return untrack(() => h("section", { class: "hm-wizard-step", "aria-labelledby": `${id}-title` },
        h("h3", { class: "hm-wizard-title", id: `${id}-title`, tabindex: "-1" }, s.title ?? t`Step ${i + 1}`),
        s.description ? h("p", { class: "hm-section-desc" }, s.description) : null,
        s.render ? s.render(form) : renderFields(form, namesOf(s), { layout: props.layout, cols: props.cols })));
    },
    () => (stepError() ? h("div", { class: "hm-form-error", role: "alert" }, stepError()) : null),
    () => (form.submitError() ? h("div", { class: "hm-form-error", role: "alert" }, form.submitError()) : null),
    h("div", { class: "hm-form-buttons hm-wizard-nav" },
      h("span", { class: "hm-wizard-count" }, () => t`Step ${index() + 1} of ${steps.length}`),
      h("button", { type: "button", class: "hm-btn", disabled: () => index() === 0 || form.submitting(), onClick: back }, t`Back`),
      h("button", { type: "submit", class: "hm-btn hm-btn-primary", disabled: () => form.submitting() }, () => (last() ? props.submitLabel ?? t`Finish` : t`Next`))));
  });
}
