// StoryRing (march/ui): an Avatar in a ring that tells the story state. new: the four HADİ colors in a sweep ·
// seen: a quiet line · close: friends-only green · none: no ring. As a button it opens the stories; while they load the
// ring turns (motion engine; still with reduced motion). An optional label sits under it (story trays).
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { Avatar } from "../avatar/index.ts";
import { animate } from "../../../motion/animate.ts";
import { withColor } from "../../../theme/colors.ts";
import { CornerMark } from "../../media/corner-mark/index.ts";
import "./story-ring.css";
import type { IconProp } from "../../../icons/types.ts";
import type { Handler } from "../../../core/util.ts";

export type StoryRingState = "new" | "seen" | "close" | "none";

export interface StoryRingProps {
  /** The person's name (avatar initials and accessible name). @tr Kişinin adı (avatar baş harfleri ve erişilebilir ad). */
  name: MaybeFn<string>;
  /** Avatar image address. @tr Avatar resminin adresi. */
  src?: MaybeFn<string | null | undefined>;
  /** new (default: the four HADİ colours) · seen (a quiet line) · close (friends-only green) · none (no ring). @tr new (varsayılan: dört HADİ rengi) · seen (sakin bir çizgi) · close (yalnız yakın arkadaşlar, yeşil) · none (halka yok). */
  state?: MaybeFn<StoryRingState | undefined>;
  /** sm 40 · md 58 · lg 88 px. Default md. @tr sm 40 · md 58 · lg 88 px. Varsayılan md. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Text under the ring (story tray). @tr Halkanın altındaki metin (hikâye şeridi). */
  label?: MaybeFn<string | undefined>;
  /** A small + badge (your own story: add one). @tr Küçük bir + rozeti (kendi hikâyeniz: ekleyin). */
  add?: MaybeFn<boolean | undefined>;
  /** Turns the ring (stories are loading). @tr Halkayı döndürür (hikâyeler yükleniyor). */
  loading?: MaybeFn<boolean | undefined>;
  /** Makes it a button. @tr Onu bir düğme yapar. */
  onClick?: Handler<[e: MouseEvent]> | undefined;
  /** Your own accessible name. Default: "HADİ, new story" / "HADİ, story seen" / the name. @tr Kendi erişilebilir adınız. Varsayılan: "HADİ, yeni hikâye" / "HADİ, hikâye görüldü" / ad. */
  ariaLabel?: MaybeFn<string | undefined>;
  /** Your own content for the + badge. @tr + rozeti için kendi içeriğiniz. */
  addIcon?: IconProp;
  /** Your own node instead of the Avatar (a logo, an image). @tr Avatar yerine kendi düğümünüz (bir logo, bir resim). */
  avatar?: unknown;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<StoryRing name={u.name} src={u.avatar} state={u.seen ? "seen" : "new"} label={u.name} onClick={() => open(u)} />` */
export function StoryRing(props: StoryRingProps): Element {
  let ring!: HTMLElement;
  let spin: ReturnType<typeof animate> | null = null;
  const state = (): StoryRingState => val(props.state) ?? "new";
  const inner = [
    h("span", { class: "m-sring-frame" },
      h("span", { class: "m-sring-ring", "aria-hidden": "true", ref: (x: HTMLElement) => { ring = x; } }),
      h("span", { class: "m-sring-av" }, props.avatar ?? h(Avatar, { name: props.name, src: props.src, size: () => (val(props.size) === "sm" ? "sm" : "lg") })),
      () => (val(props.add) ? withColor(h(CornerMark, { class: "m-sring-add", corner: "bottom-end", variant: "solid", ring: true, size: () => (val(props.size) === "lg" ? "md" : "sm"), icon: props.addIcon ?? plus }), "brand-orange") : null)),
    () => { const l = val(props.label); return l ? h("span", { class: "m-sring-label" }, l) : null; },
  ];
  effect(() => {
    const on = !!val(props.loading);
    untrack(() => {
      spin?.cancel(); spin = null;
      if (on) spin = animate(ring, [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 1100, iterations: Infinity, easing: "linear", essential: true });
    });
  });
  onCleanup(() => spin?.cancel());
  const cls = (): string => cx("m-sring", `m-sring-${val(props.size) ?? "md"}`, `is-${state()}`, val(props.loading) && "is-loading", val(props.class));
  const name = (): string => { const own = val(props.ariaLabel); if (own != null) return own; const s = state(); const n = val(props.name); return s === "new" || s === "close" ? t`${n}, new story` : s === "seen" ? t`${n}, story seen` : n; };
  if (props.onClick) return h("button", { type: "button", class: cls, "aria-label": name, "aria-busy": () => (val(props.loading) ? "true" : null), onClick: (e: MouseEvent) => props.onClick?.(e) }, inner);
  return h("span", { class: cls, role: "img", "aria-label": name }, inner);
}
