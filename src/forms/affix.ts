// Shared parts of the text-like inputs (TextInput, Textarea, PasswordInput, PhoneInput, NumberInput …): prefix / suffix
// wrapping and the text attributes. Not a component: the component folders in src/components/forms import it.
import { h } from "../dom/h.ts";
import { cx, type ClassProp } from "./util.ts";

/** prefix / suffix text around a control. */
export interface AffixProps { prefix?: unknown; suffix?: unknown; class?: ClassProp }

/** Wrap a control with prefix / suffix text when given. */
export function affix(props: AffixProps, el: Node): unknown {
  if (props.prefix == null && props.suffix == null) return el;
  const part = (k: "prefix" | "suffix") => () => (props[k] != null ? h("span", { class: `m-affix-text m-affix-${k}` }, props[k]) : null);
  return h("span", { class: cx("m-affix", props.class) }, part("prefix"), el, part("suffix"));
}

/** Text attributes shared by the text-like inputs. */
export interface TextAttrProps {
  placeholder?: string | null | undefined;
  readonly?: boolean | null | undefined;
  autocomplete?: string | undefined;
  inputmode?: string | undefined;
  maxLength?: number | undefined;
  maxlength?: number | undefined;
  minLength?: number | undefined;
  minlength?: number | undefined;
  spellcheck?: string | boolean | undefined;
  /** Focus this field when it appears. */
  autofocus?: boolean | undefined;
}

/** The text attributes as h() props (reactive placeholder / readonly). */
export const textAttrs = (props: TextAttrProps) => ({
  placeholder: () => props.placeholder ?? null,
  readonly: () => !!props.readonly,
  autocomplete: props.autocomplete,
  inputmode: props.inputmode,
  autofocus: props.autofocus ? true : null,
  maxlength: props.maxLength ?? props.maxlength,
  minlength: props.minLength ?? props.minlength,
  spellcheck: props.spellcheck,
});

/** The input element of an input event. */
export const inputOf = (e: Event) => e.target as HTMLInputElement;
