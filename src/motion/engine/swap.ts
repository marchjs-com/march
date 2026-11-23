// swapTransition(inEl, outEl, "slide", …): the enter / leave pair when one view replaces another. Its users animate
// with the engine for their own effects too, so it plays on the engine directly.
import { animate } from "./playback.ts";
import { still, swapFrames, type SwapKind, type SwapFrames, type SwapOptions } from "./parts.ts";

/**
 * One view replaces another: `inEl` arrives, `outEl` leaves (either may be missing). `kind`: a built-in name, your own
 * `{ enter, leave }` keyframes, a function `(inEl, outEl, dir) => …` that plays its own animation, or "none" / `false`.
 * Resolves when the old view has left (at once when nothing plays): remove or hide it then.
 */
export function swapTransition<E extends Element>(
  inEl: E | null | undefined, outEl: E | null | undefined,
  kind: SwapKind | "none" | false | SwapFrames | ((inEl: E, outEl: E | undefined, dir: 1 | -1) => unknown), o: SwapOptions = {},
): Promise<void> {
  const dir = o.dir ?? 1;
  if (kind === "none" || kind === false || still(o.motion)) return Promise.resolve();
  if (typeof kind === "function") { if (inEl) kind(inEl, outEl ?? undefined, dir); return Promise.resolve(); }
  const s = (o.rtl && (kind === "slide" || kind === "turn") ? -dir : dir) as 1 | -1;
  const f = typeof kind === "string" ? swapFrames(kind, s, o.distance) : kind;
  if (inEl) animate(inEl, f.enter, { duration: o.duration ?? 520, easing: o.easing ?? "expo", ...(o.delay ? { delay: o.delay } : {}) });
  if (!outEl) return Promise.resolve();
  const cls = o.leavingClass === false ? "" : o.leavingClass ?? "is-leaving";
  if (cls) outEl.classList.add(cls);
  return animate(outEl, f.leave, { duration: o.leaveDuration ?? 420, easing: o.leaveEasing ?? "in-out" }).finished.then(() => { if (cls) outEl.classList.remove(cls); });
}
