// PhoneInput: a phone number in its country's format while typing (march/mask phone()); the value stays "+" and digits.
// With `country` the calling code is the prefix and the number is national ("7700 900123"); without it the number is
// international ("+44 7700 900123"), the country chosen by the calling code typed.
import "./phone-input.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { extend, type ControlProps } from "../../../forms/util.ts";
import type { AffixProps, TextAttrProps } from "../../../forms/affix.ts";
import { TextInput, type TextInputProps } from "../text-input/index.ts";
import { phone, loadPhoneFormats } from "../../../mask/phone.ts";

/** Normalize a typed phone number to "+" and digits; `country` ("+90") is prepended to national numbers. */
export function normalizePhone(raw: unknown, country?: string | null): string {
  const s = String(raw ?? "").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  return country ? `${country}${s.replace(/^0+/, "")}` : s;
}

export interface PhoneInputProps extends ControlProps<string>, TextAttrProps, AffixProps {
  /** Country: a calling code ("+44") or an ISO code ("GB"); shown as a prefix, the number typed in that country's format. Without it the number is international. @tr Ülke: telefon kodu ("+44") ya da ISO kodu ("GB"); önek olarak gösterilir, numara o ülkenin biçiminde yazılır. Verilmezse numara uluslararasıdır. */
  country?: string | undefined;
  /** The mask's animations (literals fade in, slots grow, a refused character shakes, the check mark pops): `false` or `{ literal, fill, reject, complete }`. @tr Maskenin animasyonları: `false` ya da `{ literal, fill, reject, complete }`. */
  maskMotion?: TextInputProps["maskMotion"];
  /** "lazy" (default), "eager" (the whole template) or "ghost" (the rest faded). @tr "lazy" (varsayılan), "eager" (tüm şablon) ya da "ghost" (kalan soluk). */
  maskPlaceholder?: TextInputProps["maskPlaceholder"];
  /** The check mark of a complete number: `false` hides it, an icon / node replaces it. @tr Tamamlanan numaranın onay işareti: `false` gizler, ikon / düğüm yerine geçer. */
  maskDone?: unknown;
  /** Called with the mask state (`name`: the country of an international number). @tr Maske durumuyla çağrılır (`name`: uluslararası numaranın ülkesi). */
  onMaskState?: TextInputProps["onMaskState"];
}

/** Phone number: `<PhoneInput bind:value={$tel} country="TR" />` → value "+905551234567", shown "(555) 123 45 67". */
export function PhoneInput(props: PhoneInputProps): unknown {
  // the calling code of an ISO country comes with the formats
  const dial = signal<string | null>(null);
  const prefix = (): unknown => {
    const c = props.country;
    if (c == null) return props.prefix;
    if (c.trim().startsWith("+") || /^\d+$/.test(c.trim())) return `+${c.replace(/\D/g, "")}`;
    return dial() ?? "+";
  };
  if (props.country && !/^\+?\d+$/.test(props.country.trim())) {
    void loadPhoneFormats().then((rows) => { const r = rows.find((x) => x[0] === props.country!.toUpperCase()); if (r) dial.set(`+${r[1]}`); });
  }
  const masks = new Map<string, unknown>();
  const maskOf = (): unknown => { const k = props.country ?? ""; let m = masks.get(k); if (!m) masks.set(k, (m = phone({ country: props.country }))); return m; };
  return h(TextInput, extend(props as TextInputProps, {
    type: () => "tel", inputmode: () => "tel", autocomplete: () => props.autocomplete ?? (props.country ? "tel-national" : "tel"),
    class: () => ["m-phone", props.class] as never, prefix,
    mask: maskOf as never, maskValue: () => "parsed" as const,
  }));
}
