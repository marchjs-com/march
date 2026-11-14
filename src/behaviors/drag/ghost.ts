// The ghost of a drag: a node that follows the pointer in the "drag" layer (above everything, never in body) while a
// pointerDrag session runs. One definition for tab, palette and row drags.
//   const g = dragGhost(card.cloneNode(true), { offset: { x: -dx, y: -dy } });
//   onMove: (p) => g.move(p.clientX, p.clientY)      onEnd: () => g.leave([{ opacity: 1 }, { opacity: 0 }])
import { openLayer } from "../../dom/portal.ts";
import { owned } from "../../ui/observe.ts";
import { setStyle, type MaybeFn } from "../../core/util.ts";
import { animate } from "../../motion/engine/playback.ts";
import { still } from "../../motion/engine/parts.ts";
import type { Frames } from "../../motion/engine/tracks.ts";
import type { Timing } from "../../motion/engine/keyframes.ts";

/** Options of dragGhost(). */
export interface DragGhostOptions {
  /** Where the ghost sits relative to the pointer, px (default 12, 10: below the cursor). A grabbed copy passes minus the grab point. */
  offset?: { x: number; y: number } | undefined;
  /** Keyframes it appears with (default: fades in from 90%); `false`: none. */
  enter?: Frames | false | undefined;
  /** Timing of the appear animation (default 140 ms, "easeOutCubic"). */
  timing?: Timing | undefined;
  /** `false` (or an accessor giving it): the ghost does not animate. */
  motion?: MaybeFn<unknown>;
  /** Overlay scope element the layer opens in (default: the page). */
  scope?: HTMLElement | null | undefined;
}
/** What dragGhost() returns. */
export interface DragGhost {
  /** The ghost node. */
  el: HTMLElement;
  /** Follow the pointer: client coordinates of the event. */
  move(clientX: number, clientY: number): void;
  /** Play `frames` (kept at their end), then remove the ghost; removes at once when motion is off. */
  leave(frames: Frames, timing?: Timing): Promise<void>;
  /** Remove the ghost now. */
  close(): void;
}
/**
 * Show `node` as the ghost of a drag: placed in the "drag" layer, hidden from assistive technology, following
 * `move(x, y)`. It is removed by `close()` / `leave(…)`, and with the owner when the component goes mid-drag.
 * The ghost needs `position: fixed; top: 0; left: 0` in its stylesheet (`left` / `top` are set here).
 */
export function dragGhost(node: HTMLElement, o: DragGhostOptions = {}): DragGhost {
  const off = o.offset ?? { x: 12, y: 10 };
  node.setAttribute("aria-hidden", "true");
  node.removeAttribute("id");
  let closeLayer: (() => void) | null = openLayer("drag", node, o.scope);
  const close = owned((): void => { closeLayer?.(); closeLayer = null; });
  if (o.enter !== false && !still(o.motion)) animate(node, o.enter ?? [{ opacity: 0, scale: ".9" }, { opacity: 1, scale: "1" }], { duration: 140, easing: "easeOutCubic", ...o.timing });
  return {
    el: node,
    move: (x, y) => setStyle(node, { left: `${x + off.x}px`, top: `${y + off.y}px` }),
    leave: (frames, timing) => {
      if (!closeLayer || still(o.motion)) { close(); return Promise.resolve(); }
      return animate(node, frames, { duration: 200, easing: "out", ...timing, fill: "forwards" }).finished.then(close);
    },
    close,
  };
}
