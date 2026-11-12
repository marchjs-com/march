// <Field>: label + control + help + error. Kept apart from the form engine and the input registry: a Field that wraps
// its own control (the common case in pages and playgrounds) costs only this module. A Field bound to a schema field
// (`name`) lives in a form; form.ts installs the builder that picks the field's input then.
import "../ui/field.css";
import { provide, useContext } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import type { Field as SchemaField } from "../schema/index.ts";
import { FieldContext, scoped, cx, uid, type FieldCtx, type ClassProp } from "./util.ts";
import { colorAttr, type ColorToken } from "../theme/colors.ts";
import type { FormController, FieldName } from "./form.ts";
import type { Values } from "../schema/index.ts";

/** The enclosing form (provided by useForm's <Form>, a wizard step…). */
export const FormContext: { id: symbol; defaultValue: FormController | null } = { id: Symbol("hm.form"), defaultValue: null };

/** A schema field's rendered control, and how its label is drawn. */
export interface BuiltControl { el: unknown; group: boolean; inlineLabel: boolean }
type ControlBuilder = (form: FormController, f: SchemaField, props: FieldProps, ctx: FieldCtx) => BuiltControl | null;
let buildControl: ControlBuilder | null = null;
/** Installed by form.ts (a form exists before any schema-bound Field renders). */
export const setControlBuilder = (fn: ControlBuilder): void => { buildControl = fn; };

/** Props of <Field>. */
export interface FieldProps<V = Values> {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  /** A schema field of the enclosing (or `form`) form; its control is rendered. Without it, the children are wrapped. */
  name?: FieldName<V> | undefined;
  form?: FormController<V> | null | undefined;
  id?: string | undefined;
  label?: unknown;
  help?: unknown;
  error?: string | null | undefined;
  required?: boolean | null | undefined;
  inline?: boolean | undefined;
  compact?: boolean | undefined;
  /** Label as a group label (div) instead of <label for>. */
  group?: boolean | undefined;
  disabled?: boolean | undefined;
  readonly?: boolean | undefined;
  class?: ClassProp;
  /** Extra props for the rendered control. */
  controlProps?: Record<string, unknown> | undefined;
  children?: unknown;
}

/**
 * Label + control + help + error. With `name` inside a form (or `form` prop) it renders the schema field's input;
 * otherwise wraps its children. Props: name, form, label, help, error, required, inline, compact, class, controlProps.
 */
export function Field<V = Values>(props: FieldProps<V>): unknown;
export function Field(props: FieldProps): unknown {
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
    const ctx: FieldCtx = { id, labelId, invalid: () => !!error(), describedby: () => [help() ? helpId : null, error() ? errId : null].filter(Boolean).join(" ") };
    provide(FieldContext, ctx);
    const built = f && form && buildControl ? buildControl(form, f, props, ctx) : null;
    const control = built ? built.el : props.children;
    const group = props.group ?? (built ? built.group : false);
    const inlineLabel = built ? built.inlineLabel : false;
    const labelKids = [() => label(), () => (required() ? h("span", { class: "hm-req", "aria-hidden": "true" }, " *") : null)];
    const labelEl = inlineLabel ? null : group
      ? h("div", { class: "hm-label", id: labelId }, labelKids)
      : h("label", { class: "hm-label", id: labelId, for: id }, labelKids);
    return h("div", { "data-hm-color": () => colorAttr(props.color),
      class: cx("hm-field", props.inline && "hm-field-inline", props.compact && "hm-field-compact", f?.["span"] ? `hm-span-${f["span"]}` : false, props.class),
      "class:hm-field-invalid": () => !!error(), "data-field": name ?? null,
    },
    () => (label() != null && labelEl ? labelEl : null),
    h("div", { class: "hm-field-control" }, control,
      () => (help() ? h("div", { class: "hm-help", id: helpId }, help()) : null),
      h("div", { class: "hm-field-error", id: errId, "aria-live": "polite", hidden: () => !error() }, () => error() ?? "")));
  });
}

