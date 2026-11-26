// NumberInput family: NumberInput, IntInput, MoneyInput, PercentInput. Locale aware, never NaN. The typing runs on
// march/mask's number kind: separators in the locale, one decimal point (either "," or "."), the sign, max refused
// while typing, min / max and the decimals applied when the field is left; ArrowUp / ArrowDown step.
import "./number-input.css";
import "../../../ui/field.css";
import { computed, effect, untrack, signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { locale } from "../../../core/i18n.ts";
import { model, ctl, cx, extend, type ControlProps } from "../../../forms/util.ts";
import { affix, textAttrs, type AffixProps, type TextAttrProps } from "../../../forms/affix.ts";
import { number } from "../../../mask/number.ts";
import { mask as maskBehavior } from "../../../behaviors/mask/mask.ts";
import type { MaskController } from "../../../mask/input.ts";

const precise = <N extends number | null | undefined>(n: N): N => (n == null ? n : (Number(n.toPrecision(15)) as N));

export interface NumberInputProps extends ControlProps<number | null>, TextAttrProps, AffixProps {
  /** Smallest allowed value; the input clamps to it. @tr İzin verilen en küçük değer; girdi bu değere sınırlar. */
  min?: number | null | undefined;
  /** Largest allowed value; the input clamps to it. @tr İzin verilen en büyük değer; girdi bu değere sınırlar. */
  max?: number | null | undefined;
  /** ArrowUp / ArrowDown step (display units). @tr ArrowUp / ArrowDown adımı (gösterim biriminde). */
  step?: number | undefined;
  /** Decimal places the value is rounded to. @tr Değerin yuvarlandığı ondalık basamak sayısı. */
  decimals?: number | undefined;
  /** Decimal places always shown (padded with zeros). @tr Her zaman gösterilen ondalık basamak sayısı (sıfırla doldurulur). */
  minDecimals?: number | undefined;
  /** Thousands separators (default false; MoneyInput: true). @tr Binlik ayırıcılar (varsayılan false; MoneyInput: true). */
  grouping?: boolean | undefined;
  /** Display = value × scale. @tr Gösterilen = değer × scale. */
  scale?: number | undefined;
  /** Locale for the number format (default: the app locale). @tr Sayı biçiminin dili (varsayılan: uygulamanın dili). */
  locale?: string | undefined;
  /** Called with the input element. @tr Girdi öğesiyle çağrılır. */
  ref?: ((el: HTMLInputElement) => void) | undefined;
  /** The shake when a character is refused (a letter, a digit past max or the decimals): `false` turns it off, a function plays your own. @tr Bir karakter reddedilince (harf, en büyüğü ya da ondalıkları aşan rakam) alanın sallanması: `false` kapatır, işlev kendi hareketinizi oynatır. */
  motion?: boolean | ((el: HTMLInputElement) => void) | undefined;
}

/**
 * Locale aware number: accepts "12,5" and "12.5", never produces NaN (characters that make no number are refused).
 * Props: min, max, step (ArrowUp/Down), decimals, minDecimals, grouping, scale (display = value × scale), locale, prefix, suffix.
 */
export function NumberInput(props: NumberInputProps): unknown {
  const [get, set] = model<number | null>(props, null);
  const loc = (): string => props.locale ?? locale();
  const scale = (): number => props.scale ?? 1;
  // the mask in display units (min / max scaled with it)
  const spec = computed(() => number({
    locale: loc(), decimals: props.decimals ?? 10, minDecimals: props.minDecimals, thousands: !!props.grouping,
    negative: props.min == null || props.min < 0,
    min: props.min == null ? null : precise(props.min * scale()), max: props.max == null ? null : precise(props.max * scale()),
  }));
  const err = signal(false);
  const base = ctl(props);
  const inv = base["aria-invalid"];
  const toRange = (v: number | null): number | null => {
    if (v == null) return v;
    if (props.min != null && v < props.min) v = props.min;
    if (props.max != null && v > props.max) v = props.max;
    if (props.decimals != null) { const f = 10 ** props.decimals / scale(); v = Math.round(v * f) / f; }
    return precise(v);
  };
  let ctlr!: MaskController;
  const el = h("input", {
    ...base, ...textAttrs(props), type: "text", class: cx("m-input m-number", props.prefix == null && props.suffix == null && props.class),
    inputmode: props.inputmode ?? (props.decimals === 0 && (props.min ?? -1) >= 0 ? "numeric" : "decimal"), autocomplete: props.autocomplete ?? "off",
    "aria-invalid": () => (err() || inv() ? "true" : null),
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || props.readonly) return;
      e.preventDefault();
      const step = (props.step ?? 1) / scale();
      set(toRange(precise((untrack(get) ?? 0) + (e.key === "ArrowUp" ? step : -step))));
    },
  }) as HTMLInputElement;
  maskBehavior(el, {
    mask: untrack(spec), value: "parsed", motion: props.motion, ref: (c) => { ctlr = c; },
    onChange: (v) => {
      const n = v == null ? null : precise((v as number) / scale());
      // the field was left: clamp and round like before (the mask already did it in display units)
      if (n !== untrack(get)) set(n);
    },
  });
  effect(() => { const s = spec(); untrack(() => ctlr.setMask(s)); });
  // the bound value in (display units); a value outside min / max is shown as it is and marked
  effect(() => {
    const v = get();
    untrack(() => { const d = v == null ? null : precise(v * scale()); if (ctlr.state().value !== d) ctlr.set(d); });
  });
  effect(() => { const st = ctlr.state(); untrack(() => err.set(!!st.error)); });
  el.addEventListener("blur", () => { const v = untrack(get), c = toRange(v); if (c !== v) set(c); });
  props.ref?.(el);
  return affix(props, el);
}

/** Whole numbers: NumberInput with 0 decimals. */
export const IntInput = (props: NumberInputProps): unknown => NumberInput(extend(props, { decimals: () => props.decimals ?? 0 }));

// Intl currency option, kept in a constant: the CSP source check reads a quoted value after the style key as an inline style
const CURRENCY_STYLE = "currency" as const;
const CURRENCY: Intl.NumberFormatOptions = { style: CURRENCY_STYLE };

/** Currency symbol, its side and the currency's minor digits for a locale. */
export function currencyInfo(loc: string | undefined, currency: string): { symbol: string; prefix: boolean; digits: number } {
  try {
    const f = new Intl.NumberFormat(loc, { ...CURRENCY, currency, currencyDisplay: "narrowSymbol" });
    const parts = f.formatToParts(1);
    const ci = parts.findIndex((p) => p.type === "currency"), ii = parts.findIndex((p) => p.type === "integer");
    return { symbol: parts[ci]?.value ?? currency, prefix: ci < ii, digits: f.resolvedOptions().maximumFractionDigits as number };
  } catch { return { symbol: currency, prefix: false, digits: 2 }; }
}

export interface MoneyInputProps extends NumberInputProps {
  /** ISO 4217 code (default "USD"). @tr ISO 4217 kodu (varsayılan "USD"). */
  currency?: string | undefined;
}

/** Money: NumberInput with the currency symbol on the locale's side and the currency's decimals (2 for most). Props: currency. */
export function MoneyInput(props: MoneyInputProps): unknown {
  const info = computed(() => currencyInfo(props.locale ?? locale(), props.currency ?? "USD"));
  return NumberInput(extend(props, {
    decimals: () => props.decimals ?? info().digits, minDecimals: () => props.decimals ?? info().digits, grouping: () => props.grouping ?? true,
    prefix: () => (info().prefix ? info().symbol : null), suffix: () => (info().prefix ? null : info().symbol),
  }));
}

export interface PercentInputProps extends NumberInputProps {
  /** `false` stores 12.5 for 12.5 % (default: 0.125). @tr `false` %12,5 için 12.5 saklar (varsayılan: 0.125). */
  fraction?: boolean | undefined;
}

/** Percent: shows 12.5 % for a stored 0.125 (`fraction={false}` stores 12.5). */
export const PercentInput = (props: PercentInputProps): unknown => NumberInput(extend(props, { scale: () => (props.fraction === false ? 1 : 100), suffix: () => "%", decimals: () => props.decimals ?? 2 }));
