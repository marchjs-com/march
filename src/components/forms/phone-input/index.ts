// PhoneInput: a phone number kept as "+" and digits; the country code shows as a prefix.
import "./phone-input.css";
import "../../../ui/field.css";
import { h } from "../../../dom/h.ts";
import { model, ctl, cx, extend, syncValue, type ControlProps } from "../../../forms/util.ts";
import { affix, textAttrs, inputOf, type AffixProps, type TextAttrProps } from "../../../forms/affix.ts";

/** Normalize a typed phone number to "+" and digits; `country` ("+90") is prepended to national numbers. */
export function normalizePhone(raw: unknown, country?: string | null): string {
  const s = String(raw ?? "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  return country ? `${country}${s.replace(/^0+/, "")}` : s;
}

export interface PhoneInputProps extends ControlProps<string>, TextAttrProps, AffixProps {
  /** Country calling code ("+44"), shown as a prefix and prepended to national numbers. */
  country?: string | undefined;
}

/** Phone number: keeps "+" and digits only. Props: country (e.g. "+44", shown as a prefix). Value: "+447700900123". */
export function PhoneInput(props: PhoneInputProps): unknown {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), type: "tel", inputmode: "tel", autocomplete: props.autocomplete ?? "tel", class: cx("hm-input hm-phone", props.country == null && props.prefix == null && props.suffix == null && props.class),
    onInput: (e: Event) => set(normalizePhone(inputOf(e).value, props.country)),
  }) as HTMLInputElement;
  syncValue(el, () => { const v = get() ?? "", c = props.country; return c && v.startsWith(c) ? v.slice(c.length) : v; });
  return affix(extend(props, { prefix: () => props.country ?? props.prefix }), el);
}
