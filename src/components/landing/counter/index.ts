// Counter (hadi-march/landing): an animated number. It counts up when it scrolls into view and glides to every new
// value; `roll` turns each digit like an odometer (the digits that change roll, the rest stay; the same odometer as
// CountRoll: motion/digits.ts). Formatted with
// Intl.NumberFormat for the current locale (grouping, decimals, currency, percent, compact). Screen readers get the
// final value once; the moving digits are hidden from them.
import "./counter.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack, onCleanup, getOwner } from "../../../core/reactive.ts";
import { locale } from "../../../core/i18n.ts";
import { cx, val, onVisible, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { drawDigits, rollDigits } from "../../../motion/digits.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";

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
  /** `count`: the number counts (default) · `roll`: each digit rolls like an odometer. */
  mode?: "count" | "roll" | undefined;
  /** ms (default 1600 for count, 900 for roll). */
  duration?: number | undefined;
  /** Start when visible (default) or at once. */
  start?: "visible" | "now" | undefined;
  class?: ClassProp | undefined;
}

/** Format a number the way Counter shows it. */
export function formatCount(n: number, o: Pick<CounterProps, "format" | "decimals"> = {}, loc = untrack(locale)): string {
  const d = o.decimals;
  return new Intl.NumberFormat(loc, { ...(d != null ? { minimumFractionDigits: d, maximumFractionDigits: d } : { maximumFractionDigits: 0 }), ...o.format }).format(n);
}


/** `<Counter value={12500} />`, `<Counter value={$price} mode="roll" format={EUR} />` (format: Intl.NumberFormat options) */
export function Counter(props: CounterProps): Element {
  const fmt = (n: number): string => formatCount(n, props, locale());
  const shown = h("span", { class: "hm-counter-view", "aria-hidden": "true" }) as HTMLElement;
  const final = signal("");
  const root = h("span", { class: () => cx("hm-counter", props.mode === "roll" && "hm-counter-roll", val(props.class)) },
    props.prefix != null ? h("span", { class: "hm-counter-affix" }, props.prefix) : null,
    shown,
    h("span", { class: "hm-sr-only" }, () => final()),
    props.suffix != null ? h("span", { class: "hm-counter-affix" }, props.suffix) : null) as HTMLElement;

  let current = props.from ?? 0, started = props.start === "now", tween: { cancel(): void } | null = null;
  const text = globalThis.document.createTextNode(fmt(current));

  // roll mode: the shared odometer (motion/digits.ts, also behind CountRoll): only the changed digits roll
  let shownText = fmt(current);
  const roll = (to: number): void => {
    const next = fmt(to);
    if (next !== shownText) { if (reducedMotion()) drawDigits(shown, next); else rollDigits(shown, shownText, next, { up: to >= current, duration: props.duration ?? 520, stagger: 45 }); }
    shownText = next;
  };

  const go = (to: number): void => {
    final.set(fmt(to));
    tween?.cancel(); tween = null;
    if (props.mode === "roll") { roll(to); current = to; return; }
    if (!shown.firstChild) shown.append(text);
    if (reducedMotion() || current === to) { current = to; text.data = fmt(to); return; }
    tween = animateValue(current, to, { duration: props.duration ?? 1600, easing: "expo", onUpdate: (v) => { current = v; text.data = fmt(v); } });
  };

  // first paint: the start value (count) or the start digits (roll) so the width is reserved before it moves
  if (props.mode === "roll") drawDigits(shown, shownText); else shown.append(text);
  final.set(fmt(untrack(() => val(props.value))));
  effect(() => {
    const to = val(props.value);
    locale();
    if (started) untrack(() => go(to));
  });
  if (!started) onVisible(root, () => { started = true; go(untrack(() => val(props.value))); }, { threshold: 0.4 });
  if (getOwner()) onCleanup(() => tween?.cancel());
  return root;
}
