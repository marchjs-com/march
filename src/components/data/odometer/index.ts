// Odometer (march/ui): a counter drawn as a row of number drums, as in a car's mileage counter, a water meter or a
// flip clock. It is CountRoll (the one rolling number) with the drum frame around it: a fixed count of integer drums
// (leading zeros, it rolls over past the last one), fraction drums (the classic red one), a unit and three looks.
//   <Odometer value={$km} digits={6} decimals={1} unit="km" />
import "./odometer.css";
import { h } from "../../../dom/h.ts";
import { locale, t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp, clamp } from "../../../core/util.ts";
import { still } from "../../../motion/engine/parts.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { CountRoll } from "../../social/count-roll/index.ts";

export type OdometerVariant = "mechanical" | "digital" | "flip";

export interface OdometerProps {
  /** The number shown; the drums roll when it changes (only the drums whose digit changed). @tr Gösterilen sayı; değişince çarklar döner (yalnız rakamı değişen çarklar). */
  value: MaybeFn<number | null | undefined>;
  /** Integer drums: the number is padded with zeros to this many and rolls over past them (999999 → 000000). Default 6. @tr Tam sayı çarkları: sayı bu kadar haneye sıfırla doldurulur, aşınca başa döner (999999 → 000000). Varsayılan 6. */
  digits?: MaybeFn<number | undefined>;
  /** Fraction drums after the decimal mark (the red drum of a mileage counter). Default 0. @tr Ondalık işaretinden sonraki kesir çarkları (kilometre sayacının kırmızı çarkı). Varsayılan 0. */
  decimals?: MaybeFn<number | undefined>;
  /** Unit after the drums ("km", "kWh", a node); false: none. @tr Çarklardan sonraki birim ("km", "kWh", bir düğüm); false: yok. */
  unit?: MaybeFn<string | Node | false | null | undefined>;
  /** Accessible name. Default "Odometer". @tr Erişilebilir ad. Varsayılan "Odometer". */
  label?: MaybeFn<string | undefined>;
  /** Look: "mechanical" (metal drums, default), "digital" (a lit display) or "flip" (split cards of a flip clock). @tr Görünüm: "mechanical" (metal çarklar, varsayılan), "digital" (ışıklı ekran) ya da "flip" (yaprak saat kartları). */
  variant?: MaybeFn<OdometerVariant | undefined>;
  /** Size: "sm", "md" (default), "lg", or the digit height in px. @tr Boyut: "sm", "md" (varsayılan), "lg" ya da px cinsinden rakam yüksekliği. */
  size?: MaybeFn<"sm" | "md" | "lg" | number | undefined>;
  /** Theme color token of the lit digits ("digital") and the fraction drums. Default: the accent (the fraction drums stay red). @tr Işıklı rakamların ("digital") ve kesir çarklarının tema renk belirteci. Varsayılan: vurgu rengi (kesir çarkları kırmızı kalır). */
  color?: ColorToken | undefined;
  /** The drum frame (bezel); false: the bare drums. Default true. @tr Çark çerçevesi; false: çıplak çarklar. Varsayılan true. */
  frame?: MaybeFn<boolean | undefined>;
  /** Motion: false (or "none") swaps the digits at once; reduced motion does the same. Default true. @tr Hareket: false (ya da "none") rakamları hemen değiştirir; azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Roll time of one drum (ms). Default 600 (mechanical), 260 (digital), 420 (flip). @tr Bir çarkın dönme süresi (ms). Varsayılan 600 (mechanical), 260 (digital), 420 (flip). */
  duration?: number | undefined;
  /** Delay between neighbouring drums (ms). Default 40. @tr Komşu çarklar arasındaki gecikme (ms). Varsayılan 40. */
  stagger?: number | undefined;
  /** Your own text for screen readers: `(n) => "12,345.6 kilometres"`. Default: the number in the locale plus the unit. @tr Ekran okuyucular için kendi metniniz: `(n) => "12.345,6 kilometre"`. Varsayılan: yerel biçimde sayı ve birim. */
  spoken?: ((n: number) => string) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

const DURATION: Record<OdometerVariant, number> = { mechanical: 600, digital: 260, flip: 420 };
const count = (x: unknown, d: number, hi: number): number => { const n = Math.floor(Number(x)); return Number.isFinite(n) ? clamp(n, 0, hi) : d; };

/** The locale's decimal mark ("." or ","). */
export function decimalMark(lang = locale()): string {
  try { return new Intl.NumberFormat(lang).formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? "."; } catch { return "."; }
}

/**
 * The drum text of a number: `digits` integer drums (zero-padded, the overflow rolls over as on a real counter) and
 * `decimals` fraction drums, truncated (a drum shows a tenth only once it has passed). The sign is not a drum.
 *   drumText(1234.56, 6, 1) → "001234.5"
 */
export function drumText(n: number, digits: number, decimals: number, mark = "."): string {
  const p = 10 ** decimals;
  const scaled = Math.floor(Math.abs(Number(n) || 0) * p + 1e-6);
  const int = String(Math.floor(scaled / p) % 10 ** digits).padStart(digits, "0");
  return decimals ? `${int}${mark}${String(scaled % p).padStart(decimals, "0")}` : int;
}

/** `<Odometer value={$km} digits={6} decimals={1} unit="km" />` */
export function Odometer(props: OdometerProps): Element {
  const digits = (): number => count(val(props.digits), 6, 15);
  const decimals = (): number => count(val(props.decimals), 0, 6);
  const variant = (): OdometerVariant => { const v = val(props.variant); return v === "digital" || v === "flip" ? v : "mechanical"; };
  const value = (): number => { const n = Number(val(props.value) ?? 0); return Number.isFinite(n) ? n : 0; };
  const unitText = (): string => { const u = val(props.unit); return typeof u === "string" ? u : ""; };
  const spoken = (n: number): string => {
    if (props.spoken) return props.spoken(n);
    const d = decimals(), p = 10 ** d;
    const shown = Math.trunc(n * p + (n < 0 ? -1e-7 : 1e-7)) / p;
    const num = new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(shown);
    return unitText() ? `${num} ${unitText()}` : num;
  };
  const size = (): string | number => val(props.size) ?? "md";
  const root = h("span", {
    class: () => cx("m-odo", `m-odo-${variant()}`, typeof size() === "string" && `m-odo-${size()}`, val(props.frame) === false && "m-odo-bare", val(props.class)),
    role: "img",
    "data-m-color": colorAttr(props.color),
    "aria-label": () => `${val(props.label) ?? t`Odometer`}: ${spoken(value())}`,
    style: () => ({ "--m-odo-h": typeof size() === "number" ? `${size()}px` : null }),
  },
  h("span", { class: "m-odo-drums" },
    () => (value() < 0 ? h("span", { class: "m-odo-sign", "aria-hidden": "true" }, "−") : null),
    h(CountRoll, {
      // reading digits / decimals here redraws the same value when the drum count changes (CountRoll draws, no roll)
      value: () => { digits(); decimals(); return value(); },
      formatter: (n: number) => drumText(n, digits(), decimals(), decimalMark()),
      spoken,
      roll: () => !still(props.motion),
      duration: props.duration ?? DURATION[variant()],
      stagger: props.stagger ?? 40,
      class: () => cx("m-odo-roll", decimals() > 0 && "is-frac"),
    })),
  () => {
    const u = val(props.unit);
    return u === false || u == null || u === "" ? null : h("span", { class: "m-odo-unit", "aria-hidden": "true" }, u);
  });
  return root as Element;
}
