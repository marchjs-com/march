// The mask behavior: maskInput() from march/mask as a `use:` action, with the refused-character shake.
import { effect, untrack, getOwner, type Signal } from "../../core/reactive.ts";
import { maskInput, type MaskInputOptions, type MaskController } from "../../mask/input.ts";
import type { MaskSpec } from "../../mask/core.ts";
import { play } from "../../motion/play.ts";
import { still } from "../../motion/engine/parts.ts";

/** Options of the mask behavior: the mask plus maskInput()'s options. */
export interface MaskBehaviorOptions extends MaskInputOptions {
  /** The mask: a pattern, an array, a compiled mask, a preset, or a signal of one (the mask changes with it). */
  mask: MaskSpec | Signal<MaskSpec>;
  /** The short shake when a character is refused: `false` turns it off, a function plays your own (`(el) => …`). */
  motion?: boolean | ((el: HTMLInputElement) => void) | undefined;
  /** Called with the controller (state(), set(), undo(), redo(), setMask()). */
  ref?: ((ctl: MaskController) => void) | undefined;
}

/** The refused-character shake (also TextInput's): a short sideways shake on the compositor. */
export const SHAKE: Keyframe[] = [
  { transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" },
  { transform: "translateX(-2px)" }, { transform: "translateX(0)" },
];

const isSignal = (x: unknown): x is Signal<MaskSpec> => typeof x === "function" && !!(x as { signal?: unknown }).signal;

/** `<input use:mask={"(999) 999 99 99"} />` or `<input use:mask={{ mask: cardNumber(), onChange }} />`; returns the cleanup. */
export function mask(el: HTMLInputElement, arg: MaskSpec | MaskBehaviorOptions | Signal<MaskSpec>): () => void {
  const opts: MaskBehaviorOptions = arg && typeof arg === "object" && !Array.isArray(arg) && "mask" in arg && !("format" in arg)
    ? (arg as MaskBehaviorOptions) : { mask: arg as MaskSpec };
  // a { mask: "…", tokens, … } object is itself a pattern spec (its other keys are pattern options)
  const specOf = (): MaskSpec => {
    const m = opts.mask;
    if (isSignal(m)) return m();
    return typeof m === "string" || Array.isArray(m) ? (opts as unknown as MaskSpec) : m;
  };
  const ctl = maskInput(el, untrack(specOf), {
    ...opts,
    onReject: (text, st) => {
      opts.onReject?.(text, st);
      if (typeof opts.motion === "function") opts.motion(el);
      else if (opts.motion !== false && !still()) play(el, SHAKE, { duration: 260, easing: "out" });
    },
  });
  if (isSignal(opts.mask) && getOwner()) effect(() => { const s = specOf(); untrack(() => ctl.setMask(s)); });
  opts.ref?.(ctl);
  return ctl.destroy;
}
