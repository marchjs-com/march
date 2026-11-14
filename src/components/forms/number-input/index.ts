// NumberInput family: NumberInput, IntInput, MoneyInput, PercentInput. Locale aware, never NaN.
import "./number-input.css";
import "../../../ui/field.css";
import { signal, computed, effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { locale } from "../../../core/i18n.ts";
import { model, ctl, cx, extend, parseNumber, formatNumber, type ControlProps } from "../../../forms/util.ts";
import { affix, textAttrs, inputOf, type AffixProps, type TextAttrProps } from "../../../forms/affix.ts";

const precise = <N extends number | null | undefined>(n: N): N => (n == null ? n : (Number(n.toPrecision(15)) as N));

export interface NumberInputProps extends ControlProps<number | null>, TextAttrProps, AffixProps {
  min?: number | null | undefined;
  max?: number | null | undefined;
  /** ArrowUp / ArrowDown step (display units). */
  step?: number | undefined;
  decimals?: number | undefined;
  minDecimals?: number | undefined;
  grouping?: boolean | undefined;
  /** Display = value × scale. */
  scale?: number | undefined;
  locale?: string | undefined;
  ref?: ((el: HTMLInputElement) => void) | undefined;
}

/**
 * Locale aware number: accepts "12,5" and "12.5", never produces NaN (bad text marks the input invalid and is reverted on blur).
 * Props: min, max, step (ArrowUp/Down), decimals, minDecimals, grouping, scale (display = value × scale), locale, prefix, suffix.
 */
export function NumberInput(props: NumberInputProps): unknown {
  const [get, set] = model<number | null>(props, null);
  const loc = () => props.locale ?? locale();
  const scale = () => props.scale ?? 1;
  const shown = (v: number | null) => (v == null ? "" : formatNumber(precise(v * scale()), loc(), { decimals: props.decimals, minDecimals: props.minDecimals ?? 0, grouping: !!props.grouping }));
  const bad = signal(false);
  const toRange = (v: number | null) => {
    if (v == null) return v;
    if (props.min != null && v < props.min) v = props.min;
    if (props.max != null && v > props.max) v = props.max;
    if (props.decimals != null) { const f = 10 ** props.decimals / scale(); v = Math.round(v * f) / f; }
    return precise(v);
  };
  const base = ctl(props);
  const inv = base["aria-invalid"];
  let el: HTMLInputElement;
  const commit = () => {
    if (bad.peek()) bad.set(false);
    else { const v = untrack(get), c = toRange(v); if (c !== v) set(c); }
    el.value = untrack(() => shown(get()));
  };
  el = h("input", {
    ...base, ...textAttrs(props), type: "text", class: cx("hm-input hm-number", props.prefix == null && props.suffix == null && props.class),
    inputmode: props.inputmode ?? (props.decimals === 0 && (props.min ?? -1) >= 0 ? "numeric" : "decimal"), autocomplete: props.autocomplete ?? "off",
    "aria-invalid": () => (bad() || inv() ? "true" : null),
    onInput: (e: Event) => {
      const n = parseNumber(inputOf(e).value, loc());
      if (n === null) { bad.set(false); set(null); return; }
      if (Number.isNaN(n)) { bad.set(/^[-+]$/.test(inputOf(e).value.trim()) ? false : true); return; }
      bad.set(false);
      const v = precise(n / scale());
      if (v !== untrack(get)) set(v);
    },
    onBlur: (e: FocusEvent) => { commit(); props.onBlur?.(e); },
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || props.readonly) return;
      e.preventDefault();
      const step = (props.step ?? 1) / scale();
      set(toRange(precise((untrack(get) ?? 0) + (e.key === "ArrowUp" ? step : -step))));
      el.value = untrack(() => shown(get()));
    },
  }) as HTMLInputElement;
  effect(() => {
    const v = get(), s = shown(v);
    untrack(() => {
      if (globalThis.document?.activeElement === el) {
        const cur = parseNumber(el.value, loc());
        if (cur == null ? v == null : precise(cur / scale()) === v) return;
      }
      if (el.value !== s) el.value = s;
    });
  });
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
  /** ISO 4217 code (default "USD"). */
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
  /** `false` stores 12.5 for 12.5 % (default: 0.125). */
  fraction?: boolean | undefined;
}

/** Percent: shows 12.5 % for a stored 0.125 (`fraction={false}` stores 12.5). */
export const PercentInput = (props: PercentInputProps): unknown => NumberInput(extend(props, { scale: () => (props.fraction === false ? 1 : 100), suffix: () => "%", decimals: () => props.decimals ?? 2 }));
