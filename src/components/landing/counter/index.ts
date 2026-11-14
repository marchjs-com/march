// Counter (hadi-march/landing): an animated number. It counts up when it scrolls into view and glides to every new
// value; `roll` turns each digit like an odometer (the digits that change roll, the rest stay): that mode is drawn by
// CountRoll, the one odometer. Formatted with
// Intl.NumberFormat for the current locale (grouping, decimals, currency, percent, compact). Screen readers get the
// final value once; the moving digits are hidden from them.
import "./counter.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { locale } from "../../../core/i18n.ts";
import { cx, val, onVisible, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { formatCount } from "../../../ui/format.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { CountRoll } from "../../social/count-roll/index.ts";

export interface CounterProps {
  value: MaybeFn<number>;
  /** First value counted from (default 0). */
  from?: number | undefined;
  /** Intl.NumberFormat options (currency, percent, compact notation …), e.g. a currency format with "EUR". */
  format?: Intl.NumberFormatOptions | undefined;
  /** Fixed decimals (shortcut for minimum/maximumFractionDigits). */
  decimals?: number | undefined;
  prefix?: unknown | undefined;
  suffix?: unknown | undefined;
  /** `count`: the number counts (default) · `roll`: each digit rolls like an odometer · `none`: the value just changes. */
  mode?: "count" | "roll" | "none" | undefined;
  /** ms (default 1600 for count, 900 for roll). */
  duration?: number | undefined;
  /** Easing of the count (a motion easing name or token, default "expo"). */
  easing?: string | undefined;
  /** Start when visible (default) or at once. */
  start?: "visible" | "now" | undefined;
  class?: ClassProp | undefined;
}

export { formatCount };


/** `<Counter value={12500} />`, `<Counter value={$price} mode="roll" format={EUR} />` (format: Intl.NumberFormat options) */
export function Counter(props: CounterProps): Element {
  const fmt = (n: number): string => formatCount(n, props, locale());
  const rolls = props.mode === "roll";
  const final = signal("");
  let current = props.from ?? 0, started = props.start === "now", tween: { cancel(): void } | null = null;
  // roll mode: CountRoll draws and rolls the digits of `live` (the start value until the counter starts), with this
  // counter's format and its announced final value
  const live = signal(current);
  const text = globalThis.document.createTextNode(fmt(current));
  const shown = rolls
    ? h(CountRoll, { class: "m-counter-view", value: live, formatter: fmt, spoken: () => final(), duration: props.duration ?? 520, stagger: 45 }) as HTMLElement
    : h("span", { class: "m-counter-view", "aria-hidden": "true" }, text) as HTMLElement;
  const root = h("span", { class: () => cx("m-counter", rolls && "m-counter-roll", val(props.class)) },
    props.prefix != null ? h("span", { class: "m-counter-affix" }, props.prefix) : null,
    shown,
    rolls ? null : h("span", { class: "m-sr-only" }, () => final()),
    props.suffix != null ? h("span", { class: "m-counter-affix" }, props.suffix) : null) as HTMLElement;

  const go = (to: number): void => {
    final.set(fmt(to));
    tween?.cancel(); tween = null;
    if (rolls) { current = to; live.set(to); return; }
    if (reducedMotion() || current === to || props.mode === "none") { current = to; text.data = fmt(to); return; }
    tween = animateValue(current, to, { duration: props.duration ?? 1600, easing: props.easing ?? "expo", onUpdate: (v) => { current = v; text.data = fmt(v); } });
  };

  final.set(fmt(untrack(() => val(props.value))));
  effect(() => {
    const to = val(props.value);
    locale();
    if (started) untrack(() => go(to));
  });
  if (!started) onVisible(root, () => { started = true; go(untrack(() => val(props.value))); }, { threshold: 0.4 });
  owned(() => tween?.cancel());
  return root;
}
