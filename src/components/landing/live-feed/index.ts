// LiveFeed (hadi-march/landing): a living wall. New items slide in at the top (list) or pop into the first cell (wall)
// and the oldest leave, so the page looks inhabited. Items come from `items` (a reactive list, newest first: push from
// a socket or a store) or from `next()`, which the feed calls every `every` ms while it is on screen. The feed pauses
// while the pointer or focus is inside and has a Pause button (WCAG 2.2.2: moving content can be stopped); off screen
// it does not pull. New items are not announced by default (a busy feed would talk over everything): `live="polite"`.
import "./live-feed.css";
import { h } from "../../../dom/h.ts";
import { signal, effect, untrack, onCleanup, getOwner } from "../../../core/reactive.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, val, listen, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import tr from "./tr.ts";

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
  class?: ClassProp | undefined;
}

/** `<LiveFeed next={() => pick(pool)} every={2000} />`, `<LiveFeed items={$events} max={6} variant="wall" />` */
export function LiveFeed(props: LiveFeedProps): Element {
  const max = (): number => Math.max(1, props.max ?? 5);
  const paused = signal(false), hovering = signal(false), visible = signal(false);
  const shown: FeedItem[] = [];
  const nodes = new Map<FeedItem["id"], HTMLElement>();
  const wall = (): boolean => props.variant === "wall";

  const card = (it: FeedItem): HTMLElement => h("li", { class: "hm-lf-item", "data-hm-color": colorAttr(it.color) },
    it.avatar != null ? h("span", { class: "hm-lf-avatar", "aria-hidden": "true" }, it.avatar) : h("span", { class: "hm-lf-dot", "aria-hidden": "true" }),
    h("span", { class: "hm-lf-text" }, h("span", { class: "hm-lf-title" }, it.title), it.body != null ? h("span", { class: "hm-lf-body" }, it.body) : null),
    it.meta != null ? h("span", { class: "hm-lf-meta" }, it.meta) : null) as HTMLElement;

  const list = h("ul", { class: "hm-lf-list", role: "list", "aria-live": () => (props.live === "polite" && !paused() ? "polite" : "off"), "aria-relevant": "additions" }) as HTMLElement;

  // show one item at the top: it slides (list) or pops (wall) in; the oldest beyond `max` fades out and leaves
  const add = (it: FeedItem, animated: boolean): void => {
    if (nodes.has(it.id)) return;
    const el = card(it);
    shown.unshift(it); nodes.set(it.id, el);
    list.prepend(el);
    const motion = animated && !reducedMotion();
    if (motion) animate(el, wall()
      ? { opacity: [0, 1], transform: ["scale(.9)", "scale(1)"] }
      : { opacity: [0, 1], transform: ["translateY(-14px)", "translateY(0px)"] }, { duration: 460, easing: "spring" });
    while (shown.length > max()) {
      const old = shown.pop()!, oldEl = nodes.get(old.id)!;
      nodes.delete(old.id);
      if (!motion) { oldEl.remove(); continue; }
      oldEl.classList.add("is-leaving");
      void animate(oldEl, { opacity: [1, 0] }, { duration: 260, easing: "out", fill: "forwards" }).finished.then(() => oldEl.remove());
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
  let acc = 0;
  const next = props.next;
  const pull = (): void => { const it = next?.(); if (it) add(it, true); };
  if (next) {
    // start nearly full: a wall of cards (max − 1), a few rows (up to 3)
    const start = wall() ? max() - 1 : Math.min(max(), 3);
    for (let i = 0; i < start; i++) { const it = next(); if (it) add(it, false); }
    let stop: (() => void) | null = null;
    effect(() => {
      const run = visible() && !paused() && !hovering();
      if (run && !stop) stop = onFrame((_t, dt) => { acc += dt; if (acc >= (props.every ?? 2400)) { acc = 0; pull(); } });
      else if (!run && stop) { stop(); stop = null; }
    });
    if (getOwner()) onCleanup(() => stop?.());
  }

  const pause = props.pausable === false ? null : h("button", {
    type: "button", class: "hm-lf-pause", "aria-pressed": () => String(paused()), onClick: () => paused.set(!paused.peek()),
  }, h("span", { class: () => cx("hm-lf-pulse", paused() && "is-off"), "aria-hidden": "true" }), () => (paused() ? t`Paused · resume` : t`Live · pause`));

  const root = h("section", { class: () => cx("hm-lf", wall() ? "hm-lf-wall" : "hm-lf-rows", val(props.class)), "aria-label": () => props.label ?? t`Live activity` },
    pause, list) as HTMLElement;

  listen(root, {
    pointerenter: () => hovering.set(true), pointerleave: () => hovering.set(false),
    focusin: () => hovering.set(true), focusout: (e: FocusEvent) => { if (!root.contains(e.relatedTarget as Node | null)) hovering.set(false); },
  });
  const IO = globalThis.IntersectionObserver;
  if (IO) {
    const io = new IO((es) => visible.set(es.some((e) => e.isIntersecting)));
    io.observe(root);
    if (getOwner()) onCleanup(() => io.disconnect());
  } else visible.set(true);
  return root;
}
