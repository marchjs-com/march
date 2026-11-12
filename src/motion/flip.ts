// FLIP for keyed lists: `<For each={$items} key="id" animate>` — rows that move glide to their new place, new rows
// fade/scale in. Measure (First), apply DOM change, measure (Last), Invert with a transform, Play to none.
import { setFlipHook } from "../dom/for.ts";
import { animate } from "./animate.ts";
import { reducedMotion } from "./env.ts";

export interface FlipOptions { duration?: number; easing?: string; enter?: boolean }

const seen = new WeakSet<Element>();

/** FLIP: measure elements, apply a DOM change, then animate them from their old place to the new one. */
export function flip(elements: Element[], mutate: () => void, raw: unknown = {}): void {
  const o: FlipOptions = raw && typeof raw === "object" ? (raw as FlipOptions) : {};
  if (reducedMotion()) { mutate(); for (const el of elements) seen.add(el); return; }
  const first = new Map<Element, DOMRect>();
  for (const el of elements) if (seen.has(el)) first.set(el, el.getBoundingClientRect());
  mutate();
  for (const el of elements) {
    const a = first.get(el);
    if (!a) {
      seen.add(el);
      if (o.enter !== false) animate(el, [{ opacity: 0, transform: "scale(.97)" }, { opacity: 1, transform: "none" }], { duration: o.duration ?? 200, easing: o.easing ?? "easeOutCubic" });
      continue;
    }
    const b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) continue;
    animate(el, [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: o.duration ?? 260, easing: o.easing ?? "easeOutCubic" });
  }
}

/** Enable `<For animate>` reordering animations (FLIP on the motion engine). */
export function installFlip(): void { setFlipHook(flip); }
