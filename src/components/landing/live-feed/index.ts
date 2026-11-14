// LiveFeed (hadi-march/landing): a living wall. New items slide in at the top (list) or pop into the first cell (wall)
// and the oldest leave, so the page looks inhabited. Items come from `items` (a reactive list, newest first: push from
// a socket or a store) or from `next()`, which the feed calls every `every` ms while it is on screen. It starts full and
// keeps its size: a leaving item is lifted out of the flow while it fades, wall cards have one height (no layout shift). The feed pauses
// while the pointer or focus is inside and has a Pause button (WCAG 2.2.2: moving content can be stopped); off screen
// it does not pull. New items are not announced by default (a busy feed would talk over everything): `live="polite"`.
import "./live-feed.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack, createRoot, getOwner } from "../../../core/reactive.ts";
import { t, dir, messages } from "../../../core/i18n.ts";
import { cx, val, setStyle, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned, whenVisible } from "../../../ui/observe.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { Avatar } from "../../social/avatar/index.ts";
import { Button } from "../../actions/button/index.ts";
import { pauseOnHover } from "../../../behaviors/pause-on-hover/index.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { flip } from "../../../motion/flip.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { FEED_ENTER, FEED_LEAVE, feedMotion, type FeedEnter, type FeedLeave, type FeedMotion } from "./presets.ts";
import tr from "./tr.ts";

export { FEED_ENTER, FEED_LEAVE, type FeedEnter, type FeedLeave, type FeedMotion };

messages("tr", tr);

export interface FeedItem {
  id: string | number;
  /** The line: "Elif joined Kadıköy evening run". */
  title: unknown;
  body?: unknown | undefined;
  /** Initials or a short label in the round badge. */
  avatar?: unknown | undefined;
  /** Small text at the end: "now", "2 min". */
  meta?: unknown | undefined;
  /** Badge colour. */
  color?: ColorToken | undefined;
}
export interface LiveFeedProps {
  /** The items, newest first (reactive: a new first item slides in). */
  items?: MaybeFn<FeedItem[]> | undefined;
  /** Pull one new item; called every `every` ms while the feed is visible and not paused. */
  next?: (() => FeedItem | null | undefined) | undefined;
  /** ms between `next()` calls (default 2400). */
  every?: number | undefined;
  /** ms before the first `next()` call (default: `every`); a short one shows the motion at once. */
  first?: number | undefined;
  /** Items kept on screen (default 5). */
  max?: number | undefined;
  /** `list` (default): rows, newest on top · `wall`: a grid of cards. */
  variant?: "list" | "wall" | undefined;
  /** Accessible name of the feed (default "Live activity"). */
  label?: string | undefined;
  /** Announce new items to screen readers (default "off"). */
  live?: "off" | "polite" | undefined;
  /** Show the pause button (default true). */
  pausable?: boolean | undefined;
  /** Text of the pause button while the feed runs (default "Live · pause"). */
  pauseLabel?: unknown | undefined;
  /** Text of the pause button while the feed is paused (default "Paused · resume"). */
  resumeLabel?: unknown | undefined;
  /** The pulsing dot in the pause button (default true). */
  pulse?: boolean | undefined;
  /** Pause while the pointer or keyboard focus is inside the feed (default true). */
  pauseOnHover?: boolean | undefined;
  /** Draw an item yourself: the content of its row / card (the feed keeps the list item, its motion and the glow). */
  renderItem?: ((item: FeedItem) => unknown) | undefined;
  /** How a new item arrives: flip (default), slide, fade, pop, drop, zoom, blur, swing, unfold, glide, spin, "none", or your own keyframes. */
  enter?: FeedEnter | "none" | FeedMotion | undefined;
  /** How the oldest item leaves: blur (default), fade, shrink, fall, slide, dissolve, fold, "none", or your own keyframes. */
  leave?: FeedLeave | "none" | FeedMotion | undefined;
  /** Accent ring that glows around a new item and fades (default true). */
  glow?: boolean | undefined;
  /** The others glide to their new place (default true); false: they jump. */
  move?: boolean | undefined;
  class?: ClassProp | undefined;
}

/** `<LiveFeed next={() => pick(pool)} every={2000} />`, `<LiveFeed items={$events} max={6} variant="wall" />` */
export function LiveFeed(props: LiveFeedProps): Element {
  const max = (): number => Math.max(1, props.max ?? 5);
  const paused = signal(false), hovering = signal(false), visible = signal(false);
  const shown: FeedItem[] = [];
  const nodes = new Map<FeedItem["id"], HTMLElement>();
  const wall = (): boolean => props.variant === "wall";

  const render = props.renderItem;
  // an item is a ListRow (round badge or dot, title, body, meta) or your own content; the glow ring lies over either
  // each item lives in its own scope under the feed (not under the effect or the clock tick that added it) and is
  // disposed when it leaves
  const owner = getOwner();
  const scopes = new WeakMap<HTMLElement, () => void>();
  const gone = (el: HTMLElement): void => { el.remove(); scopes.get(el)?.(); };
  const card = (it: FeedItem): HTMLElement => createRoot((dispose) => {
    const el = (render
      ? h("li", { class: "m-lf-item m-lf-own", "data-m-color": colorAttr(it.color) }, render(it))
      : h(ListRow, {
        as: "li", class: "m-lf-item", color: it.color, overflow: "ellipsis", title: it.title, sub: it.body ?? undefined, trail: it.meta ?? undefined,
        lead: it.avatar != null
          ? h(Avatar, { class: "m-lf-avatar", decorative: true, color: it.color ?? "primary", ...(typeof it.avatar === "string" ? { text: it.avatar } : {}) }, typeof it.avatar === "string" ? undefined : it.avatar)
          : h(StatusDot, { class: "m-lf-dot", size: "lg", tone: "primary", color: it.color }),
      })) as HTMLElement;
    el.append(h("span", { class: "m-lf-glow", "aria-hidden": "true" }) as Node);
    scopes.set(el, dispose);
    return el;
  }, owner);

  const list = h("ul", { class: "m-lf-list", role: "list", "aria-live": () => (props.live === "polite" && !paused() ? "polite" : "off"), "aria-relevant": "additions" }) as HTMLElement;

  // one item arrives at the top with the `enter` motion (default: it swings down in 3D out of a blur), a ring of the accent
  // colour glows around it and fades, its avatar springs in; the others glide one place on (FLIP); the oldest beyond
  // `max` leaves with the `leave` motion (default: it shrinks into a blur)
  const add = (it: FeedItem, animated: boolean): void => {
    if (nodes.has(it.id)) return;
    const el = card(it);
    const motion = animated && !reducedMotion();
    const drop = Math.max(0, shown.length + 1 - max());
    const leaving = shown.slice(shown.length - drop).map((x) => nodes.get(x.id)!);
    const staying = shown.slice(0, shown.length - drop).map((x) => nodes.get(x.id)!);
    // a leaving item is lifted out of the flow where it stands, so the list never grows while it fades (no layout shift)
    const at = motion ? list.getBoundingClientRect() : null;
    const boxes = motion ? leaving.map((x) => x.getBoundingClientRect()) : [];
    const mutate = (): void => {
      shown.unshift(it); nodes.set(it.id, el); list.prepend(el);
      for (let i = 0; i < drop; i++) nodes.delete(shown.pop()!.id);
      leaving.forEach((old, k) => {
        if (!motion || !at || props.leave === "none") { gone(old); return; }
        const b = boxes[k]!;
        old.classList.add("is-leaving");
        setStyle(old, { top: `${b.top - at.top}px`, left: `${b.left - at.left}px`, width: `${b.width}px`, height: `${b.height}px` });
      });
    };
    if (!motion) { mutate(); return; }
    if (props.move === false) mutate(); else flip(staying, mutate, { enter: false, duration: 680, easing: "expo" });
    flip([el], () => {}, { enter: false });
    const ctx = { wall: wall(), rtl: untrack(dir) === "rtl" };
    const glow = el.querySelector(".m-lf-glow"), avatar = el.querySelector(".m-lf-avatar, .m-lf-dot");
    if (props.enter !== "none") {
      const inn = feedMotion(FEED_ENTER, props.enter, "flip", ctx);
      animate(el, inn.keyframes as never, { duration: inn.duration ?? 700, easing: inn.easing ?? "out" });
      if (avatar) animate(avatar, { transform: ["scale(0) rotate(-40deg)", "scale(1.18) rotate(8deg)", "scale(1) rotate(0deg)"] }, { duration: 760, delay: 160, easing: "out" });
    }
    if (glow && props.glow !== false) animate(glow, { opacity: [0, 1, 0], transform: ["scale(.96)", "scale(1.02)", "scale(1)"] }, { duration: 2200, easing: "out" });
    if (props.leave === "none") return;
    const out = feedMotion(FEED_LEAVE, props.leave, "blur", ctx);
    for (const old of leaving) {
      void animate(old, out.keyframes as never, { duration: out.duration ?? 450, easing: out.easing ?? "in", fill: "forwards" })
        .finished.then(() => gone(old));
    }
  };

  // controlled list: draw what is there, then slide in every new head
  if (props.items !== undefined) {
    let first = true;
    effect(() => {
      const xs = val(props.items) ?? [];
      untrack(() => {
        const fresh = xs.slice(0, max()).filter((x) => !nodes.has(x.id)).reverse();
        for (const x of fresh) add(x, !first);
        first = false;
      });
    });
  }

  // pulled items: one per `every` ms of clock time while visible, not paused and not hovered
  // read once: a JSX prop is a getter, and `next={source()}` would build a new source on every read
  let acc = Math.max(0, (props.every ?? 2400) - (props.first ?? props.every ?? 2400));
  const next = props.next;
  const pull = (): void => { const it = next?.(); if (it) add(it, true); };
  if (next) {
    // start full: the feed has its final size from the first paint and never grows (no layout shift)
    const start = max();
    for (let i = 0; i < start; i++) { const it = next(); if (it) add(it, false); }
    let stop: (() => void) | null = null;
    effect(() => {
      const run = visible() && !paused() && !hovering();
      if (run && !stop) stop = onFrame((_t, dt) => { acc += dt; if (acc >= (props.every ?? 2400)) { acc = 0; pull(); } });
      else if (!run && stop) { stop(); stop = null; }
    });
    owned(() => stop?.());
  }

  // the pause toggle: a pill Button whose dot pulses while the feed is live
  const pause = props.pausable === false ? null : h(Button, {
    class: "m-lf-pause", size: "sm", shape: "pill", pressed: () => paused(), onClick: () => paused.set(!paused.peek()),
    icon: props.pulse === false ? undefined : h(StatusDot, { class: "m-lf-pulse", tone: () => (paused() ? "neutral" : "success"), pulse: () => !paused() }),
  }, () => (paused() ? props.resumeLabel ?? t`Paused · resume` : props.pauseLabel ?? t`Live · pause`));

  const root = h("section", { class: () => cx("m-lf", wall() ? "m-lf-wall" : "m-lf-rows", val(props.class)), "aria-label": () => props.label ?? t`Live activity` },
    pause, list) as HTMLElement;

  if (props.pauseOnHover !== false) pauseOnHover(root, (held) => hovering.set(held));
  whenVisible(root, (v) => visible.set(v));
  return root;
}
