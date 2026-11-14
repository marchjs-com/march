// TypingIndicator (hadi-march/ui): three dots that lift in turn (motion engine, staggered loop; still with reduced
// motion) and an optional "… is typing" line. A polite status, so screen readers hear who is typing once.
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/animate.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
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
  /** Your own sentence: `(names) => "…"`. Default: typingText ("HADİ is typing…"). */
  label?: ((names: readonly string[]) => string) | undefined;
  /** The three dots: true (default), false (text only), or your own node in their place. */
  dots?: boolean | Node | undefined;
  /** How the dots move: lift (default) · fade (no movement, they only light up in turn) · none (still). */
  motion?: MaybeFn<"lift" | "fade" | "none" | undefined>;
  class?: ClassProp;
}

/** The sentence: "HADİ is typing…", "HADİ and Beta are typing…", "3 people are typing…". */
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
    "data-hm-color": () => colorAttr(props.color ?? "brand-blue"), role: "status", "aria-live": "polite",
  },
  props.dots === false ? null
    : props.dots && props.dots !== true ? h("span", { class: "hm-typing-dots is-own", "aria-hidden": "true" }, props.dots)
    : h("span", { class: "hm-typing-dots", "aria-hidden": "true" }, [0, 1, 2].map(() => h(StatusDot, { tone: "primary", size: "xs", ref: (x: HTMLElement) => { dots.push(x); } }))),
  h("span", { class: () => cx("hm-typing-text", !(val(props.text) ?? val(props.variant) === "inline") && "hm-sr-only") }, () => { const list = val(props.names) ?? []; return props.label ? props.label(list) : typingText(list); }));
  effect(() => {
    const on = names().length > 0, kind = val(props.motion) ?? "lift";
    untrack(() => {
      for (const r of runs.splice(0)) r.cancel();
      const up = kind === "fade" ? "translateY(0)" : "translateY(-3px)";
      if (on && kind !== "none") dots.forEach((d, i) => runs.push(animate(d, [
        { transform: "translateY(0)", opacity: 0.45 }, { transform: up, opacity: 1, offset: 0.25 }, { transform: "translateY(0)", opacity: 0.45, offset: 0.5 }, { transform: "translateY(0)", opacity: 0.45 },
      ], { duration: 1100, delay: i * 150, iterations: Infinity, easing: "easeInOutCubic" })));
    });
  });
  onCleanup(() => { for (const r of runs) r.cancel(); });
  return el;
}
