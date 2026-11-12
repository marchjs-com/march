// TypingIndicator (hadi-march/ui): three dots that lift in turn (motion engine, staggered loop; still with reduced
// motion) and an optional "… is typing" line. A polite status, so screen readers hear who is typing once.
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/animate.ts";
import "./typing-indicator.css";

export interface TypingIndicatorProps {
  /** Who is typing (names). Empty: the indicator hides. */
  names?: MaybeFn<readonly string[] | undefined>;
  /** bubble: dots in a chat bubble · inline: dots and text in a line. Default bubble. */
  variant?: MaybeFn<"bubble" | "inline" | undefined>;
  /** Show the "… is typing" text. Default true for inline, false for bubble (still announced). */
  text?: MaybeFn<boolean | undefined>;
  /** Dot color. Default brand-blue. */
  color?: ColorToken | undefined;
  class?: ClassProp;
}

/** The sentence: "Acme is typing…", "Acme and Beta are typing…", "3 people are typing…". */
export function typingText(names: readonly string[]): string {
  if (!names.length) return "";
  if (names.length === 1) return t`${names[0]} is typing…`;
  if (names.length === 2) return t`${names[0]} and ${names[1]} are typing…`;
  return t`${names.length} people are typing…`;
}

/** `<TypingIndicator names={$typing} />` */
export function TypingIndicator(props: TypingIndicatorProps): Element {
  const names = (): readonly string[] => val(props.names) ?? ["…"];
  const dots: HTMLElement[] = [];
  const runs: { cancel(): void }[] = [];
  const el = h("span", {
    class: () => cx("hm-typing", `hm-typing-${val(props.variant) ?? "bubble"}`, !names().length && "is-off", val(props.class)),
    "data-hm-color": colorAttr(props.color ?? "brand-blue"), role: "status", "aria-live": "polite",
  },
  h("span", { class: "hm-typing-dots", "aria-hidden": "true" }, [0, 1, 2].map(() => h("i", { ref: (x: HTMLElement) => { dots.push(x); } }))),
  h("span", { class: () => cx("hm-typing-text", !(val(props.text) ?? val(props.variant) === "inline") && "hm-sr-only") }, () => typingText(val(props.names) ?? [])));
  effect(() => {
    const on = names().length > 0;
    untrack(() => {
      for (const r of runs.splice(0)) r.cancel();
      if (on) dots.forEach((d, i) => runs.push(animate(d, [
        { transform: "translateY(0)", opacity: 0.45 }, { transform: "translateY(-3px)", opacity: 1, offset: 0.25 }, { transform: "translateY(0)", opacity: 0.45, offset: 0.5 }, { transform: "translateY(0)", opacity: 0.45 },
      ], { duration: 1100, delay: i * 150, iterations: Infinity, easing: "easeInOutCubic" })));
    });
  });
  onCleanup(() => { for (const r of runs) r.cancel(); });
  return el;
}
