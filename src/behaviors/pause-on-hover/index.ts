// behaviors/pause-on-hover — something that moves by itself (a live feed, a ticker, a slideshow, a toast timer) holds
// still while the pointer is over it or keyboard focus is inside it, so it can be read and used.
//   const stop = pauseOnHover(feed, (held) => $held = held)
// The module only reports "held or free"; the host pauses its own clock / animation.
import { listen } from "../../core/util.ts";

/** Options of pauseOnHover(). */
export interface PauseOnHoverOptions {
  /** The pointer over the element holds it (default true). */
  hover?: boolean | undefined;
  /** Keyboard focus inside the element holds it (default true). */
  focus?: boolean | undefined;
}

/**
 * Report while the pointer is over `el` or focus is inside it: `onChange(true)` when either starts, `onChange(false)`
 * when both are over (moving focus between two children does not flip it). Returns stop (also run with the current
 * owner). As an action: `<ul use:pauseOnHover={[pauseOnHover, (held) => …]}>`.
 */
export function pauseOnHover(el: Element, onChange: (held: boolean) => void, o: PauseOnHoverOptions = {}): () => void {
  let over = false, inside = false, held = false;
  const sync = (): void => { const v = over || inside; if (v !== held) { held = v; onChange(v); } };
  return listen(el, {
    ...(o.hover === false ? null : { pointerenter: () => { over = true; sync(); }, pointerleave: () => { over = false; sync(); } }),
    ...(o.focus === false ? null : {
      focusin: () => { inside = true; sync(); },
      focusout: (e: FocusEvent) => { if (!el.contains(e.relatedTarget as Node | null)) { inside = false; sync(); } },
    }),
  });
}
