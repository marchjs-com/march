// CountRoll (hadi-march/ui): a number that rolls when it changes. Only the digits that changed move, upward when the
// value grows and downward when it shrinks (an odometer), on the motion engine. Compact by default (1,2 B / 12K) in the
// active locale; screen readers get the full value once, never the moving pieces.
import { effect, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { animate } from "../../../motion/animate.ts";
import "./count-roll.css";

export interface CountRollProps {
  value: MaybeFn<number | null | undefined>;
  /** compact: 1,2 B · full: 1.234 (grouped). Default compact. */
  format?: MaybeFn<"compact" | "full" | undefined>;
  /** Hide at 0 (an empty count next to an icon). */
  hideZero?: MaybeFn<boolean | undefined>;
  /** Roll duration (ms). Default 320. */
  duration?: number | undefined;
  class?: ClassProp;
}

/** The text a count shows: `formatCount(1234)` → "1,2 B" (tr) / "1.2K" (en). */
export function formatCount(n: number, format: "compact" | "full" = "compact"): string {
  return format === "full" || Math.abs(n) < 1000 ? applyPipe("number", n, 0) : applyPipe("compact", n);
}

/** `<CountRoll value={$likes} />` */
export function CountRoll(props: CountRollProps): Element {
  let box!: HTMLElement;
  let prev: number | null = null;
  const text = (n: number): string => (n === 0 && val(props.hideZero) ? "" : formatCount(n, val(props.format) ?? "compact"));
  const cell = (ch: string): HTMLElement => h("span", { class: /\d/.test(ch) ? "hm-roll-d" : "hm-roll-s" }, ch) as HTMLElement;
  const draw = (s: string): void => { box.replaceChildren(...[...s].map(cell)); };
  const roll = (from: string, to: string, up: boolean): void => {
    const a = [...from], b = [...to], dur = props.duration ?? 320;
    // align from the end (units stay under units); a changed length rolls every digit
    const same = a.length === b.length;
    box.replaceChildren(...b.map((ch, i) => {
      const old = same ? a[i] : undefined;
      const el = cell(ch);
      if (old === ch) return el;
      const slot = h("span", { class: "hm-roll-slot" }, el) as HTMLElement;
      if (old !== undefined) {
        const ghost = h("span", { class: "hm-roll-ghost" }, old) as HTMLElement;
        slot.append(ghost);
        const out = animate(ghost, [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${up ? -100 : 100}%)`, opacity: 0 }], { duration: dur, easing: "easeOutCubic", fill: "forwards", delay: (b.length - 1 - i) * 24 });
        void out.finished.then(() => ghost.remove());
      }
      animate(el, [{ transform: `translateY(${up ? 100 : -100}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: dur, easing: "easeOutBack", fill: "backwards", delay: (b.length - 1 - i) * 24 });
      return slot;
    }));
  };
  const root = h("span", { class: () => cx("hm-roll", val(props.class)) },
    h("span", { class: "hm-roll-vis", "aria-hidden": "true", ref: (x: HTMLElement) => { box = x; } }),
    h("span", { class: "hm-sr-only" }, () => { const n = val(props.value); return n == null || (n === 0 && val(props.hideZero)) ? "" : formatCount(n, "full"); })) as HTMLElement;
  effect(() => {
    const n = Number(val(props.value) ?? 0);
    val(props.format); val(props.hideZero);
    untrack(() => {
      const next = text(n);
      if (prev === null || !box.isConnected) draw(next);
      else { const was = text(prev); if (was !== next) roll(was, next, n >= prev); }
      prev = n;
    });
  });
  return root;
}
