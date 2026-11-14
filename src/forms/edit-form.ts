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
import { errorText } from "../ui/format.ts";
import { Button } from "../components/actions/button/index.ts";
import { Badge } from "../components/data/badge/index.ts";
import { Skeleton } from "../components/feedback/skeleton/index.ts";
import { ErrorBox } from "../components/feedback/error-box/index.ts";
import { PanelHeader } from "../components/layout/panel-header/index.ts";

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

/** Only the fields of `values` that differ (deeply) from `before`: what a save sends as "changed". */
export function changedFields<V extends Values>(values: V, before: Values): Partial<V> {
  const changed: Values = {};
  for (const k of Object.keys(values)) if (!deepEqual(values[k], before[k])) changed[k] = values[k];
  return changed as Partial<V>;
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
        loadError.set(errorText(e));
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
      const res = await props.save(values, { reason: reason ?? undefined, changed: changedFields(values, form.schema.parse(form.initial())) });
      if (props.successMessage !== false) notify(props.successMessage ?? t`Saved`, { kind: "success" });
      if (props.useResult && res && typeof res === "object") form.reset(res as Values);
      else if (!!props.load) await load(true);
      props.onSaved?.(res, values);
      return res;
    }
    provide(FormContext, form);
    load();
    // one label line + one input block per field (at most six)
    const skeleton = () => h("div", { class: "m-form-skeleton", role: "status", "aria-label": t`Loading` },
      Array.from({ length: Math.min(6, form.schema.fields.length || 3) }, () => h("div", { class: "m-skeleton-field" }, h(Skeleton, { block: true, class: "m-skeleton-label" }), h(Skeleton, { block: true, class: "m-skeleton-input" }))));
    return h("section", { class: cx("m-edit-form", props.class), "aria-busy": () => (state() === "loading" ? "true" : null) },
      props.title || props.description || !!props.load ? h(PanelHeader, {
        class: "m-edit-head", size: "lg", align: "start", title: props.title || undefined, titleAs: "h2", subtitle: props.description || undefined,
        actions: [
          () => (state() === "ready" && form.dirty() ? h(Badge, { tone: "warn" }, t`Unsaved changes`) : null),
          h(Button, { size: "sm", disabled: () => state() === "loading" || form.submitting(), onClick: () => load() }, t`Reload`),
        ],
      }) : null,
      () => {
        const s = state();
        if (s === "loading") return skeleton();
        if (s === "error") return h(ErrorBox, { message: loadError, retry: () => load() });
        return untrack(() => h(Form, {
          form, sections: props.sections, layout: props.layout, cols: props.cols, submitLabel: props.submitLabel, confirmLeave: props.confirmLeave,
          readonly: live(() => props.readonly), cancel: () => form.reset(), cancelLabel: t`Reset`, requireDirty: true,
          extraActions: props.extra ? props.extra(form) : null,
        }));
      });
  });
}
