// The motion of an LED face (internal, shared by LedEyes and LedBoard's eye scenes): the gaze spring, blinks, the alive
// glances, the talking mouth and pointer following, all on the motion engine's clock; and the words for an expression.
import { signal, computed, effect, onCleanup, untrack } from "../../../core/reactive.ts";
import { on, clamp } from "../../../ui/util.ts";
import { t } from "../../../core/i18n.ts";
import { onFrame, now, measure } from "../../../motion/engine/clock.ts";
import { watchVisibility } from "../../../motion/engine/visibility.ts";
import { expressionState, eyeVec, vecEye, type EyeExpression, type MouthShape, type EyeState } from "./eyes.ts";

/** What makes a face move: the parts LedEyes and LedBoard's eye scenes share. */
export interface FaceInput {
  expression: () => EyeExpression | undefined;
  look: () => { x?: number | undefined; y?: number | undefined } | undefined;
  mouth: () => MouthShape | undefined;
  alive: () => boolean;
  follow: () => boolean;
  blinkEvery: () => readonly [number, number] | undefined;
  still: () => boolean;
}
/** A moving face: its state now, how open a talking mouth is, and a blink on demand. */
export interface FaceMotion { state: () => EyeState; talk: () => number; blink(): void }

/** The motion of a face shown in `host` (blinks, glances, the gaze spring, the talking mouth, pointer following). */
export function faceMotion(host: Element, p: FaceInput): FaceMotion {
  const glance = signal<{ x: number; y: number } | null>(null), pointer = signal<{ x: number; y: number } | null>(null);
  const blinkLid = signal(0), talk = signal(0.5);
  const target = computed((): number[] => {
    const e = p.expression(), s = expressionState(e === "blink" ? "open" : e), l = p.look();
    const neutral = !e || e === "open" || e === "blink";
    if (l) { s.x = clamp(l.x ?? s.x, -1, 1); s.y = clamp(l.y ?? s.y, -1, 1); }
    else if (neutral && p.follow() && pointer()) { s.x = pointer()!.x; s.y = pointer()!.y; }
    else if (neutral && glance()) { s.x = glance()!.x; s.y = glance()!.y; }
    return eyeVec(s);
  });
  // The gaze is a spring and a blink a short lid curve, stepped on the engine clock (onFrame: global speed and pause
  // apply). A face is a handful of numbers, so it steps them itself instead of loading the tween / timeline modules.
  const n = eyeVec(expressionState("open")).length;
  const pos = untrack(target).slice(), vel = new Array<number>(n).fill(0);
  const moving = signal(pos.slice(), { equals: false });
  let goal = pos.slice(), blinkAt = -1, stop: (() => void) | null = null;
  const K = 240, C = 22, BLINK_DOWN = 70, BLINK_UP = 120;
  const tick = (at: number, dt: number): void => {
    let left = Math.min(dt / 1000, 0.1), busy = false;
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      left -= h;
      for (let i = 0; i < n; i++) { vel[i] = vel[i]! + (-K * (pos[i]! - goal[i]!) - C * vel[i]!) * h; pos[i] = pos[i]! + vel[i]! * h; }
    }
    for (let i = 0; i < n; i++) {
      if (Math.abs(vel[i]!) > 0.002 || Math.abs(pos[i]! - goal[i]!) > 0.002) busy = true;
      else { pos[i] = goal[i]!; vel[i] = 0; }
    }
    moving.set(pos.slice());
    if (blinkAt >= 0) {
      // down fast (ease in), up a little slower (ease out): a real blink
      const e = at - blinkAt;
      if (e >= BLINK_DOWN + BLINK_UP) { blinkAt = -1; blinkLid.set(0); }
      else { blinkLid.set(e < BLINK_DOWN ? (e / BLINK_DOWN) ** 2 : 1 - (1 - (1 - (e - BLINK_DOWN) / BLINK_UP) ** 2)); busy = true; }
    }
    if (!busy) { stop?.(); stop = null; }
  };
  const wake = (): void => { if (!stop) stop = onFrame(tick); };
  effect(() => { goal = target().slice(); untrack(wake); });
  onCleanup(() => stop?.());
  const state = computed((): EyeState => {
    const s = vecEye(p.still() ? target() : moving());
    s.lid = Math.max(s.lid, blinkLid());
    return s;
  });

  const blink = (): void => {
    if (p.still()) return;
    blinkAt = now();
    wake();
  };
  // the "blink" expression blinks once each time it is set
  effect(() => { if (p.expression() === "blink") untrack(blink); });

  // alive: blinks every few seconds, an occasional glance; talking: the mouth opens and closes
  const seen = signal(true);
  onCleanup(watchVisibility(host, (v) => seen.set(v)));
  effect(() => {
    const alive = p.alive(), talking = p.mouth() === "talk";
    if (!seen() || p.still() || (!alive && !talking)) return;
    const [lo, hi] = p.blinkEvery() ?? [2200, 5600];
    let nextBlink = now() + lo + Math.random() * Math.max(0, hi - lo), nextGlance = now() + 1800 + Math.random() * 2600, glanceEnd = 0;
    onCleanup(onFrame((at) => {
      if (talking) talk.set(0.5 + 0.5 * Math.sin(at / 85) * Math.abs(Math.sin(at / 310)));
      if (!alive) return;
      if (at >= nextBlink) { blink(); nextBlink = at + lo + Math.random() * Math.max(0, hi - lo); }
      if (glanceEnd && at >= glanceEnd) { glance.set(null); glanceEnd = 0; }
      if (at >= nextGlance) {
        glance.set({ x: Math.round((Math.random() * 2 - 1) * 10) / 10, y: Math.round((Math.random() - 0.6) * 6) / 10 });
        glanceEnd = at + 700 + Math.random() * 900; nextGlance = at + 2600 + Math.random() * 3600;
      }
    }));
    onCleanup(() => glance.set(null));
  });

  // follow the pointer: the gaze points from the eyes to the pointer, read once per frame
  effect(() => {
    if (!p.follow()) return void pointer.set(null);
    let queued = false, last: PointerEvent | null = null;
    onCleanup(on<PointerEvent>(globalThis.document, "pointermove", (e) => {
      last = e;
      if (queued) return;
      queued = true;
      measure(() => {
        queued = false;
        const r = host.getBoundingClientRect?.();
        if (!r || !last) return;
        const dx = last.clientX - (r.left + r.width / 2), dy = last.clientY - (r.top + r.height / 2);
        pointer.set({ x: clamp(dx / Math.max(80, r.width), -1, 1), y: clamp(dy / Math.max(60, r.height), -1, 1) });
      });
    }));
    onCleanup(on(globalThis.document, "pointerleave", () => pointer.set(null)));
  });
  return { state, talk, blink };
}

/** The words for an expression (accessible names). */
export function expressionWords(e: EyeExpression | undefined): string {
  switch (e) {
    case "look-left": return t`Eyes looking left`;
    case "look-right": return t`Eyes looking right`;
    case "look-up": return t`Eyes looking up`;
    case "look-down": return t`Eyes looking down`;
    case "closed": return t`Closed eyes`;
    case "surprised": return t`Surprised eyes`;
    case "sleepy": return t`Sleepy eyes`;
    case "happy": return t`Happy eyes`;
    case "angry": return t`Angry eyes`;
    case "sad": return t`Sad eyes`;
    case "love": return t`Eyes in love`;
    default: return t`Eyes`;
  }
}

