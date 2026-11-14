// CountRoll (hadi-march/ui): a number that rolls when it changes. Only the digits that changed move, upward when the
// value grows and downward when it shrinks (an odometer), on the motion engine. Compact by default (1,2 B / 12K) in the
// active locale; screen readers get the full value once, never the moving pieces. The rolling is motion/digits.ts
// (shared with the landing Counter).
import { effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { formatCount } from "../../../ui/format.ts";
import { drawDigits, rollDigits } from "../../../motion/digits.ts";
import "./count-roll.css";

export interface CountRollProps {
  value: MaybeFn<number | null | undefined>;
  /** compact: 1,2 B · full: 1.234 (grouped). Default compact. */
  format?: MaybeFn<"compact" | "full" | undefined>;
  /** Hide at 0 (an empty count next to an icon). */
  hideZero?: MaybeFn<boolean | undefined>;
  /** Roll duration (ms). Default 320. */
  duration?: number | undefined;
  /** Your own visible text for a value: `(n) => "1.2k likes"` (screen readers still get the full number). */
  formatter?: ((n: number) => string) | undefined;
  /** Roll on change. Default true; false swaps the digits at once. */
  roll?: MaybeFn<boolean | undefined>;
  /** Delay between neighbouring digits (ms). Default 24. */
  stagger?: number | undefined;
  class?: ClassProp;
}

export { formatCount };

/** `<CountRoll value={$likes} />` */
export function CountRoll(props: CountRollProps): Element {
  let box!: HTMLElement;
  let prev: number | null = null, shown = "";
  const text = (n: number): string => (n === 0 && val(props.hideZero) ? "" : props.formatter ? props.formatter(n) : formatCount(n, val(props.format) ?? "compact"));
  const root = h("span", { class: () => cx("hm-roll", val(props.class)) },
    h("span", { class: "hm-roll-vis", "aria-hidden": "true", ref: (x: HTMLElement) => { box = x; } }),
    h("span", { class: "hm-sr-only" }, () => { const n = val(props.value); return n == null || (n === 0 && val(props.hideZero)) ? "" : formatCount(n, "full"); })) as HTMLElement;
  effect(() => {
    const n = Number(val(props.value) ?? 0);
    val(props.format); val(props.hideZero);
    untrack(() => {
      const next = text(n);
      // first paint, a detached box, `roll={false}` or a new format of the same value: draw; a new value: roll
      if (prev === null || !box.isConnected || val(props.roll) === false || n === prev) { if (prev === null || shown !== next) drawDigits(box, next); }
      else if (shown !== next) rollDigits(box, shown, next, { up: n >= prev, duration: props.duration ?? 320, ...(props.stagger != null ? { stagger: props.stagger } : {}) });
      prev = n; shown = next;
    });
  });
  return root;
}
