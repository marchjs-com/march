// LiveFeed motion presets: how a new item arrives (`enter`) and how the oldest leaves (`leave`). Each preset gives
// keyframes (transform / opacity / filter only: compositor work), a duration and an easing for the motion engine.
// Horizontal movement mirrors in right-to-left text.

export type FeedEnter = "flip" | "slide" | "fade" | "pop" | "drop" | "zoom" | "blur" | "swing" | "unfold" | "glide" | "spin";
export type FeedLeave = "blur" | "fade" | "shrink" | "fall" | "slide" | "dissolve" | "fold";
/** Your own motion: keyframes for the motion engine (`animate(el, keyframes, { duration, easing })`). */
export interface FeedMotion { keyframes: Record<string, unknown[]>; duration?: number; easing?: string }
interface Ctx { wall: boolean; rtl: boolean }

const P = "perspective(800px) ";
/** Enter presets of LiveFeed: name → keyframes, duration and easing for a new item. */
export const FEED_ENTER: Record<FeedEnter, (c: Ctx) => FeedMotion> = {
  // swings down in 3D out of a blur
  flip: (c) => ({ keyframes: { opacity: [0, 1], transform: [`${P}rotateX(-75deg) translateY(-34px)${c.wall ? " scale(.8)" : ""}`, `${P}rotateX(0deg) translateY(0px) scale(1)`], filter: ["blur(10px)", "blur(0px)"] }, duration: 900, easing: "spring" }),
  slide: () => ({ keyframes: { opacity: [0, 1], transform: ["translateY(-28px)", "translateY(0px)"] }, duration: 520, easing: "expo" }),
  fade: () => ({ keyframes: { opacity: [0, 1] }, duration: 600, easing: "out" }),
  // grows past its size and settles
  pop: () => ({ keyframes: { opacity: [0, 1, 1], transform: ["scale(.5)", "scale(1.08)", "scale(1)"] }, duration: 620, easing: "out" }),
  // falls from above and bounces
  drop: () => ({ keyframes: { opacity: [0, 1, 1, 1], transform: ["translateY(-70px)", "translateY(10px)", "translateY(-4px)", "translateY(0px)"] }, duration: 820, easing: "out" }),
  // comes from in front of the screen
  zoom: () => ({ keyframes: { opacity: [0, 1], transform: ["scale(1.5)", "scale(1)"], filter: ["blur(6px)", "blur(0px)"] }, duration: 640, easing: "expo" }),
  // sharpens out of a soft glow
  blur: () => ({ keyframes: { opacity: [0, 1], transform: ["scale(1.06)", "scale(1)"], filter: ["blur(16px) saturate(2)", "blur(0px) saturate(1)"] }, duration: 900, easing: "out" }),
  // hangs from the top edge and swings in
  swing: () => ({ keyframes: { opacity: [0, 1, 1, 1], transform: [`${P}rotateX(-90deg)`, `${P}rotateX(20deg)`, `${P}rotateX(-8deg)`, `${P}rotateX(0deg)`] }, duration: 1000, easing: "out" }),
  // opens from the top like a blind
  unfold: () => ({ keyframes: { opacity: [0, 1], transform: ["scaleY(0)", "scaleY(1)"] }, duration: 560, easing: "expo" }),
  // glides in from the side (the reading start)
  glide: (c) => ({ keyframes: { opacity: [0, 1], transform: [`translateX(${c.rtl ? 60 : -60}px) skewX(${c.rtl ? -8 : 8}deg)`, "translateX(0px) skewX(0deg)"] }, duration: 700, easing: "expo" }),
  // turns once on its axis
  spin: () => ({ keyframes: { opacity: [0, 1], transform: [`${P}rotateY(-180deg) scale(.7)`, `${P}rotateY(0deg) scale(1)`] }, duration: 900, easing: "spring" }),
};

/** Leave presets of LiveFeed: name → keyframes, duration and easing for the item that leaves. */
export const FEED_LEAVE: Record<FeedLeave, (c: Ctx) => FeedMotion> = {
  blur: () => ({ keyframes: { opacity: [1, 0], transform: ["scale(1)", "scale(.72) translateY(12px)"], filter: ["blur(0px)", "blur(8px)"] }, duration: 480, easing: "in" }),
  fade: () => ({ keyframes: { opacity: [1, 0] }, duration: 360, easing: "out" }),
  shrink: () => ({ keyframes: { opacity: [1, 0], transform: ["scale(1)", "scale(.3)"] }, duration: 420, easing: "in" }),
  // tips over and falls away
  fall: (c) => ({ keyframes: { opacity: [1, 0], transform: ["translateY(0px) rotate(0deg)", `translateY(60px) rotate(${c.rtl ? -10 : 10}deg)`] }, duration: 560, easing: "in" }),
  slide: (c) => ({ keyframes: { opacity: [1, 0], transform: ["translateX(0px)", `translateX(${c.rtl ? -80 : 80}px)`] }, duration: 420, easing: "in" }),
  // grows and dissolves into light
  dissolve: () => ({ keyframes: { opacity: [1, 0], transform: ["scale(1)", "scale(1.15)"], filter: ["blur(0px) brightness(1)", "blur(12px) brightness(1.6)"] }, duration: 620, easing: "out" }),
  fold: () => ({ keyframes: { opacity: [1, 0], transform: [`${P}rotateX(0deg)`, `${P}rotateX(90deg)`] }, duration: 460, easing: "in" }),
};

/** Resolve a preset name or a custom motion. */
export const feedMotion = <K extends string>(table: Record<K, (c: Ctx) => FeedMotion>, v: K | FeedMotion | undefined, fallback: K, c: Ctx): FeedMotion =>
  (typeof v === "object" && v ? v : (table[(v ?? fallback) as K] ?? table[fallback])(c));
