// StoryRing (hadi-march/ui): an Avatar in a ring that tells the story state. new: the four HADİ colors in a sweep ·
// seen: a quiet line · close: friends-only green · none: no ring. As a button it opens the stories; while they load the
// ring turns (motion engine; still with reduced motion). An optional label sits under it (story trays).
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { Avatar } from "../avatar/index.ts";
import { animate } from "../../../motion/animate.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { CornerMark } from "../../media/corner-mark/index.ts";
import "./story-ring.css";

export type StoryRingState = "new" | "seen" | "close" | "none";

export interface StoryRingProps {
  name: MaybeFn<string>;
  src?: MaybeFn<string | null | undefined>;
  state?: MaybeFn<StoryRingState | undefined>;
  /** sm 40 · md 58 · lg 88 px. Default md. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Text under the ring (story tray). */
  label?: MaybeFn<string | undefined>;
  /** A small + badge (your own story: add one). */
  add?: MaybeFn<boolean | undefined>;
  /** Turns the ring (stories are loading). */
  loading?: MaybeFn<boolean | undefined>;
  /** Makes it a button. */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** Your own accessible name. Default: "HADİ, new story" / "HADİ, story seen" / the name. */
  ariaLabel?: MaybeFn<string | undefined>;
  /** One color for the ring of a new / close story instead of the sweep. */
  color?: MaybeFn<ColorToken | undefined>;
  /** Your own content for the + badge. */
  addIcon?: unknown;
  /** Your own node instead of the Avatar (a logo, an image). */
  avatar?: unknown;
  class?: ClassProp;
}

/** `<StoryRing name={u.name} src={u.avatar} state={u.seen ? "seen" : "new"} label={u.name} onClick={() => open(u)} />` */
export function StoryRing(props: StoryRingProps): Element {
  let ring!: HTMLElement;
  let spin: ReturnType<typeof animate> | null = null;
  const state = (): StoryRingState => val(props.state) ?? "new";
  const inner = [
    h("span", { class: "hm-sring-frame" },
      h("span", { class: "hm-sring-ring", "aria-hidden": "true", ref: (x: HTMLElement) => { ring = x; } }),
      h("span", { class: "hm-sring-av" }, props.avatar ?? h(Avatar, { name: props.name, src: props.src, size: () => (val(props.size) === "sm" ? "sm" : "lg") })),
      () => (val(props.add) ? h(CornerMark, { class: "hm-sring-add", corner: "bottom-end", variant: "solid", color: "brand-orange", ring: true, size: () => (val(props.size) === "lg" ? "md" : "sm"), icon: props.addIcon ?? plus }) : null)),
    () => { const l = val(props.label); return l ? h("span", { class: "hm-sring-label" }, l) : null; },
  ];
  effect(() => {
    const on = !!val(props.loading);
    untrack(() => {
      spin?.cancel(); spin = null;
      if (on) spin = animate(ring, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 1100, iterations: Infinity, easing: "linear", essential: true });
    });
  });
  onCleanup(() => spin?.cancel());
  const cls = (): string => cx("hm-sring", `hm-sring-${val(props.size) ?? "md"}`, `is-${state()}`, val(props.loading) && "is-loading", val(props.class));
  const name = (): string => { const own = val(props.ariaLabel); if (own != null) return own; const s = state(); const n = val(props.name); return s === "new" || s === "close" ? t`${n}, new story` : s === "seen" ? t`${n}, story seen` : n; };
  const color = (): string | null => colorAttr(val(props.color));
  if (props.onClick) return h("button", { type: "button", class: cls, "data-hm-color": color, "aria-label": name, "aria-busy": () => (val(props.loading) ? "true" : null), onClick: (e: MouseEvent) => props.onClick?.(e) }, inner);
  return h("span", { class: cls, "data-hm-color": color, role: "img", "aria-label": name }, inner);
}
