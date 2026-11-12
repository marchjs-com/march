// FieldFrame: the frame of a form field — label, control, help and error — and the field context (id, describedby,
// invalid) the control inside reads. Field (form.ts) draws its frame with fieldFrame(); a labelled control that does not
// need the form engine (a node editor's fields, a settings panel) uses <FieldFrame> and stays light.
import "../ui/field.css";
import { provide } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { FieldContext, scoped, cx, uid, type FieldCtx, type ClassProp } from "./util.ts";
import { colorAttr, type ColorToken } from "../theme/colors.ts";

export interface FrameOptions {
  id: string;
  label: () => unknown;
  help: () => unknown;
  error: () => string | null;
  required: () => boolean;
  color?: ColorToken | undefined;
  inline?: boolean | undefined;
  compact?: boolean | undefined;
  class?: ClassProp;
  /** data-field (a schema field's name). */
  name?: string | null | undefined;
  /** Grid span class (hm-span-N). */
  span?: unknown;
}
/** What the control callback returns: the control, and whether it is a group (radio / checkbox list) or labels itself. */
export interface FrameControl { el: unknown; group?: boolean | undefined; inlineLabel?: boolean | undefined }

/** Provide the field context, build the control with it, and wrap it in the label / help / error frame. */
export function fieldFrame(o: FrameOptions, control: (ctx: FieldCtx) => FrameControl): Element {
  const id = o.id, labelId = `${id}-label`, helpId = `${id}-help`, errId = `${id}-error`;
  const ctx: FieldCtx = { id, labelId, invalid: () => !!o.error(), describedby: () => [o.help() ? helpId : null, o.error() ? errId : null].filter(Boolean).join(" ") };
  provide(FieldContext, ctx);
  const built = control(ctx);
  const labelKids = [() => o.label(), () => (o.required() ? h("span", { class: "hm-req", "aria-hidden": "true" }, " *") : null)];
  const labelEl = built.inlineLabel ? null : built.group
    ? h("div", { class: "hm-label", id: labelId }, labelKids)
    : h("label", { class: "hm-label", id: labelId, for: id }, labelKids);
  return h("div", { "data-hm-color": colorAttr(o.color),
    class: cx("hm-field", o.inline && "hm-field-inline", o.compact && "hm-field-compact", o.span ? `hm-span-${o.span}` : false, o.class),
    "class:hm-field-invalid": () => !!o.error(), "data-field": o.name ?? null,
  },
  () => (o.label() != null && labelEl ? labelEl : null),
  h("div", { class: "hm-field-control" }, built.el,
    () => (o.help() ? h("div", { class: "hm-help", id: helpId }, o.help()) : null),
    h("div", { class: "hm-field-error", id: errId, "aria-live": "polite", hidden: () => !o.error() }, () => o.error() ?? ""))) as Element;
}

export interface FieldFrameProps {
  /** Control id (default: a fresh one); the control reads it from the field context. */
  id?: string | undefined;
  label?: unknown;
  help?: unknown;
  error?: string | null | undefined;
  required?: boolean | null | undefined;
  /** The children are a group (radio / checkbox list): the label names it instead of pointing at one control. */
  group?: boolean | undefined;
  inline?: boolean | undefined;
  compact?: boolean | undefined;
  color?: ColorToken | undefined;
  class?: ClassProp;
  children?: unknown;
}
/** Label + control + help + error without the form engine: `<FieldFrame label="Name"><TextInput bind:value={$n} /></FieldFrame>` */
export function FieldFrame(props: FieldFrameProps): unknown {
  return scoped(() => fieldFrame({
    id: props.id ?? uid("hm-f"), label: () => props.label ?? null, help: () => props.help ?? null, error: () => props.error ?? null, required: () => !!props.required,
    color: props.color, inline: props.inline, compact: props.compact, class: props.class,
  }, () => ({ el: props.children, group: props.group })));
}
