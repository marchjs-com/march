// Basic inputs. Every control works standalone (`bind:value={$x}`, `value` + `onChange(v)`, or uncontrolled) and inside
// a <Field>/<Form>, where id, aria-invalid and aria-describedby come from the field context.
import "./inputs.css";
import "../ui/field.css";
import "../ui/button.css";
import { signal, computed, effect, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale } from "../core/i18n.ts";
import { roving } from "../ui/focus.ts";
import { model, ctl, cx, uid, extend, syncValue, parseNumber, formatNumber, normOptions, same, labelledBy, useField,
  type ControlProps, type ClassProp, type OptionsProp } from "./util.ts";
import { colorAttr, type ColorToken } from "../theme/colors.ts";
import { choiceBox, choiceText, itemColor, lookClass, type ChoiceLook } from "./choice.ts";
import { clamp } from "../core/util.ts";

/** prefix / suffix text around a control. */
export interface AffixProps { prefix?: unknown; suffix?: unknown; class?: ClassProp }

/** Wrap a control with prefix / suffix text when given. */
export function affix(props: AffixProps, el: Node): unknown {
  if (props.prefix == null && props.suffix == null) return el;
  const part = (k: "prefix" | "suffix") => () => (props[k] != null ? h("span", { class: `hm-affix-text hm-affix-${k}` }, props[k]) : null);
  return h("span", { class: cx("hm-affix", props.class) }, part("prefix"), el, part("suffix"));
}

/** Text attributes shared by the text-like inputs. */
export interface TextAttrProps {
  placeholder?: string | null | undefined;
  readonly?: boolean | null | undefined;
  autocomplete?: string | undefined;
  inputmode?: string | undefined;
  maxLength?: number | undefined;
  maxlength?: number | undefined;
  minLength?: number | undefined;
  minlength?: number | undefined;
  spellcheck?: string | boolean | undefined;
  /** Focus this field when it appears. */
  autofocus?: boolean | undefined;
}

const textAttrs = (props: TextAttrProps) => ({
  placeholder: () => props.placeholder ?? null,
  readonly: () => !!props.readonly,
  autocomplete: props.autocomplete,
  inputmode: props.inputmode,
  autofocus: props.autofocus ? true : null,
  maxlength: props.maxLength ?? props.maxlength,
  minlength: props.minLength ?? props.minlength,
  spellcheck: props.spellcheck,
});

const inputOf = (e: Event) => e.target as HTMLInputElement;

export interface TextInputProps extends ControlProps<string>, TextAttrProps, AffixProps {
  type?: string | undefined;
  transform?: ((v: string) => string) | undefined;
  onKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  ref?: ((el: HTMLInputElement) => void) | undefined;
}

/** Single-line text. Props: type, placeholder, readonly, autocomplete, inputmode, maxLength, prefix, suffix, transform(v). */
export function TextInput(props: TextInputProps): unknown {
  const [get, set] = model(props, "");
  const el = h("input", {
    ...ctl(props), ...textAttrs(props), type: props.type ?? "text", class: cx("hm-input", props.prefix == null && props.suffix == null && props.class),
    onInput: (e: Event) => set(props.transform ? props.transform(inputOf(e).value) : inputOf(e).value),
    onKeyDown: props.onKeyDown,
  }) as HTMLInputElement;
  syncValue(el, get);
  props.ref?.(el);
  return affix(props, el);
}

/** Text input for an e-mail address (email keyboard, trimmed, lower-cased). */
export const EmailInput = (props: TextInputProps): unknown => TextInput(extend(props, { type: () => "email", autocomplete: () => props.autocomplete ?? "email", inputmode: () => "email", transform: () => (v) => v.trim() }));
/** Text input for a web address (url keyboard, https:// placeholder). */
export const UrlInput = (props: TextInputProps): unknown => TextInput(extend(props, { type: () => "url", inputmode: () => "url", placeholder: () => props.placeholder ?? "https://", transform: () => (v) => v.trim() }));

export interface TextareaProps extends ControlProps<string>, TextAttrProps {
  rows?: number | undefined;
  /** Grow with the content (default true). */
  autosize?: boolean | undefined;
  ref?: ((el: HTMLTextAreaElement) => void) | undefined;
}

/** Multi-line text that grows with its content (`autosize={false}` to disable). Props: rows, maxRows. */
export function Textarea(props: TextareaProps): unknown {
  const [get, set] = model(props, "");
  const el = h("textarea", { ...ctl(props), ...textAttrs(props), rows: props.rows ?? 3, class: cx("hm-input hm-textarea", props.class), onInput: (e: Event) => { set((e.target as HTMLTextAreaElement).value); fit(); } }) as HTMLTextAreaElement;
  const fit = () => {
    if (props.autosize === false || !el.scrollHeight) return;
    el.style.setProperty("height", "auto");
    el.style.setProperty("height", `${el.scrollHeight + 2}px`);
  };
  syncValue(el, get);
  effect(() => { get(); fit(); });
  props.ref?.(el);
  return el;
}

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
    ...ctl(props), ...textAttrs(props), type: "tel", inputmode: "tel", autocomplete: props.autocomplete ?? "tel", class: "hm-input",
    onInput: (e: Event) => set(normalizePhone(inputOf(e).value, props.country)),
  }) as HTMLInputElement;
  syncValue(el, () => { const v = get() ?? "", c = props.country; return c && v.startsWith(c) ? v.slice(c.length) : v; });
  return affix(extend(props, { prefix: () => props.country ?? props.prefix }), el);
}

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
    ...base, ...textAttrs(props), type: "text", class: "hm-input hm-number",
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

/** Currency symbol, its side and the currency's minor digits for a locale. */
export function currencyInfo(loc: string | undefined, currency: string): { symbol: string; prefix: boolean; digits: number } {
  try {
    const f = new Intl.NumberFormat(loc, { style: "currency", currency, currencyDisplay: "narrowSymbol" });
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

export interface SelectProps<T = unknown> extends ControlProps<T | null> {
  /** [value] or [{ value, label, disabled }]; may be live. */
  options?: OptionsProp;
  placeholder?: string | undefined;
}

/** Native select. Props: options ([value] or [{value,label,disabled}], may be live), placeholder. Values keep their type. */
export function Select<T = unknown>(props: SelectProps<T>): unknown {
  const [get, set] = model<T | null>(props, null);
  const opts = computed(() => normOptions(props.options));
  const el = h("select", {
    ...ctl(props), class: cx("hm-select", props.class), disabled: () => !!(props.disabled || props.readonly),
    onChange: (e: Event) => { const i = (e.target as HTMLSelectElement).value; set(i === "" ? null : (opts()[+i]?.value as T | undefined) ?? null); },
  }, () => [h("option", { value: "" }, props.placeholder ?? ""), ...opts().map((o, i) => h("option", { value: String(i), disabled: !!o.disabled }, o.label))]) as HTMLSelectElement;
  effect(() => { const i = opts().findIndex((o) => same(o.value, get())); el.value = i < 0 ? "" : String(i); });
  return el;
}

export interface CheckboxProps extends ControlProps<boolean>, ChoiceLook {
  label?: unknown;
  children?: unknown;
  /** Smaller text under the label (in the card variant: the description). */
  hint?: unknown;
  indeterminate?: boolean | undefined;
}

/**
 * Checkbox with its label (`label` prop or children): a drawn box (animated tick), the real input stays for keyboard,
 * forms and screen readers. `variant="classic" | "soft" | "chip" | "card" | "toggle"`, `size`, `shape`, `icon`, `color`.
 */
export function Checkbox(props: CheckboxProps): unknown {
  const [get, set] = model(props, false);
  const input = h("input", {
    ...ctl(props), type: "checkbox", class: "hm-check-input", checked: () => !!get(), indeterminate: () => !!props.indeterminate,
    disabled: () => !!(props.disabled || props.readonly), onChange: (e: Event) => set(inputOf(e).checked),
  });
  return h("span", { class: () => cx(lookClass(props, "checkbox"), "hm-choice-single", typeof props.class === "function" ? (props.class as () => unknown)() : props.class), "data-hm-color": () => colorAttr(props.color) },
    h("label", { class: "hm-check" }, input, choiceBox("checkbox", props), choiceText(() => props.label ?? props.children, props.hint, props.icon && props.variant === "card" ? props.icon : null, props.variant)));
}

export interface ToggleProps extends ControlProps<boolean> {
  label?: unknown;
  children?: unknown;
}

/** On / off switch (role="switch"). */
export function Toggle(props: ToggleProps): unknown {
  const [get, set] = model(props, false);
  const btn = h("button", {
    ...ctl(props), type: "button", role: "switch", class: "hm-switch", "aria-checked": () => String(!!get()),
    disabled: () => !!(props.disabled || props.readonly), onClick: () => set(!untrack(get)),
  }, h("span", { class: "hm-switch-thumb", "aria-hidden": "true" }));
  const label = () => props.label ?? props.children;
  return h("label", { class: cx("hm-switch-wrap", props.class) }, btn, () => (label() != null ? h("span", { class: "hm-check-label" }, label()) : null));
}

/** Look of a group of choices: every option takes it; `colors="brand"` gives each option the next HADİ color. */
export interface ChoiceGroupLook extends ChoiceLook {
  /** "brand" (orange, blue, green, purple in turn) or a list of color tokens, one per option in turn. */
  colors?: "brand" | readonly string[] | undefined;
}

export interface CheckboxGroupProps<T = unknown> extends ControlProps<T[]>, ChoiceGroupLook {
  /** [{ value, label, hint?, icon?, meta?, disabled? }] (icon, hint and meta — a price or badge — show in the card variant). */
  options?: OptionsProp;
  inline?: boolean | undefined;
}

const groupClass = (props: ChoiceGroupLook & { inline?: boolean | undefined; class?: unknown }, kind: "checkbox" | "radio"): string =>
  cx("hm-choices", lookClass(props, kind), props.inline && "hm-choices-inline", props.class as string);

/** Several checkboxes; value is an array of the checked option values. Props: options, inline, variant, colors… */
export function CheckboxGroup<T = unknown>(props: CheckboxGroupProps<T>): unknown {
  const [get, set] = model<T[]>(props, []);
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("hm-cbg");
  const c = ctl(props);
  return h("div", { "data-hm-color": () => colorAttr(props.color), role: "group", class: () => groupClass(props, "checkbox"), "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"] },
    () => normOptions(props.options).map((o, i) => h("label", { class: "hm-check", "data-hm-color": () => itemColor(props.colors, i) },
      h("input", {
        type: "checkbox", class: "hm-check-input", id: i ? `${baseId}-${i}` : baseId, name: props.name, onBlur: props.onBlur,
        checked: () => (get() ?? []).some((x) => same(x, o.value)), disabled: () => !!(props.disabled || props.readonly || o.disabled),
        onChange: (e: Event) => { const cur = (untrack(get) ?? []).filter((x) => !same(x, o.value)); set(inputOf(e).checked ? [...cur, o.value as T] : cur); },
      }),
      choiceBox("checkbox", props),
      choiceText(o.label, o.hint, o["icon"], props.variant, o["meta"]))));
}

export interface RadioGroupProps<T = unknown> extends ControlProps<T | null>, ChoiceGroupLook {
  options?: OptionsProp;
  inline?: boolean | undefined;
}

/** Radio buttons; value is the chosen option value. Props: options, inline, variant ("segmented" too), colors… */
export function RadioGroup<T = unknown>(props: RadioGroupProps<T>): unknown {
  const [get, set] = model<T | null>(props, null);
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("hm-rg");
  const name = props.name ?? baseId;
  const c = ctl(props);
  return h("div", { "data-hm-color": () => colorAttr(props.color), role: "radiogroup", class: () => groupClass(props, "radio"), "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"] },
    () => normOptions(props.options).map((o, i) => h("label", { class: "hm-check", "data-hm-color": () => itemColor(props.colors, i) },
      h("input", {
        type: "radio", class: "hm-check-input", id: i ? `${baseId}-${i}` : baseId, name, onBlur: props.onBlur,
        checked: () => same(get(), o.value), disabled: () => !!(props.disabled || props.readonly || o.disabled),
        onChange: (e: Event) => { if (inputOf(e).checked) set(o.value as T); },
      }),
      choiceBox("radio", props),
      choiceText(o.label, o.hint, o["icon"], props.variant, o["meta"]))));
}

export interface SegmentedProps<T = unknown> extends ControlProps<T | null> {
  options?: OptionsProp;
}

/** Segmented control (a compact single choice). Arrow keys move and select. */
export function Segmented<T = unknown>(props: SegmentedProps<T>): unknown {
  const [get, set] = model<T | null>(props, null);
  const field = useField();
  const baseId = props.id ?? field?.id;
  const c = ctl(props);
  let root: Element;
  const onKeyDown = (e: KeyboardEvent) => { const target = roving(e, [...root.querySelectorAll("button")].filter((b) => !b.disabled), { horizontal: true }); if (target) target.click(); };
  root = h("div", { "data-hm-color": colorAttr(props.color), role: "radiogroup", class: cx("hm-segmented", props.class), "aria-labelledby": labelledBy(props), "aria-label": c["aria-label"], "aria-invalid": c["aria-invalid"], onKeyDown },
    () => {
      const opts = normOptions(props.options);
      return opts.map((o, i) => h("button", {
        type: "button", role: "radio", class: "hm-segment", id: i === 0 ? baseId : undefined, onBlur: props.onBlur,
        "aria-checked": () => String(same(get(), o.value)),
        tabindex: () => (same(get(), o.value) || (i === 0 && !opts.some((x) => same(x.value, get()))) ? "0" : "-1"),
        disabled: () => !!(props.disabled || props.readonly || o.disabled), onClick: () => set(o.value as T),
      }, o.label));
    });
  return root;
}

export interface SliderProps extends ControlProps<number> {
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  /** Text of the value shown next to the slider. */
  format?: ((v: number) => unknown) | undefined;
}

/** Range slider with the current value shown. Props: min, max, step, format(v). */
export function Slider(props: SliderProps): unknown {
  const [get, set] = model(props, props.min ?? 0);
  const el = h("input", {
    ...ctl(props), type: "range", class: "hm-slider", min: () => props.min ?? 0, max: () => props.max ?? 100, step: () => props.step ?? 1,
    disabled: () => !!(props.disabled || props.readonly), onInput: (e: Event) => set(Number(inputOf(e).value)),
  }) as HTMLInputElement;
  syncValue(el, get);
  return h("span", { class: cx("hm-slider-wrap", props.class) }, el, h("output", { class: "hm-slider-value", for: () => el.id || null }, () => (props.format ? props.format(get()) : String(get() ?? ""))));
}

export interface ColorInputProps extends ControlProps<string> {}

/** Color: native swatch picker plus a #RRGGBB text field. */
export function ColorInput(props: ColorInputProps): unknown {
  const [get, set] = model(props, "");
  const swatch = h("input", { type: "color", class: "hm-color-swatch", "aria-label": t`Pick a color`, disabled: () => !!(props.disabled || props.readonly), onInput: (e: Event) => set(inputOf(e).value.toLowerCase()) }) as HTMLInputElement;
  syncValue(swatch, () => (/^#[0-9a-f]{6}$/i.test(get() ?? "") ? get().toLowerCase() : "#000000"));
  const text = h("input", { ...ctl(props), type: "text", class: "hm-input hm-color-text", maxlength: 7, spellcheck: "false", autocomplete: "off", placeholder: "#RRGGBB", readonly: () => !!props.readonly, onInput: (e: Event) => set(inputOf(e).value.trim().toLowerCase()) }) as HTMLInputElement;
  syncValue(text, get);
  return h("span", { class: cx("hm-color", props.class) }, swatch, text);
}

export interface CodeInputProps extends ControlProps<string> {
  /** Number of boxes, 3–12 (default 6). */
  length?: number | undefined;
  /** Characters allowed: "numeric" (default; numeric keypad, one-time-code autofill), "alpha" or "alphanumeric". */
  pattern?: "numeric" | "alpha" | "alphanumeric" | undefined;
  /** @deprecated use pattern: `false` = "alphanumeric". */
  numeric?: boolean | undefined;
  /** Force capitals (default true for letters). */
  uppercase?: boolean | undefined;
  /** Visual groups, e.g. [3, 3] → "123 456" with a separator between the groups. */
  groups?: readonly number[] | undefined;
  /** Hide the characters (PINs). */
  mask?: boolean | (() => boolean) | undefined;
  /** @deprecated alias of mask. */
  masked?: boolean | (() => boolean) | undefined;
  /**
   * Box colors: "single" (the accent / `color`), "brand" (the four HADİ colors in turn — the HADİ theme's default), "palette"
   * (the theme's categorical colors) or a list of color tokens.
   */
  colors?: "single" | "brand" | "palette" | readonly ColorToken[] | undefined;
  /** Digits font: "display" (the theme's display face — HADİ: Bricolage; the HADİ default), "mono" or "body". */
  font?: "display" | "mono" | "body" | undefined;
  size?: "sm" | "md" | "lg" | undefined;
  /** "outline" (default), "filled" or "underline". */
  variant?: "outline" | "filled" | "underline" | undefined;
  /** Pop the character in (default true; off with prefers-reduced-motion). */
  animate?: boolean | undefined;
  onComplete?: ((code: string) => void) | undefined;
  autofocus?: boolean | undefined;
}

const PALETTE = ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5", "cat-6", "cat-7", "cat-8"];

/**
 * One-time code / PIN boxes: `<CodeInput length={6} groups={[3, 3]} onComplete={verify} />`. Typing moves forward, Backspace
 * back, ← → move, paste fills from the box (extra characters are cut). Colors, font, size and variant are props; in the HADİ
 * theme each box takes the next HADİ color and the display font, as in the HADİ apps.
 */
export function CodeInput(props: CodeInputProps): unknown {
  const n = clamp(props.length ?? 6, 3, 12);
  const [get, set] = model(props, "");
  const kind = props.pattern ?? (props.numeric === false ? "alphanumeric" : "numeric");
  const upper = props.uppercase ?? kind !== "numeric";
  const clean = (s: unknown): string => {
    const x = String(s ?? "");
    const kept = kind === "numeric" ? x.replace(/\D/g, "") : kind === "alpha" ? x.replace(/[^\p{L}]/gu, "") : x.replace(/[^\p{L}\p{N}]/gu, "");
    return upper ? kept.toLocaleUpperCase() : kept;
  };
  const masked = (): boolean => { const m = props.mask ?? props.masked; return typeof m === "function" ? m() : !!m; };
  const cells = signal(Array.from({ length: n }, (_, i) => clean(untrack(get))[i] ?? ""));
  let completed: string | null = null;
  const boxes: HTMLInputElement[] = [];
  const field = useField();
  const baseId = props.id ?? field?.id ?? uid("hm-code");
  const c = ctl(props);
  const write = (arr: string[]) => {
    cells.set(arr);
    const code = arr.join("");
    set(code);
    if (arr.every(Boolean)) { if (completed !== code) { completed = code; props.onComplete?.(code); } } else completed = null;
  };
  const pop = (el: HTMLElement): void => {
    if (props.animate === false || !el.animate || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ transform: "scale(.82)" }, { transform: "scale(1)" }], { duration: 180, easing: "cubic-bezier(.34, 1.56, .64, 1)" });
  };
  const fill = (i: number, text: string) => {
    const chars = [...clean(text)];
    if (!chars.length) return;
    if (chars.length >= n) i = 0;
    const arr = [...cells.peek()];
    let j = i;
    for (const ch of chars) { if (j >= n) break; arr[j] = ch; pop(boxes[j] as HTMLElement); j++; }
    write(arr);
    boxes[Math.min(j, n - 1)]?.focus();
  };
  effect(() => {
    const v = clean(get());
    if (v !== cells.peek().join("")) cells.set(Array.from({ length: n }, (_, i) => v[i] ?? ""));
  });
  const colorOf = (i: number): string | null => {
    const list = props.colors === "brand" ? ["brand-orange", "brand-blue", "brand-green", "brand-purple"] : props.colors === "palette" ? PALETTE : Array.isArray(props.colors) ? props.colors : null;
    return list && list.length ? (list[i % list.length] as string) : null;
  };
  for (let i = 0; i < n; i++) {
    const el = h("input", {
      type: () => (masked() ? "password" : "text"), class: () => cx("hm-otp-box", `hm-otp-b${(i % 4) + 1}`, cells()[i] && "is-filled"), id: i ? `${baseId}-${i}` : baseId,
      "data-hm-color": colorOf(i), inputmode: kind === "numeric" ? "numeric" : "text", pattern: kind === "numeric" ? "[0-9]*" : null, maxlength: 2,
      autocapitalize: upper ? "characters" : "off", spellcheck: "false",
      autocomplete: i === 0 ? "one-time-code" : "off", "aria-label": t`Character ${i + 1} of ${n}`, "aria-invalid": c["aria-invalid"],
      disabled: () => !!props.disabled, readonly: () => !!props.readonly, onBlur: props.onBlur, autofocus: i === 0 && props.autofocus ? true : null,
      onFocus: (e: FocusEvent) => inputOf(e).select?.(),
      onInput: (e: Event) => {
        const prev = cells.peek()[i];
        let v = clean(inputOf(e).value);
        if (v.length === 2 && prev && v.includes(prev)) v = (v[0] === prev ? v[1] : v[0])!;
        if (v.length > 1) { fill(i, v); return; }
        const arr = [...cells.peek()];
        arr[i] = v;
        write(arr);
        inputOf(e).value = v;
        if (v) pop(inputOf(e));
        if (v && i < n - 1) boxes[i + 1]!.focus();
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === "Backspace" && !cells.peek()[i] && i > 0) { e.preventDefault(); const arr = [...cells.peek()]; arr[i - 1] = ""; write(arr); boxes[i - 1]!.focus(); }
        else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); boxes[i - 1]!.focus(); }
        else if (e.key === "ArrowRight" && i < n - 1) { e.preventDefault(); boxes[i + 1]!.focus(); }
      },
      onPaste: (e: ClipboardEvent) => { const text = e.clipboardData?.getData("text") ?? ""; if (text) { e.preventDefault(); fill(i, text); } },
    }) as HTMLInputElement;
    syncValue(el, () => cells()[i]);
    boxes.push(el);
  }
  // groups: a separator between them ([3, 3] → 123–456)
  const parts: unknown[] = [];
  const sizes = props.groups?.length ? props.groups : [n];
  let k = 0;
  sizes.forEach((g, gi) => {
    if (gi) parts.push(h("span", { class: "hm-otp-sep", "aria-hidden": "true" }));
    for (let x = 0; x < g && k < n; x++) parts.push(boxes[k++]);
  });
  while (k < n) parts.push(boxes[k++]);
  onCleanup(() => { boxes.length = 0; });
  // codes read left to right in every language
  return h("div", {
    "data-hm-color": colorAttr(props.color), "data-hm-colors": props.colors && props.colors !== "single" ? (Array.isArray(props.colors) ? "custom" : props.colors) : null, role: "group", dir: "ltr",
    class: () => cx("hm-otp", `hm-otp-${props.size ?? "md"}`, `hm-otp-${props.variant ?? "outline"}`, props.font && `hm-otp-font-${props.font}`, props.colors === "single" && "hm-otp-single", props.class),
    "aria-labelledby": labelledBy(props), "aria-describedby": c["aria-describedby"],
  }, parts);
}
