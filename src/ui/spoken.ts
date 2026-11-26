// What a meter tells a screen reader, at most a few times a second: a live value (a needle, a sensor, a loudness
// reading) changes every frame, and announcing each change would flood the reader. One form for every meter.
//   const spoken = throttled(() => value())   →  aria-valuenow / aria-valuetext read spoken()
import { signal, effect, untrack, getOwner, runWithOwner, type Accessor } from "../core/reactive.ts";
import { later } from "../core/util.ts";

/** `fn`'s value, updated at most every `ms` (default 250: four times a second); the last change always arrives. */
export function throttled<T>(fn: () => T, ms = 250): Accessor<T> {
  const out = signal(untrack(fn)), owner = getOwner();
  let pending = false;
  effect(() => {
    fn();
    if (pending) return;
    pending = true;
    runWithOwner(owner, () => later(() => { pending = false; out.set(untrack(fn)); }, ms));
  });
  return out;
}
