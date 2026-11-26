// TextInput (with EmailInput and UrlInput): single-line text that works standalone or inside a <Field>/<Form>.
// With `mask` it formats while typing (march/mask: phone, card, IBAN, date, money…); the mask part loads with the first
// masked input, so a plain TextInput never downloads it.
import "./text-input.css";
import "../../../ui/field.css";
import { h } from "../../../dom/h.ts";
import { signal, untrack, getOwner, runWithOwner, onCleanup } from "../../../core/reactive.ts";
import { model, ctl, cx, uid, val, extend, syncValue, useField, type ControlProps } from "../../../forms/util.ts";
import type { MaybeFn } from "../../../ui/util.ts";
import { affix, textAttrs, inputOf, type AffixProps, type TextAttrProps } from "../../../forms/affix.ts";
import type { Handler } from "../../../core/util.ts";
import type { MaskSpec } from "../../../mask/core.ts";
import type { MaskState } from "../../../mask/input.ts";
import type { MaskMotion } from "./mask-ui.ts";
export { affix, type AffixProps, type TextAttrProps };
export type { MaskMotion, MaskMotionPart } from "./mask-ui.ts";

export interface TextInputProps extends ControlProps<string>, TextAttrProps, AffixProps {
  /** Input type (default "text"). @tr Girdi türü (varsayılan "text"). */
  type?: string | undefined;
  /** Rewrites the typed text before it becomes the value (e.g. `(v) => v.trim()`). @tr Yazılan metni değer olmadan önce dönüştürür (ör. `(v) => v.trim()`). */
  transform?: ((v: string) => string) | undefined;
  /** Key handler of the input. @tr Girdinin tuş işleyicisi. */
  onKeyDown?: Handler<[e: KeyboardEvent]> | undefined;
  /** Paste handler (e.g. split pasted lines into items; `preventDefault()` keeps the text out of the input). @tr Yapıştırma işleyicisi (ör. yapıştırılan satırları öğelere bölmek; `preventDefault()` metni girdiye almaz). */
  onPaste?: Handler<[e: ClipboardEvent]> | undefined;
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
  /**
   * Formats while typing (march/mask): a pattern (`"(999) 999 99 99"`: 9 digit, a letter, A capital, * either, `[ ]`
   * optional, `{n,m}` repeats), an array of literals and RegExps, a preset (`cardNumber()`, `iban()`, `date()`, `money()`…)
   * or a function of the raw value (a dynamic mask). The caret stays where it belongs; paste, Android keyboards and IME work.
   * @tr Yazarken biçimlendirir (march/mask): desen (`"(999) 999 99 99"`: 9 rakam, a harf, A büyük harf, * ikisi, `[ ]` isteğe bağlı, `{n,m}` tekrar), ayraç ve RegExp dizisi, hazır maske (`cardNumber()`, `iban()`, `date()`, `money()`…) ya da ham değerin işlevi (dinamik maske). İmleç yerinde kalır; yapıştırma, Android klavyeleri ve IME çalışır.
   */
  mask?: MaskSpec | undefined;
  /** With `mask`: the bound value is "raw" (default, "5551234567"), "masked" ("(555) 123 45 67") or "parsed" (a number, an ISO date). @tr `mask` ile: bağlı değer "raw" (varsayılan, "5551234567"), "masked" ("(555) 123 45 67") ya da "parsed" (sayı, ISO tarih). */
  maskValue?: "raw" | "masked" | "parsed" | undefined;
  /** With `mask`: "lazy" (default; literals appear while typing), "eager" (the whole template: `(___) ___ __ __`), "ghost" (the rest drawn faded after the text) or "none". @tr `mask` ile: "lazy" (varsayılan; ayraçlar yazarken çıkar), "eager" (tüm şablon: `(___) ___ __ __`), "ghost" (kalan kısım metnin arkasında soluk) ya da "none". */
  maskPlaceholder?: "lazy" | "eager" | "ghost" | "none" | undefined;
  /** With `mask`: the built-in animations (literals fade in, slots grow as they fill, a refused character shakes, the check mark pops); `false` turns them off, `{ literal, fill, reject, complete }` turns one off (`false`) or replaces it (`(el) => …`). Reduced motion is honoured. @tr `mask` ile: yerleşik animasyonlar (ayraçlar belirir, yuvalar dolarken büyür, reddedilen karakter sallar, onay işareti belirir); `false` hepsini kapatır, `{ literal, fill, reject, complete }` birini kapatır (`false`) ya da değiştirir (`(el) => …`). Azaltılmış hareket tercihine uyar. */
  maskMotion?: boolean | MaskMotion | undefined;
  /** With `mask`: the check mark shown when the value is complete and valid: `false` hides it, an icon / node replaces it. @tr `mask` ile: değer tamam ve geçerliyken gösterilen onay işareti: `false` gizler, ikon / düğüm yerine geçer. */
  maskDone?: unknown;
  /** With `mask`: the format hint read by screen readers (`aria-describedby`; default the mask's, e.g. "GG.AA.YYYY"); `false` leaves it out. @tr `mask` ile: ekran okuyucuların okuduğu biçim ipucu (`aria-describedby`; varsayılan maskeninki, ör. "GG.AA.YYYY"); `false` eklemez. */
  maskHint?: string | false | undefined;
  /** With `mask`: texts — `complete` is announced when the value is complete (default "Complete"). @tr `mask` ile: metinler — değer tamamlanınca `complete` duyurulur (varsayılan "Complete"). */
  maskLabels?: { complete?: string | undefined } | undefined;
  /** With `mask`: called with the mask state on every change (`{ text, raw, complete, error, value, name }`; `name`: the card type, the country…). @tr `mask` ile: her değişiklikte maske durumuyla çağrılır (`{ text, raw, complete, error, value, name }`; `name`: kart türü, ülke…). */
  onMaskState?: Handler<[state: MaskState]> | undefined;
  /** With `mask`: called once each time the value becomes complete. @tr `mask` ile: değer her tamamlandığında bir kez çağrılır. */
  onComplete?: Handler<[state: MaskState]> | undefined;
}

/** Single-line text. Props: type, placeholder, readonly, autocomplete, inputmode, maxLength, prefix, suffix, transform(v), onPaste, error, errorSpace, mask (maskValue, maskPlaceholder, maskMotion, maskDone, maskHint). */
export function TextInput(props: TextInputProps): unknown {
  const [get, set] = model(props, "");
  const c = ctl(props);
  const masked = props.mask != null;
  // the error part exists only when the prop was given (an input in a <Field> gets its error from the field), or for a
  // standalone masked input (the mask's own errors: an invalid card number, a date that does not exist)
  const maskErr = signal<string | null>(null);
  const field = masked ? useField() : null;
  const errId = "error" in props || (masked && !field) ? `${c.id ?? uid("m-input")}-err` : null;
  const error = (): string => (errId ? val(props.error) || maskErr() || "" : "");
  const hintText = (): string => (masked && props.maskHint !== false ? props.maskHint ?? hint() : "");
  const hint = signal("");
  const hintId = masked ? `${c.id ?? uid("m-input")}-fmt` : null;
  let live = false;
  const el = h("input", {
    ...c, ...textAttrs(props), type: props.type ?? "text", class: cx("m-input", props.prefix == null && props.suffix == null && !masked && props.class),
    ...(errId || hintId ? {
      "aria-invalid": () => (error() || (masked && maskErr()) ? "true" : c["aria-invalid"]()),
      "aria-describedby": () => [c["aria-describedby"](), hintId && hintText() ? hintId : null, errId && error() ? errId : null].filter(Boolean).join(" ") || null,
    } : null),
    // a masked input's value comes from the mask once its part has loaded
    onInput: (e: Event) => { if (!live) set(props.transform && !masked ? props.transform(inputOf(e).value) : inputOf(e).value); },
    onKeyDown: props.onKeyDown, onPaste: props.onPaste,
  }) as HTMLInputElement;
  if (masked) el.value = String(untrack(get) ?? "");
  else syncValue(el, get);
  props.ref?.(el);
  let control = affix(props, el);
  if (masked) {
    const box = h("span", { class: cx("m-mask", props.class) }, control, h("span", { class: "m-sr-only", id: hintId }, hintText)) as HTMLElement;
    control = box;
    const owner = getOwner();
    let gone = false;
    if (owner) onCleanup(() => { gone = true; });
    void import("./mask-ui.ts").then(({ attachMask }) => runWithOwner(owner, () => {
      if (gone) return;
      live = true;
      const ctl = attachMask(el, box, props, get, (v) => set(v as string), (e) => maskErr.set(e));
      hint.set(ctl.mask().hint ?? "");
    }));
  }
  return errId ? [control, h("div", { class: cx("m-field-error m-input-error", props.errorSpace && "is-kept"), id: errId, role: "alert", hidden: props.errorSpace ? null : () => !error() }, error)] : control;
}

/** Text input for an e-mail address (email keyboard, trimmed). */
export const EmailInput = (props: TextInputProps): unknown => TextInput(extend(props, { type: () => "email", autocomplete: () => props.autocomplete ?? "email", inputmode: () => "email", transform: () => (v) => v.trim() }));
/** Text input for a web address (url keyboard, https:// placeholder). */
export const UrlInput = (props: TextInputProps): unknown => TextInput(extend(props, { type: () => "url", inputmode: () => "url", placeholder: () => props.placeholder ?? "https://", transform: () => (v) => v.trim() }));
