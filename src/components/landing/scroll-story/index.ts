// ScrollStory (hadi-march/landing): scrollytelling. The media column stays pinned while the text steps scroll past;
// the step nearest the middle of the viewport is the active one — its picture cross-fades in (motion engine), the dots
// follow, and with `theme` the whole section takes that step's colour (a CSS transition on the background). On phones
// the pinned media sits at the top with the steps flowing under it.
import "./scroll-story.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack, onCleanup, getOwner } from "../../../core/reactive.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
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
  class?: ClassProp | undefined;
}

/** `<ScrollStory steps={[{ title: "Plan", body: "…", media: <Chart/>, color: "brand-blue" }, …]} />` */
export function ScrollStory(props: ScrollStoryProps): Element {
  const active = signal(0);
  const media = props.steps.map((s, i) => h("div", { class: () => cx("hm-story-media", active() === i && "is-active"), "aria-hidden": () => (active() === i ? null : "true") }, s.media) as HTMLElement);
  const steps = props.steps.map((s, i) => h("article", { class: () => cx("hm-story-step", active() === i && "is-active") },
    h("span", { class: "hm-story-num", "aria-hidden": "true" }, String(i + 1).padStart(2, "0")),
    h("h3", { class: "hm-story-title" }, s.title),
    s.body != null ? h("p", { class: "hm-story-body" }, s.body) : null) as HTMLElement);
  const dots = h("ol", { class: "hm-story-dots", "aria-hidden": "true" }, props.steps.map((_, i) => h("li", { class: () => cx("hm-story-dot", active() === i && "is-active") })));
  const root = h("section", {
    class: cx("hm-story", props.side === "start" && "hm-story-media-start", props.theme !== false && "is-themed", val(props.class)),
    "data-hm-color": () => (props.theme !== false ? colorAttr(props.steps[active()]?.color) : null),
  },
  h("div", { class: "hm-story-pin" }, h("div", { class: "hm-story-stage" }, media), dots),
  h("div", { class: "hm-story-steps" }, steps)) as HTMLElement;

  // the active step: the one whose middle is nearest the viewport middle
  const offScroll = onScrollProgress({ track: root }, () => {
    const mid = (globalThis.innerHeight || 800) / 2;
    let best = 0, dist = Infinity;
    steps.forEach((el, i) => { const r = el.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < dist) { dist = d; best = i; } });
    if (best !== active.peek()) active.set(best);
  });
  if (getOwner()) onCleanup(offScroll);
  let prev = 0;
  effect(() => {
    const i = active();
    untrack(() => {
      props.onStep?.(i);
      if (i === prev || reducedMotion()) { prev = i; return; }
      const dir = i > prev ? 1 : -1;
      const inEl = media[i], outEl = media[prev];
      if (inEl) animate(inEl, { opacity: [0, 1], transform: [`translate3d(0, ${24 * dir}px, 0) scale(.97)`, "translate3d(0, 0, 0) scale(1)"] }, { duration: 620, easing: "expo" });
      if (outEl) animate(outEl, { opacity: [1, 0], transform: ["scale(1)", `translate3d(0, ${-16 * dir}px, 0) scale(.98)`] }, { duration: 420, easing: "out" });
      prev = i;
    });
  });
  return root;
}
