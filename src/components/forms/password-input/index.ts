// PasswordInput: a password field with a show / hide button.
import "./password-input.css";
import "../../../ui/field.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { textAttrs, inputOf, type TextAttrProps } from "../../../forms/affix.ts";
import { Button } from "../../actions/button/index.ts";

export interface PasswordInputProps extends ControlProps<string>, TextAttrProps {
  /** The show / hide button: `false` removes it; a function draws its content (`(shown) => <Icon of={shown ? eyeOff : eye} />`). */
  toggle?: boolean | ((shown: boolean) => unknown) | undefined;
  /** Texts: `show` / `hide` (the button text), `showPassword` / `hidePassword` (its accessible name). */
  labels?: { show?: unknown; hide?: unknown; showPassword?: string | undefined; hidePassword?: string | undefined } | undefined;
}

/** Password with a show / hide toggle. `autocomplete` defaults to "current-password" (use "new-password" on sign-up). */
export function PasswordInput(props: PasswordInputProps): unknown {
  const [get, set] = model(props, "");
  const show = signal(false);
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), class: "hm-input", type: () => (show() ? "text" : "password"),
    autocomplete: props.autocomplete ?? "current-password", spellcheck: "false", onInput: (e: Event) => set(inputOf(e).value),
  }) as HTMLInputElement;
  syncValue(el, get);
  const draw = typeof props.toggle === "function" ? props.toggle : null;
  return h("span", { class: () => cx("hm-affix hm-password", props.class) }, el,
    // a quiet text button ("Show" / "Hide"), or your own drawing as its icon
    props.toggle === false ? null : h(Button, {
      variant: "ghost", size: "sm", class: cx("hm-password-toggle", draw && "is-own"), "aria-pressed": () => String(show()),
      "aria-label": () => (show() ? props.labels?.hidePassword ?? t`Hide password` : props.labels?.showPassword ?? t`Show password`),
      disabled: () => !!props.disabled, onClick: () => show.set(!show.peek()),
      ...(draw ? { icon: () => draw(show()) } : { children: () => (show() ? props.labels?.hide ?? t`Hide` : props.labels?.show ?? t`Show`) }),
    }));
}
