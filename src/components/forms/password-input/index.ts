// PasswordInput: a password field with a show / hide button.
import "./password-input.css";
import "../../../ui/field.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { textAttrs, inputOf, type TextAttrProps } from "../../../forms/affix.ts";

export interface PasswordInputProps extends ControlProps<string>, TextAttrProps {}

/** Password with a show / hide toggle. `autocomplete` defaults to "current-password" (use "new-password" on sign-up). */
export function PasswordInput(props: PasswordInputProps): unknown {
  const [get, set] = model(props, "");
  const show = signal(false);
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), class: "hm-input", type: () => (show() ? "text" : "password"),
    autocomplete: props.autocomplete ?? "current-password", spellcheck: "false", onInput: (e: Event) => set(inputOf(e).value),
  }) as HTMLInputElement;
  syncValue(el, get);
  return h("span", { class: cx("hm-affix hm-password", props.class) }, el,
    h("button", { type: "button", class: "hm-affix-btn", "aria-pressed": () => String(show()), "aria-label": () => (show() ? t`Hide password` : t`Show password`),
      disabled: () => !!props.disabled, onClick: () => show.set(!show.peek()) }, () => (show() ? t`Hide` : t`Show`)));
}
