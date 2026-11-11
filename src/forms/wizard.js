// Wizard: one form split into steps. Each step validates its own fields (and an optional validate fn) before Next.
import { signal, computed, untrack, provide } from "../core/reactive.js";
import { h } from "../dom/h.js";
import { t } from "../core/i18n.ts";
import { schema as makeSchema } from "../schema/index.js";
import { scoped, cx, uid } from "./util.js";
import { useForm, renderFields, FormContext } from "./form.js";

const specOf = (s) => Object.fromEntries(s.fields.map((f) => [f.name, f]));

/**
 * Props: steps [{ title, description, fields?: [names], schema?: schema(), validate?(values) → {name: msg} | string | null,
 * render?(form) → node }], schema (optional when every step has its own), initial, onSubmit(values), submitLabel, layout,
 * cols, onStep(index), form (an existing useForm).
 */
export function Wizard(props) {
  return scoped(() => {
    const steps = props.steps;
    const sch = props.schema ?? makeSchema(Object.assign({}, ...steps.map((s) => (s.schema ? specOf(s.schema) : {}))));
    const form = props.form ?? useForm(sch, props.initial, { onSubmit: props.onSubmit, validateOn: props.validateOn ?? "blur" });
    provide(FormContext, form);
    const index = signal(0);
    const stepError = signal(null);
    const id = uid("hm-wiz");
    const namesOf = (s) => s.fields ?? s.schema?.names() ?? [];
    const last = () => index() === steps.length - 1;
    /** Validate one step; returns true when it may be left. */
    const check = (i) => {
      const s = steps[i];
      const vals = untrack(() => form.values);
      const errs = {};
      for (const n of namesOf(s)) { const m = untrack(() => form.schema.validateField(n, vals[n], vals)); if (m) errs[n] = m; }
      const extra = untrack(() => s.validate?.(vals));
      let msg = null;
      if (typeof extra === "string") msg = extra;
      else if (extra) Object.assign(errs, extra);
      for (const n of namesOf(s)) { form.touched[n] = true; if (!errs[n] && form.errors[n]) delete form.errors[n]; }
      stepError.set(msg);
      if (Object.keys(errs).length) { form.setErrors(errs); return false; }
      return !msg;
    };
    const go = (i) => { index.set(i); stepError.set(null); props.onStep?.(i); globalThis.document?.getElementById(`${id}-title`)?.focus?.(); };
    const next = () => { if (check(index.peek())) { if (index.peek() < steps.length - 1) go(index.peek() + 1); else form.submit(); } };
    const back = () => { if (index.peek() > 0) go(index.peek() - 1); };
    const api = { index: () => index(), next, back, go: (i) => { if (i < index.peek() || [...Array(i).keys()].every(check)) go(i); } };
    props.onReady?.(form, api);
    const current = computed(() => index());
    return h("form", {
      class: cx("hm-wizard", props.class), novalidate: true, "aria-busy": () => (form.submitting() ? "true" : null),
      onSubmit: (e) => { e.preventDefault(); next(); },
    },
    h("ol", { class: "hm-steps", "aria-label": t`Progress` }, steps.map((s, i) => h("li", {
      class: "hm-step", "class:hm-step-done": () => i < index(), "class:hm-step-current": () => i === index(), "aria-current": () => (i === index() ? "step" : null),
    }, h("button", { type: "button", class: "hm-step-btn", disabled: () => i > index(), onClick: () => api.go(i) },
      h("span", { class: "hm-step-num", "aria-hidden": "true" }, String(i + 1)), h("span", { class: "hm-step-title" }, s.title ?? t`Step ${i + 1}`))))),
    h("div", { class: "hm-progress hm-wizard-progress", role: "progressbar", "aria-valuemin": "1", "aria-valuemax": String(steps.length), "aria-valuenow": () => String(index() + 1), "aria-valuetext": () => t`Step ${index() + 1} of ${steps.length}` },
      h("div", { class: "hm-progress-bar", style: () => ({ width: `${((index() + 1) / steps.length) * 100}%` }) })),
    () => {
      const i = current();
      const s = steps[i];
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

