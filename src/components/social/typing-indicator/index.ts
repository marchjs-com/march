// TypingIndicator (hadi-march/ui): three dots that lift in turn (motion engine, staggered loop; still with reduced
// motion) and an optional "… is typing" line. A polite status, so screen readers hear who is typing once.
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/animate.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import "./typing-indicator.css";

export interface TypingIndicatorProps {
  /** Who is typing (names). Empty: the indicator hides. @tr Kimlerin yazdığı (adlar). Boşsa gösterge gizlenir. */
  names?: MaybeFn<readonly string[] | undefined>;
  /** bubble: dots in a chat bubble · inline: dots and text in a line. Default bubble. @tr bubble: sohbet balonunda noktalar · inline: bir satırda noktalar ve metin. Varsayılan bubble. */
  variant?: MaybeFn<"bubble" | "inline" | undefined>;
  /** Show the "… is typing" text. Default true for inline, false for bubble (still announced). @tr "… yazıyor" metnini gösterir. Varsayılan inline için true, bubble için false (yine de duyurulur). */
  text?: MaybeFn<boolean | undefined>;
  /** Your own sentence: `(names) => "…"`. Default: typingText ("HADİ is typing…"). @tr Kendi cümleniz: `(names) => "…"`. Varsayılan: typingText ("HADİ yazıyor…"). */
  label?: ((names: readonly string[]) => string) | undefined;
  /** The three dots: true (default), false (text only), or your own node in their place. @tr Üç nokta: true (varsayılan), false (yalnız metin) ya da yerlerine kendi düğümünüz. */
  dots?: boolean | Node | undefined;
  /** How the dots move: lift (default) · fade (no movement, they only light up in turn) · none (still). @tr Noktaların hareketi: lift (varsayılan) · fade (hareket yok, sırayla yanarlar) · none (durgun). */
  motion?: MaybeFn<"lift" | "fade" | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
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
    class: () => cx("m-typing", `m-typing-${val(props.variant) ?? "bubble"}`, !names().length && "is-off", val(props.class)),
    // brand blue unless m:color gives another (the common prop is applied after, on this root)
    "data-m-color": "brand-blue", role: "status", "aria-live": "polite",
  },
  props.dots === false ? null
    : props.dots && props.dots !== true ? h("span", { class: "m-typing-dots is-own", "aria-hidden": "true" }, props.dots)
    : h("span", { class: "m-typing-dots", "aria-hidden": "true" }, [0, 1, 2].map(() => h(StatusDot, { tone: "primary", size: "xs", ref: (x: HTMLElement) => { dots.push(x); } }))),
  h("span", { class: () => cx("m-typing-text", !(val(props.text) ?? val(props.variant) === "inline") && "m-sr-only") }, () => { const list = val(props.names) ?? []; return props.label ? props.label(list) : typingText(list); }));
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
