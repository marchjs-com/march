// EditForm (hadi-march/forms): load → edit → save with a reason prompt and a success notice. Its own module so the
// dialog and toast it uses by default reach only the apps that use it (useForm, Form and Wizard stay without them).
import { signal, untrack, provide } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import type { Schema, Values } from "../schema/index.ts";
import { askReason } from "../ui/dialog.ts";
import { toast } from "../ui/toast.ts";
import { scoped, cx, live, type ClassProp } from "./util.ts";
import { FormContext } from "./field.ts";
import { useForm, Form, deepEqual, CANCELLED, type FormController, type FormSection, type FieldsLayout, type ValidateOn } from "./form.ts";

/** A reason from the reason prompt: the text, or `{ category, text }` when purposes are offered. */
export type ReasonValue = string | { category: string; text: string };
/** Reason prompt settings of <EditForm reason>. */
export interface ReasonOptions {
  /** Minimum length (10). */
  min?: number | undefined;
  title?: string | undefined;
  message?: unknown;
  purposes?: readonly { value: string; label: unknown }[] | undefined;
  danger?: boolean | undefined;
}
/** What the reason prompt (`ask`) is called with. */
export interface ReasonPrompt { title: string; message: unknown; min: number; purposes: ReasonOptions["purposes"]; danger: boolean | undefined; ok: unknown }
/** Second argument of EditForm's save(). */
export interface SaveContext<V> {
  reason?: ReasonValue | undefined;
  /** Only the fields that differ from the loaded values. */
  changed: Partial<V>;
}

/** Props of <EditForm>. */
export interface EditFormProps<V = Values> extends FieldsLayout {
  schema: Schema<V>;
  load: () => Promise<Partial<V> | null | undefined>;
  save: (values: V, ctx: SaveContext<V>) => unknown;
  /** Ask for a reason before saving: a minimum length or prompt settings. */
  reason?: number | ReasonOptions | false | null | undefined;
  title?: unknown;
  description?: unknown;
  sections?: readonly FormSection<V>[] | null | undefined;
  submitLabel?: string | undefined;
  /** false = no toast. */
  successMessage?: string | false | undefined;
  onSaved?: ((result: unknown, values: V) => void) | undefined;
  readonly?: boolean | null | undefined;
  /** Extra buttons in the action bar. */
  extra?: ((form: FormController<V>) => unknown) | undefined;
  /** Reset the form from save()'s result instead of reloading. */
  useResult?: boolean | undefined;
  validateOn?: ValidateOn | undefined;
  confirmLeave?: boolean | undefined;
  /** Reason prompt (default askReason). */
  ask?: ((o: ReasonPrompt) => Promise<ReasonValue | null | undefined> | ReasonValue | null | undefined) | undefined;
  /** Success notice (default toast). */
  notify?: ((message: string, opts: { kind: "success" }) => unknown) | undefined;
  class?: ClassProp;
}

/**
 * Load → edit → save. Props: schema, load() → Promise<values>, save(values, { reason, changed }) → Promise<any>,
 * reason (min length number or { min, title, message, purposes, danger }), title, description, sections, layout, cols,
 * submitLabel, successMessage, onSaved(result, values), readonly, extra(form) → node, useResult, validateOn,
 * ask (reason prompt, default askReason), notify (default toast).
 */
export function EditForm<V = Values>(props: EditFormProps<V>): unknown;
export function EditForm(props: EditFormProps): unknown {
  return scoped(() => {
    const ask = props.ask ?? (askReason as unknown as NonNullable<EditFormProps["ask"]>);
    const notify = props.notify ?? (toast as unknown as NonNullable<EditFormProps["notify"]>);
    const state = signal<"loading" | "error" | "ready">("loading");
    const loadError = signal<string | null>(null);
    let seq = 0;
    const form = useForm(props.schema, {}, { onSubmit: save, validateOn: props.validateOn });
    form.readonly = () => !!props.readonly;
    async function load(quiet?: boolean) {
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
        loadError.set((e as Error | null)?.message ?? String(e));
        if (!quiet) state.set("error");
      }
    }
    async function save(values: Values) {
      let reason: ReasonValue | null | undefined;
      if (props.reason) {
        const r = typeof props.reason === "number" ? { min: props.reason } as ReasonOptions : props.reason;
        reason = await ask({ title: r.title ?? t`Reason for this change`, message: r.message, min: r.min ?? 10, purposes: r.purposes, danger: r.danger, ok: props.submitLabel ?? t`Save` });
        if (reason == null || reason === "") throw CANCELLED;
      }
      const before = form.schema.parse(form.initial());
      const changed: Values = {};
      for (const k of Object.keys(values)) if (!deepEqual(values[k], before[k])) changed[k] = values[k];
      const res = await props.save(values, { reason: reason ?? undefined, changed });
      if (props.successMessage !== false) notify(props.successMessage ?? t`Saved`, { kind: "success" });
      if (props.useResult && res && typeof res === "object") form.reset(res as Values);
      else if (!!props.load) await load(true);
      props.onSaved?.(res, values);
      return res;
    }
    provide(FormContext, form);
    load();
    const skeleton = () => h("div", { class: "hm-form-skeleton", role: "status", "aria-label": t`Loading` },
      Array.from({ length: Math.min(6, form.schema.fields.length || 3) }, () => h("div", { class: "hm-skeleton-field" }, h("div", { class: "hm-skeleton hm-skeleton-label" }), h("div", { class: "hm-skeleton hm-skeleton-input" }))));
    return h("section", { class: cx("hm-edit-form", props.class), "aria-busy": () => (state() === "loading" ? "true" : null) },
      props.title || props.description || !!props.load ? h("header", { class: "hm-edit-head" },
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
          readonly: live(() => props.readonly), cancel: () => form.reset(), cancelLabel: t`Reset`, requireDirty: true,
          extraActions: props.extra ? props.extra(form) : null,
        }));
      });
  });
}
