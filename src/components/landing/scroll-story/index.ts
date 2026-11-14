// ScrollStory (hadi-march/landing): scrollytelling. The media column stays pinned while the text steps scroll past;
// the step nearest the middle of the viewport is the active one — its picture cross-fades in (motion engine), the dots
// follow, and with `theme` the whole section takes that step's colour (a CSS transition on the background). When the
// section is narrow (under 820 px of its own width: a phone, a narrow column) nothing is pinned: every step is a card
// with its own picture above its text, so the picture and its words are always seen together.
import "./scroll-story.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack } from "../../../core/reactive.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { owned, observeSize } from "../../../ui/observe.ts";
import { swapTransition } from "../../../motion/engine/parts.ts";
import { PageDots } from "../../navigation/page-dots/index.ts";
import { onScrollProgress } from "../../../motion/scroll-fx.ts";

export interface StoryStep {
  title: unknown;
  body?: unknown;
  /** The pinned picture for this step (an image, a chart, a UI fragment). */
  media: unknown;
  /** Section colour while this step is active (theme). */
  color?: ColorToken | undefined;
}
export interface ScrollStoryProps {
  steps: readonly StoryStep[];
  /** Media column side (default end). */
  side?: "start" | "end" | undefined;
  /** Tint the section with the active step's colour (default true). */
  theme?: boolean | undefined;
  /** Called when the active step changes. */
  onStep?: ((index: number) => void) | undefined;
  /** The dots under the pinned picture (default true). */
  dots?: boolean | undefined;
  /** The step number above each title: true (default: "01"), false, or `(index) => node`. */
  numbers?: boolean | ((index: number) => unknown) | undefined;
  /** How the pinned picture changes: "rise" (default), "fade", "none", or your own `(incoming, outgoing, direction) => void` (direction 1 = scrolling down). */
  transition?: "rise" | "fade" | "none" | ((incoming: HTMLElement, outgoing: HTMLElement | undefined, direction: 1 | -1) => void) | undefined;
  class?: ClassProp | undefined;
}

/** `<ScrollStory steps={[{ title: "Plan", body: "…", media: <Chart/>, color: "brand-blue" }, …]} />` */
export function ScrollStory(props: ScrollStoryProps): Element {
  const active = signal(0);
  const stacked = signal(false);
  const media = props.steps.map((s, i) => h("div", { class: () => cx("hm-story-media", active() === i && "is-active"), "aria-hidden": () => (stacked() || active() === i ? null : "true") }, s.media) as HTMLElement);
  const slots = props.steps.map(() => h("div", { class: "hm-story-inline" }) as HTMLElement);
  const steps = props.steps.map((s, i) => h("article", { class: () => cx("hm-story-step", active() === i && "is-active") },
    slots[i],
    props.numbers === false ? null : h("span", { class: "hm-story-num", "aria-hidden": "true" }, typeof props.numbers === "function" ? props.numbers(i) : String(i + 1).padStart(2, "0")),
    h("h3", { class: "hm-story-title" }, s.title),
    s.body != null ? h("p", { class: "hm-story-body" }, s.body) : null) as HTMLElement);
  const dots = props.dots === false ? null : h(PageDots, { class: "hm-story-dots", count: props.steps.length, value: active, decorative: true });
  const root = h("section", {
    class: cx("hm-story", props.side === "start" && "hm-story-media-start", props.theme !== false && "is-themed", val(props.class)),
    "data-hm-color": () => (props.theme !== false ? colorAttr(props.steps[active()]?.color) : null),
  },
  h("div", { class: "hm-story-pin" }, h("div", { class: "hm-story-stage" }, media), dots),
  h("div", { class: "hm-story-steps" }, steps)) as HTMLElement;

  // narrow (by the section's own width): each picture moves into its step card; wide: back into the pinned stage
  const stage = root.querySelector(".hm-story-stage") as HTMLElement;
  observeSize(root, () => { const n = root.clientWidth > 0 && root.clientWidth < 820; if (n !== stacked.peek()) stacked.set(n); });
  effect(() => {
    const n = stacked();
    root.classList.toggle("is-stacked", n);
    media.forEach((m, i) => (n ? slots[i]!.appendChild(m) : stage.appendChild(m)));
  });

  // the active step: the one whose middle is nearest the viewport middle
  owned(onScrollProgress({ track: root }, () => {
    const mid = (globalThis.innerHeight || 800) / 2;
    let best = 0, dist = Infinity;
    steps.forEach((el, i) => { const r = el.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < dist) { dist = d; best = i; } });
    if (best !== active.peek()) active.set(best);
  }));
  let prev = 0;
  effect(() => {
    const i = active();
    untrack(() => {
      props.onStep?.(i);
      const from = prev;
      prev = i;
      // stacked: every picture is shown in its own card, nothing cross-fades
      if (i === from || stacked.peek()) return;
      const tr = props.transition ?? "rise", fade = tr === "fade";
      void swapTransition(media[i], media[from], tr, { dir: i > from ? 1 : -1, duration: fade ? 520 : 620, easing: fade ? "out" : "expo", leaveDuration: 420, leaveEasing: "out", leavingClass: false });
    });
  });
  return root;
}
