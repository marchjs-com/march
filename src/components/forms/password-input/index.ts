// PasswordInput: a password field with a show / hide button.
import "./password-input.css";
import "../../../ui/field.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model, ctl, cx, syncValue, type ControlProps } from "../../../forms/util.ts";
import { textAttrs, inputOf, type TextAttrProps } from "../../../forms/affix.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { eye } from "../../../icons/glyphs/eye.ts";
import { eyeOff } from "../../../icons/glyphs/eyeOff.ts";

export interface PasswordInputProps extends ControlProps<string>, TextAttrProps {
  /**
   * The show / hide button: an eye icon (default; its name and hint say what it does), `"text"` a text button
   * ("Show" / "Hide"), a function draws its content (`(shown) => …`), `false` removes it. Given `labels.show` / `hide`
   * without a `toggle`, the button shows those texts.
   * @tr Göster / gizle düğmesi: göz ikonu (varsayılan; adı ve ipucu ne yaptığını söyler), `"text"` metin düğmesi ("Show" / "Hide"), fonksiyon içeriğini çizer (`(shown) => …`), `false` kaldırır. `toggle` verilmeden `labels.show` / `hide` verilirse düğme o metinleri gösterir.
   */
  toggle?: boolean | "icon" | "text" | ((shown: boolean) => unknown) | undefined;
  /** Texts: `show` / `hide` (the text button's words), `showPassword` / `hidePassword` (the button's accessible name and hint). @tr Metinler: `show` / `hide` (metin düğmesinin sözleri), `showPassword` / `hidePassword` (düğmenin erişilebilir adı ve ipucu). */
  labels?: { show?: unknown; hide?: unknown; showPassword?: string | undefined; hidePassword?: string | undefined } | undefined;
  /** Called when the password is shown (`true`) or hidden again (`false`). @tr Parola gösterilince (`true`) ya da yeniden gizlenince (`false`) çağrılır. */
  onToggle?: ((shown: boolean) => void) | undefined;
}

/** Password with a show / hide toggle. `autocomplete` defaults to "current-password" (use "new-password" on sign-up). */
export function PasswordInput(props: PasswordInputProps): unknown {
  const [get, set] = model(props, "");
  const show = signal(false);
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), class: "m-input", type: () => (show() ? "text" : "password"),
    autocomplete: props.autocomplete ?? "current-password", spellcheck: "false", onInput: (e: Event) => set(inputOf(e).value),
  }) as HTMLInputElement;
  syncValue(el, get);
  const tg = props.toggle, draw = typeof tg === "function" ? tg : null;
  const text = tg === "text" || ((tg === undefined || tg === true) && (props.labels?.show != null || props.labels?.hide != null));
  const name = (): string => (show() ? props.labels?.hidePassword ?? t`Hide password` : props.labels?.showPassword ?? t`Show password`);
  const flip = (): void => { const v = !show.peek(); show.set(v); props.onToggle?.(v); };
  return h("span", { class: () => cx("m-affix m-password", props.class) }, el,
    tg === false ? null
      // the words ("Show" / "Hide"), or your own drawing as its icon
      : text || draw ? h(Button, {
        variant: "ghost", size: "sm", class: cx("m-password-toggle", draw && "is-own"), "aria-pressed": () => String(show()),
        "aria-label": name, disabled: () => !!props.disabled, onClick: flip,
        ...(draw ? { icon: () => draw(show()) } : { children: () => (show() ? props.labels?.hide ?? t`Hide` : props.labels?.show ?? t`Show`) }),
      })
      // an eye (crossed out while it shows): narrow, the same in every language
      : h(IconButton, {
        class: "m-password-toggle is-icon", size: "sm", icon: () => (show() ? eyeOff : eye), label: name, pressed: () => show(),
        disabled: () => !!props.disabled, onClick: flip,
      }));
}
