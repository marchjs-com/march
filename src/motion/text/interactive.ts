// Interactive: characters react to the pointer. Positions ease toward their target on the engine clock (write phase),
// so global speed and "pause all" apply; with reduced motion nothing moves. stop() removes the listeners.
import { run, type TextOptions, type TextAnimation } from "./core.ts";
import { onFrame } from "../engine/clock.ts";
import { reducedNow } from "../engine/prefs.ts";

export interface PointerOptions extends TextOptions {
  /** Reach of the pointer (px). */
  radius?: number;
  /** Largest move (px). */
  strength?: number;
}

function field(el: HTMLElement, o: PointerOptions, sign: 1 | -1): TextAnimation {
  return run(el, o, { keep: true }, (s) => {
    const R = o.radius ?? 120, S = (o.strength ?? 14) * sign;
    const pos = s.parts.map(() => [0, 0] as [number, number]);
    let px = NaN, py = NaN, off: (() => void) | null = null;
    const tick = (_: number, dt: number): void => {
      let moving = false;
      s.parts.forEach((p, i) => {
        const r = p.getBoundingClientRect(), cur = pos[i]!;
        const cx = r.left + r.width / 2 - cur[0], cy = r.top + r.height / 2 - cur[1];
        const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy);
        const f = Number.isFinite(d) && d < R && d > 0 ? (1 - d / R) * S : 0;
        const tx = f ? (dx / d) * f : 0, ty = f ? (dy / d) * f : 0, k = Math.min(1, dt / 90);
        cur[0] += (tx - cur[0]) * k; cur[1] += (ty - cur[1]) * k;
        if (Math.abs(tx - cur[0]) + Math.abs(ty - cur[1]) > 0.05) moving = true;
        p.style.transform = `translate(${cur[0].toFixed(2)}px, ${cur[1].toFixed(2)}px)`;
      });
      if (!moving && !Number.isFinite(px)) { off?.(); off = null; }
    };
    const move = (e: PointerEvent): void => {
      if (reducedNow() && !o.essential) return;
      px = e.clientX; py = e.clientY;
      off ??= onFrame(tick, { phase: "write" });
    };
    const leave = (): void => { px = py = NaN; };
    const area = el.ownerDocument.defaultView ?? globalThis;
    area.addEventListener("pointermove", move as EventListener, { passive: true });
    el.ownerDocument.addEventListener("pointerleave", leave);
    return () => { area.removeEventListener("pointermove", move as EventListener); el.ownerDocument.removeEventListener("pointerleave", leave); off?.(); };
  });
}

/** Characters lean toward the pointer. */
export const magnetic = (el: HTMLElement, o: PointerOptions = {}): TextAnimation => field(el, o, 1);
/** Characters dodge away from the pointer. */
export const repel = (el: HTMLElement, o: PointerOptions = {}): TextAnimation => field(el, o, -1);
