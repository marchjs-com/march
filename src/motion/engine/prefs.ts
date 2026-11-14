// Reduced-motion preference: the system setting (prefers-reduced-motion, live) and an app/user override.
// No dependencies, so env.ts, config.ts and the clock can all read it without import cycles.
import { signal } from "../../core/reactive.ts";

const mq = typeof globalThis.matchMedia === "function" ? globalThis.matchMedia("(prefers-reduced-motion: reduce)") : null;
const system = signal<boolean>(mq?.matches ?? false);
const override = signal<boolean | null>(null);
mq?.addEventListener?.("change", (e: MediaQueryListEvent) => { system.set(e.matches); mark(); });

/** True when animations should be reduced: the user/app override if set, else the system preference (live). */
export const reducedMotion = (): boolean => { const o = override(); return o ?? system(); };
/** Untracked read for hot paths. */
export const reducedNow = (): boolean => override.peek() ?? system.peek();
/** true / false forces reduced motion on or off; null follows the system again. */
export function setReducedOverride(on: boolean | null): void { override.set(on); mark(); }

/** `<html data-m-reduced>` while reduced: generated keyframe CSS and motion.css follow the user setting too. */
function mark(): void {
  const root = globalThis.document?.documentElement;
  if (!root?.setAttribute) return;
  if (reducedNow()) root.setAttribute("data-m-reduced", ""); else root.removeAttribute("data-m-reduced");
}
mark();
