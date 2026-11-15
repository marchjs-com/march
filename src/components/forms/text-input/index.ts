// TextInput (with EmailInput and UrlInput): single-line text that works standalone or inside a <Field>/<Form>.
import "./text-input.css";
import "../../../ui/field.css";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, uid, val, extend, syncValue, type ControlProps } from "../../../forms/util.ts";
import type { MaybeFn } from "../../../ui/util.ts";
import { affix, textAttrs, inputOf, type AffixProps, type TextAttrProps } from "../../../forms/affix.ts";
export { affix, type AffixProps, type TextAttrProps };

export interface TextInputProps extends ControlProps<string>, TextAttrProps, AffixProps {
  /** Input type (default "text"). @tr Girdi türü (varsayılan "text"). */
  type?: string | undefined;
  /** Rewrites the typed text before it becomes the value (e.g. `(v) => v.trim()`). @tr Yazılan metni değer olmadan önce dönüştürür (ör. `(v) => v.trim()`). */
  transform?: ((v: string) => string) | undefined;
  /** Key handler of the input. @tr Girdinin tuş işleyicisi. */
  onKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  /** Paste handler (e.g. split pasted lines into items; `preventDefault()` keeps the text out of the input). @tr Yapıştırma işleyicisi (ör. yapıştırılan satırları öğelere bölmek; `preventDefault()` metni girdiye almaz). */
  onPaste?: ((e: ClipboardEvent) => void) | undefined;
  /**
   * An error text of the input itself, for an input without a `<Field>`: while it has text the input is invalid and the
   * text is shown under it (`role="alert"`, linked with `aria-describedby`). Pass `null` / `""` while there is no error.
   * @tr `<Field>` olmadan kullanılan girdinin kendi hata metni: metin varken girdi geçersizdir ve metin altında gösterilir (`role="alert"`, `aria-describedby` ile bağlı). Hata yokken `null` / `""` verin.
   */
  error?: MaybeFn<string | null | undefined>;
  /** With `error`: the error line keeps its height while there is no error, so nothing moves when one appears. @tr `error` ile: hata yokken de hata satırı yerini korur, hata çıkınca hiçbir şey kaymaz. */
  errorSpace?: boolean | undefined;
  /** Called with the input element. @tr Girdi öğesiyle çağrılır. */
  ref?: ((el: HTMLInputElement) => void) | undefined;
}

/** Single-line text. Props: type, placeholder, readonly, autocomplete, inputmode, maxLength, prefix, suffix, transform(v), onPaste, error, errorSpace. */
export function TextInput(props: TextInputProps): unknown {
  const [get, set] = model(props, "");
  const c = ctl(props);
  // the error part exists only when the prop was given (an input in a <Field> gets its error from the field)
  const errId = "error" in props ? `${c.id ?? uid("m-input")}-err` : null;
  const error = (): string => (errId ? val(props.error) || "" : "");
  const el = h("input", {
    ...c, ...textAttrs(props), type: props.type ?? "text", class: cx("m-input", props.prefix == null && props.suffix == null && props.class),
    ...(errId ? { "aria-invalid": () => (error() ? "true" : c["aria-invalid"]()), "aria-describedby": () => [c["aria-describedby"](), error() ? errId : null].filter(Boolean).join(" ") || null } : null),
    onInput: (e: Event) => set(props.transform ? props.transform(inputOf(e).value) : inputOf(e).value),
    onKeyDown: props.onKeyDown, onPaste: props.onPaste,
  }) as HTMLInputElement;
  syncValue(el, get);
  props.ref?.(el);
  const control = affix(props, el);
  return errId ? [control, h("div", { class: cx("m-field-error m-input-error", props.errorSpace && "is-kept"), id: errId, role: "alert", hidden: props.errorSpace ? null : () => !error() }, error)] : control;
}

/** Text input for an e-mail address (email keyboard, trimmed, lower-cased). */
export const EmailInput = (props: TextInputProps): unknown => TextInput(extend(props, { type: () => "email", autocomplete: () => props.autocomplete ?? "email", inputmode: () => "email", transform: () => (v) => v.trim() }));
/** Text input for a web address (url keyboard, https:// placeholder). */
export const UrlInput = (props: TextInputProps): unknown => TextInput(extend(props, { type: () => "url", inputmode: () => "url", placeholder: () => props.placeholder ?? "https://", transform: () => (v) => v.trim() }));
