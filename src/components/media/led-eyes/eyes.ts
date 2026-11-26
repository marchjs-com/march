// Drawing a pair of LED eyes (and a mouth) into an LED frame from a few numbers: where the pupils look, how far the
// lids are down, how big the eyes are, the mood of the lids and the mouth. Every LED is tested against the shapes, so
// the face fits any screen size. The animation (blinks, glances, tweens) lives in index.ts; this file only draws.
import { clamp } from "../../../core/util.ts";
import { setLed, type LedFrame } from "../led-matrix/frame.ts";

/** The face expressions. @tr Yüz ifadeleri. */
export type EyeExpression = "open" | "blink" | "closed" | "look-left" | "look-right" | "look-up" | "look-down" | "surprised" | "sleepy" | "happy" | "angry" | "sad" | "love";
/** The mouth shapes ("talk" moves). @tr Ağız biçimleri ("talk" hareket eder). */
export type MouthShape = "none" | "smile" | "grin" | "flat" | "sad" | "open" | "o" | "talk";

/** The drawn state of a face; every value can be tweened. */
export interface EyeState {
  /** Where the pupils look, −1 (left / up) … 1 (right / down). */
  x: number; y: number;
  /** Lid 0 (open) … 1 (closed). */
  lid: number;
  /** Eye height factor (surprised: bigger). */
  size: number;
  /** Pupil size factor (surprised: smaller). */
  pupil: number;
  /** Lid slant: −1 sad … 0 … 1 angry. */
  slant: number;
  /** 0 … 1: the eye becomes a happy arc. */
  happy: number;
  /** 0 … 1: the eyes become hearts. */
  love: number;
}

/** The state an expression asks for. */
export function expressionState(e: EyeExpression | undefined): EyeState {
  const s: EyeState = { x: 0, y: 0, lid: 0, size: 1, pupil: 1, slant: 0, happy: 0, love: 0 };
  switch (e) {
    case "look-left": s.x = -1; break;
    case "look-right": s.x = 1; break;
    case "look-up": s.y = -1; break;
    case "look-down": s.y = 1; s.lid = 0.25; break;
    case "closed": s.lid = 1; break;
    case "surprised": s.size = 1.2; s.pupil = 0.6; break;
    case "sleepy": s.lid = 0.55; s.y = 0.4; break;
    case "happy": s.happy = 1; break;
    case "angry": s.slant = 1; s.lid = 0.12; break;
    case "sad": s.slant = -1; s.y = 0.5; s.lid = 0.1; break;
    case "love": s.love = 1; break;
  }
  return s;
}
/** The state as a vector (for one tween) and back. */
export const EYE_KEYS = ["x", "y", "lid", "size", "pupil", "slant", "happy", "love"] as const;
export const eyeVec = (s: EyeState): number[] => EYE_KEYS.map((k) => s[k]);
export const vecEye = (v: readonly number[]): EyeState => Object.fromEntries(EYE_KEYS.map((k, i) => [k, v[i] ?? 0])) as unknown as EyeState;

const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];

/**
 * Draw the eyes (and the mouth, when `mouth` is not "none" and the screen is tall enough) into `f`, inside the box
 * (x, y, w, h) (default: the whole frame). `talk` 0–1 is how open a talking mouth is. `rgb` colors the LEDs (0: the
 * screen's color).
 */
export function drawFace(f: LedFrame, s: EyeState, mouth: MouthShape = "none", talk = 0.5, box?: { x: number; y: number; w: number; h: number }, rgb = 0): void {
  const bx = box?.x ?? 0, by = box?.y ?? 0, bw = box?.w ?? f.cols, bh = box?.h ?? f.rows;
  const hasMouth = mouth !== "none" && bh >= 10;
  const eyeArea = hasMouth ? Math.round(bh * 0.62) : bh;
  const ew = Math.max(3, Math.round(bw * 0.26)), gap = Math.max(2, Math.round(bw * 0.14));
  const ehBase = Math.max(3, eyeArea - 2), eh = Math.min(eyeArea, ehBase * s.size);
  const shiftX = s.x * Math.max(1, bw * 0.06), shiftY = s.y * Math.max(0.5, eyeArea * 0.06);
  const left0 = bx + (bw - (ew * 2 + gap)) / 2 + shiftX, top = by + (eyeArea - eh) / 2 + shiftY;
  const r = Math.min(ew, eh) * 0.38;
  const pw = Math.max(1, Math.round(ew * 0.3 * s.pupil)), ph = Math.max(1, Math.round(Math.min(eh, ew) * 0.32 * s.pupil));
  for (let side = 0; side < 2; side++) {
    const ex = left0 + side * (ew + gap), cx = ex + ew / 2, cy = top + eh / 2;
    const px = cx + s.x * (ew - pw) * 0.42, py = cy + s.y * (eh - ph) * 0.36;
    const inner = side === 0 ? 1 : -1; // +1 toward the nose for the left eye
    if (s.love > 0.5) {
      // hearts instead of eyes
      const hx = Math.round(cx - 3.5), hy = Math.round(cy - 3);
      HEART.forEach((row, j) => [...row].forEach((c, i) => { if (c === "#") setLed(f, hx + i, hy + j, 255, rgb); }));
      continue;
    }
    for (let y = Math.floor(top); y < Math.ceil(top + eh); y++) {
      for (let x = Math.floor(ex); x < Math.ceil(ex + ew); x++) {
        const u = x + 0.5, v = y + 0.5;
        // the rounded rectangle of the eye
        const dx = Math.max(ex + r - u, 0, u - (ex + ew - r)), dy = Math.max(top + r - v, 0, v - (top + eh - r));
        if (u < ex || u > ex + ew || v < top || v > top + eh || dx * dx + dy * dy > r * r) continue;
        // the lid comes down from the top; a slant tilts it toward (angry) or away from (sad) the nose
        const t = (u - cx) / (ew / 2) * inner; // −1 outer … 1 inner
        const lidY = top + eh * s.lid + s.slant * t * eh * 0.28 + Math.abs(s.slant) * eh * 0.14;
        if (v < lidY && s.lid < 0.98) continue;
        // a closed eye is one line along its lower half
        if (s.lid >= 0.98 && Math.abs(v - (top + eh * 0.7)) > 0.6) continue;
        // happy: an upside-down U, the lower part cut away by a circle
        if (s.happy > 0.02) {
          // the eye shrinks to an arc (∩): a band under the top edge of a circle around the eye's lower middle
          const R = ew / 2, ay = top + eh * 0.8, d = Math.hypot(u - cx, (v - ay) * (ew / Math.max(1, eh * 0.9)));
          const band = Math.max(1.3, ew * 0.2) + (1 - s.happy) * R;
          if (v > ay + 0.5 || d < R - band) continue;
        }
        // the pupil is a hole
        if (s.lid < 0.98 && s.happy < 0.5 && Math.abs(u - px) <= pw / 2 && Math.abs(v - py) <= ph / 2) continue;
        setLed(f, x, y, 255, rgb);
      }
    }
  }
  if (hasMouth) drawMouth(f, mouth, talk, bx, by + eyeArea, bw, bh - eyeArea, rgb);
}

function drawMouth(f: LedFrame, m: MouthShape, talk: number, bx: number, by: number, bw: number, bh: number, rgb: number): void {
  const mw = Math.max(4, Math.round(bw * (m === "o" ? 0.12 : m === "grin" ? 0.4 : 0.3))), mh = Math.max(2, bh - 1);
  const x0 = Math.round(bx + (bw - mw) / 2), y0 = by + Math.floor((bh - mh) / 2);
  const curve = (u: number): number => 1 - (2 * u - 1) ** 2; // 0 at the corners, 1 in the middle
  for (let i = 0; i < mw; i++) {
    const u = mw === 1 ? 0.5 : i / (mw - 1);
    if (m === "smile") setLed(f, x0 + i, y0 + Math.round(curve(u) * (mh - 1) * 0.8), 255, rgb);
    else if (m === "sad") setLed(f, x0 + i, y0 + Math.round((1 - curve(u)) * (mh - 1) * 0.8), 255, rgb);
    else if (m === "flat") setLed(f, x0 + i, y0 + Math.floor(mh / 2), 255, rgb);
    else if (m === "grin") {
      const yb = y0 + Math.round(curve(u) * (mh - 1));
      for (let y = y0; y <= yb; y++) setLed(f, x0 + i, y, 255, rgb);
    } else {
      // open, o, talk: an ellipse (a ring for "o"); talk opens and closes
      const open = m === "talk" ? 0.25 + 0.75 * clamp(talk, 0, 1) : 1;
      const ry = Math.max(0.6, (mh / 2) * open), cy = y0 + mh / 2, rx = mw / 2, cxm = x0 + mw / 2;
      for (let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) {
        const d = ((x0 + i + 0.5 - cxm) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d <= 1 && !(m === "o" && d < 0.35)) setLed(f, x0 + i, y, 255, rgb);
      }
    }
  }
}
