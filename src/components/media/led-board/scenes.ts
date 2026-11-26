// What LedBoard shows, scene by scene: every kind of scene becomes a "content" that knows how long it lasts and how to
// draw itself at a time (ms since it started, on the motion engine's clock). Text scrolls in any direction (or pages
// under reduced motion), clocks and scores roll their changed digits, emoji and pixel art scale up to the board, eyes
// and mouths come from LedEyes, audio bars from a march/audio source. Transitions mix two frames LED by LED.
import { val, clamp, type MaybeFn } from "../../../core/util.ts";
import { t } from "../../../core/i18n.ts";
import { ledColor, ledNoise, type LedFrame } from "../led-matrix/frame.ts";
import { ledArt } from "../led-matrix/frame.ts";
import { layoutText, wrapText, spokenText, PIXEL_FONT_HEIGHT, type PixelFontName, type PixelText } from "../pixel-font/font.ts";
import { spriteOf, spriteAt, type LedSprite } from "../pixel-sprite/sprites.ts";
import { drawFace, type EyeExpression, type MouthShape, type EyeState } from "../led-eyes/eyes.ts";
import { expressionWords } from "../led-eyes/face.ts";
import type { AudioSource, AudioSourceLike } from "../../../audio/index.ts";

/** How text moves. @tr Metnin nasıl hareket ettiği. */
export type LedDirection = "left" | "right" | "up" | "down";
/** A text effect. @tr Bir metin efekti. */
export type LedEffect = "none" | "typewriter" | "blink" | "wave" | "rainbow";
/** How one scene gives way to the next. @tr Bir sahnenin sonrakine nasıl yer verdiği. */
export type LedTransition = "cut" | "wipe" | "dissolve" | "rain" | "iris";

/** One scene of a board: set one kind (text, emoji, eye, pixels, clock, countdown, score, ticker, bars) and any options. @tr Panonun bir sahnesi: bir tür (text, emoji, eye, pixels, clock, countdown, score, ticker, bars) ve istenen seçenekler. */
export interface LedScene {
  /** Text (`:heart:` shows an emoji); a function is read live. @tr Metin (`:heart:` emoji gösterir); fonksiyon canlı okunur. */
  text?: MaybeFn<string | number | undefined>;
  /** A pixel emoji or icon by name, or your own sprite. @tr Ada göre bir piksel emoji ya da simge veya kendi çiziminiz. */
  emoji?: string | LedSprite | undefined;
  /** Eyes with this expression ("look-left", "blink", "happy"…). @tr Bu ifadeyle gözler ("look-left", "blink", "happy"…). */
  eye?: EyeExpression | undefined;
  /** A mouth with the eyes ("smile", "talk"…). @tr Gözlerle birlikte bir ağız ("smile", "talk"…). */
  mouth?: MouthShape | undefined;
  /** Pixel art, one string per row ("." off), colored by `palette`. @tr Piksel çizimi, satır başına bir dize ("." sönük), `palette` ile renkli. */
  pixels?: readonly string[] | undefined;
  /** Colors of the art's characters. @tr Çizimdeki karakterlerin renkleri. */
  palette?: Record<string, string> | undefined;
  /** The time now: true ("HH:mm:ss", or "HH:mm" when it does not fit), "HH:mm" or "HH:mm:ss". @tr Şimdiki saat: true ("HH:mm:ss", sığmazsa "HH:mm"), "HH:mm" ya da "HH:mm:ss". */
  clock?: boolean | "HH:mm" | "HH:mm:ss" | undefined;
  /** Count down to a moment (a Date, a time in ms or a date string). @tr Bir âna geri say (Date, ms cinsinden zaman ya da tarih metni). */
  countdown?: Date | number | string | undefined;
  /** Text shown when the countdown is over (default "00:00"). @tr Geri sayım bitince gösterilen metin (varsayılan "00:00"). */
  done?: string | undefined;
  /** Two scores; changed digits roll. A function is read live. @tr İki skor; değişen rakamlar yuvarlanır. Fonksiyon canlı okunur. */
  score?: MaybeFn<readonly [number, number] | undefined>;
  /** Names on both sides of the score ("EV", "DEP"). @tr Skorun iki yanındaki adlar ("EV", "DEP"). */
  teams?: readonly [string, string] | undefined;
  /** Items that run past one after another. @tr Art arda akan öğeler. */
  ticker?: MaybeFn<readonly string[] | undefined>;
  /** Audio bars from a march/audio source (or "demo", "mic", an element, a number). @tr Bir march/audio kaynağından ses çubukları ("demo", "mic", bir öğe ya da sayı da olur). */
  bars?: AudioSourceLike | undefined;
  /** How long the scene stays, in ms (scrolling text: until it has passed). @tr Sahnenin kalma süresi, ms (kayan metin: geçip gidene dek). */
  duration?: number | undefined;
  /** Text direction for this scene. @tr Bu sahne için metin yönü. */
  direction?: LedDirection | undefined;
  /** Speed for this scene, LEDs per second. @tr Bu sahnenin hızı, saniyede LED. */
  speed?: number | undefined;
  /** Text effect for this scene. @tr Bu sahnenin metin efekti. */
  effect?: LedEffect | undefined;
  /** Transition into this scene. @tr Bu sahneye geçiş. */
  transition?: LedTransition | undefined;
  /** Color of the text ("#ff8a00"). @tr Metnin rengi ("#ff8a00"). */
  ink?: string | undefined;
  /** What a screen reader hears for this scene (default: its text). @tr Ekran okuyucunun bu sahne için duyduğu (varsayılan: metni). */
  label?: string | undefined;
}

/** The board's options every scene reads. */
export interface SceneEnv {
  cols: number; rows: number;
  font: PixelFontName; spacing: number; scale: number;
  direction: LedDirection; speed: number; pause: number; effect: LedEffect;
  ink: number;
  /** Nothing should move: pages instead of scrolling, no blink / wave / roll. */
  still: boolean;
  /** The face of eye scenes (one per board). */
  face: () => { state: EyeState; talk: number };
  /** The audio source of a bars scene. */
  audio: (given: AudioSourceLike | undefined) => AudioSource | null;
}

/** A scene made drawable. */
export interface Content {
  /** ms until the scene is over (Infinity: stays). */
  length: number;
  draw(f: LedFrame, t: number): void;
  /** What a screen reader hears. */
  spoken: () => string;
}

const ROLL_MS = 320;
const ease = (x: number): number => 1 - (1 - x) ** 3;

/** Hue (degrees) → a stored LED color. */
export function hueColor(h: number): number {
  const f = (n: number): number => { const k = (n + h / 30) % 12; return Math.round(255 * (0.5 - 0.5 * clamp(Math.min(k - 3, 9 - k), -1, 1))); };
  return ledColor((f(0) << 16) | (f(8) << 8) | f(4));
}

/** Draw `src` scaled by k at (x, y); `shift(x)` moves a column up or down (wave), `color(x)` recolors (rainbow). */
export function drawScaled(dst: LedFrame, src: LedFrame, x0: number, y0: number, k: number, shift?: ((x: number) => number) | null, color?: ((x: number) => number) | null, ink = 0): void {
  x0 = Math.round(x0); y0 = Math.round(y0);
  for (let sy = 0; sy < src.rows; sy++) {
    for (let sx = 0; sx < src.cols; sx++) {
      const v = src.lit[sy * src.cols + sx]!;
      if (!v) continue;
      const base = src.rgb[sy * src.cols + sx]! || ink;
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < k; i++) {
          const x = x0 + sx * k + i;
          if (x < 0 || x >= dst.cols) continue;
          const y = y0 + sy * k + j + (shift ? shift(x) : 0);
          if (y < 0 || y >= dst.rows) continue;
          const d = y * dst.cols + x;
          dst.lit[d] = v; dst.rgb[d] = color ? color(x) : base;
        }
      }
    }
  }
}

/** Text that stands still (it fits): centered; when it changes, the changed columns roll (old up, new in from below). */
function standing(env: SceneEnv, read: () => string, spoken: () => string, length: number, effect: LedEffect): Content {
  let shown = "", laid: PixelText | null = null, prev: PixelText | null = null, rollAt = -1e9, lastT = 0;
  const layout = (s: string, at: number): PixelText => layoutText(s, { font: env.font, spacing: env.spacing, time: at, rgb: env.ink });
  return {
    length, spoken,
    draw(f, at) {
      const s = read();
      if (s !== shown || !laid || /:[a-z0-9-]+:/.test(s)) {
        if (s !== shown && laid && !env.still) { prev = laid; rollAt = at; }
        shown = s; laid = layout(s, at);
      }
      lastT = at;
      // standing text never runs off the board: a smaller scale when the big one does not fit
      let k = env.scale;
      while (k > 1 && laid.frame.cols * k > env.cols) k--;
      const w = laid.frame.cols * k, hgt = PIXEL_FONT_HEIGHT * k;
      const x = Math.floor((env.cols - w) / 2), y = Math.floor((env.rows - hgt) / 2);
      if (effect === "blink" && !env.still && at % 1000 > 640) return;
      const p = (lastT - rollAt) / ROLL_MS;
      if (prev && p < 1) {
        // the roll: columns whose LEDs changed slide; the others stand
        const e = ease(Math.max(0, p)), old = prev, pw = old.frame.cols * k, px = Math.floor((env.cols - pw) / 2);
        const tmpOld = ledArtEmpty(env.cols, env.rows), tmpNew = ledArtEmpty(env.cols, env.rows);
        drawScaled(tmpOld, old.frame, px, y, k); drawScaled(tmpNew, laid.frame, x, y, k);
        const off = Math.round(e * hgt);
        for (let cx = 0; cx < env.cols; cx++) {
          let same = true;
          for (let cy = 0; cy < env.rows && same; cy++) { const i = cy * env.cols + cx; if (tmpOld.lit[i] !== tmpNew.lit[i]) same = false; }
          for (let cy = 0; cy < env.rows; cy++) {
            const i = cy * env.cols + cx;
            if (same) { if (tmpNew.lit[i]) { f.lit[i] = tmpNew.lit[i]!; f.rgb[i] = tmpNew.rgb[i]!; } continue; }
            const yo = cy + off, yn = cy - (hgt - off);
            // inside the text's band only: the roll does not spill over the rest of the board
            if (cy < y || cy >= y + hgt) continue;
            const iOld = yo >= y && yo < y + hgt ? yo * env.cols + cx : -1, iNew = yn >= y && yn < y + hgt ? yn * env.cols + cx : -1;
            if (iOld >= 0 && tmpOld.lit[iOld]) { f.lit[i] = tmpOld.lit[iOld]!; f.rgb[i] = tmpOld.rgb[iOld]!; }
            if (iNew >= 0 && tmpNew.lit[iNew]) { f.lit[i] = tmpNew.lit[iNew]!; f.rgb[i] = tmpNew.rgb[iNew]!; }
          }
        }
        return;
      }
      prev = null;
      drawScaled(f, laid.frame, x, y, k, waveOf(env, effect, at, hgt), rainbowOf(env, effect, at));
    },
  };
}
const ledArtEmpty = (c: number, r: number): LedFrame => ({ cols: c, rows: r, lit: new Uint8ClampedArray(c * r), rgb: new Uint32Array(c * r) });

const waveOf = (env: SceneEnv, effect: LedEffect, at: number, hgt: number): ((x: number) => number) | null => {
  if (effect !== "wave" || env.still) return null;
  const room = Math.max(1, Math.min(2, Math.floor((env.rows - hgt) / 2) || 1));
  return (x) => Math.round(Math.sin(x * 0.45 - at / 160) * room);
};
const rainbowOf = (env: SceneEnv, effect: LedEffect, at: number): ((x: number) => number) | null =>
  effect === "rainbow" ? (x) => hueColor(x * 9 + (env.still ? 0 : at / 8)) : null;

/** Text that moves: scrolls left / right / up / down at `speed`, or (still) pages. */
function moving(env: SceneEnv, text: string, spoken: () => string, sc: LedScene): Content {
  const dir = sc.direction ?? env.direction, speed = Math.max(1, sc.speed ?? env.speed), k = env.scale, effect = sc.effect ?? env.effect;
  const o = { font: env.font, spacing: env.spacing, rgb: ledColor(sc.ink) || env.ink };
  const hgt = PIXEL_FONT_HEIGHT * k, animated = /:[a-z0-9-]+:/.test(text);
  if (effect === "typewriter") {
    // letters appear one by one; a long line keeps the newest letters in view
    const laid = layoutText(text, o), n = laid.parts.length, perChar = Math.max(40, 1000 / Math.max(4, speed / 3));
    const typed = env.still ? 0 : n * perChar;
    return { length: sc.duration ?? typed + Math.max(env.pause, 1200), spoken, draw(f, at) {
      const now = env.still ? n : Math.min(n, Math.floor(at / perChar) + 1);
      const last = laid.parts[now - 1], end = last ? (last.x + last.w) * k : 0;
      const full = laid.frame.cols * k, x = full <= env.cols ? Math.floor((env.cols - full) / 2) : Math.min(0, env.cols - end - k);
      const clip = ledArtEmpty(laid.frame.cols, laid.frame.rows);
      for (let y = 0; y < laid.frame.rows; y++) for (let cx = 0; cx < Math.min(laid.frame.cols, last ? last.x + last.w : 0); cx++) {
        const i = y * laid.frame.cols + cx; clip.lit[i] = laid.frame.lit[i]!; clip.rgb[i] = laid.frame.rgb[i]!;
      }
      drawScaled(f, clip, x, Math.floor((env.rows - hgt) / 2), k, null, rainbowOf(env, effect, at));
      // the caret blinks after the last letter while typing
      if (now < n && Math.floor(at / 260) % 2 === 0) for (let j = 0; j < hgt - k; j++) for (let i = 0; i < k; i++) {
        const cx = x + end + k + i, cy = Math.floor((env.rows - hgt) / 2) + j;
        if (cx >= 0 && cx < env.cols && cy >= 0 && cy < env.rows) f.lit[cy * env.cols + cx] = 255;
      }
    } };
  }
  if (env.still) {
    // reduced motion: pages that fit, one after another, never sliding
    const pages = wrapText(text, Math.floor(env.cols / k), o), each = Math.max(env.pause, 2200);
    const laid = pages.map((p) => layoutText(p, o));
    return { length: sc.duration ?? pages.length * each, spoken, draw(f, at) {
      const p = laid[Math.min(laid.length - 1, Math.floor(at / each))]!;
      drawScaled(f, p.frame, Math.floor((env.cols - p.frame.cols * k) / 2), Math.floor((env.rows - hgt) / 2), k, null, rainbowOf(env, effect, at));
    } };
  }
  if (dir === "up" || dir === "down") {
    const lines = wrapText(text, Math.floor(env.cols / k), o).map((l) => layoutText(l, o)), lh = hgt + k, total = lines.length * lh;
    const travel = env.rows + total;
    return { length: sc.duration ?? (travel / speed) * 1000 + env.pause, spoken, draw(f, at) {
      const d = Math.min(travel, (at / 1000) * speed);
      const top = dir === "up" ? env.rows - d : -total + d;
      lines.forEach((l, i) => drawScaled(f, l.frame, Math.floor((env.cols - l.frame.cols * k) / 2), top + i * lh, k, null, rainbowOf(env, effect, at)));
    } };
  }
  let laid = layoutText(text, o);
  const w = laid.frame.cols * k, travel = env.cols + w;
  return { length: sc.duration ?? (travel / speed) * 1000 + Math.min(env.pause, 400), spoken, draw(f, at) {
    if (animated) laid = layoutText(text, { ...o, time: at });
    const d = (at / 1000) * speed;
    const x = dir === "right" ? -w + d : env.cols - d;
    const y = Math.floor((env.rows - hgt) / 2);
    if (effect === "blink" && at % 1000 > 640) return;
    drawScaled(f, laid.frame, x, y, k, waveOf(env, effect, at, hgt), rainbowOf(env, effect, at));
  } };
}

const pad2 = (n: number): string => String(Math.max(0, Math.floor(n))).padStart(2, "0");
function clockText(fmt: LedScene["clock"], fits: (s: string) => boolean): string {
  const d = new Date(), hhmm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`, hms = `${hhmm}:${pad2(d.getSeconds())}`;
  if (fmt === "HH:mm") return hhmm;
  if (fmt === "HH:mm:ss") return hms;
  return fits(hms) ? hms : hhmm;
}
function countdownText(to: LedScene["countdown"], done: string | undefined): string {
  const end = to instanceof Date ? to.getTime() : typeof to === "string" ? Date.parse(to) : Number(to);
  const left = Math.ceil((end - Date.now()) / 1000);
  if (!Number.isFinite(left) || left <= 0) return done ?? "00:00";
  const d = Math.floor(left / 86400), hh = Math.floor((left % 86400) / 3600), mm = Math.floor((left % 3600) / 60), ss = left % 60;
  return d ? `${d}g ${pad2(hh)}:${pad2(mm)}` : hh ? `${hh}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`;
}

/** Make a scene drawable on a board with the options `env`. */
export function contentOf(sc: LedScene, env: SceneEnv): Content {
  const effect = sc.effect ?? env.effect, fitsW = (s: string): boolean => layoutText(s, { font: env.font, spacing: env.spacing }).frame.cols * env.scale <= env.cols;
  const say = (s: () => string): (() => string) => () => sc.label ?? s();
  if (sc.eye || (sc.mouth && sc.mouth !== "none")) {
    return { length: sc.duration ?? 3200, spoken: say(() => expressionWords(sc.eye)), draw(f) {
      const { state, talk } = env.face();
      drawFace(f, state, sc.mouth ?? "none", talk, undefined, ledColor(sc.ink) || env.ink);
    } };
  }
  if (sc.emoji || sc.pixels) {
    const s = sc.emoji ? spriteOf(sc.emoji) : null, art = sc.pixels ? ledArt(sc.pixels, sc.palette) : null;
    const name = typeof sc.emoji === "string" ? sc.emoji.replace(/-/g, " ") : t`Pixel drawing`;
    return { length: sc.duration ?? 2600, spoken: say(() => name), draw(f, at) {
      const pic = art ?? spriteAt(s ?? spriteOf("heart")!, env.still ? 0 : at);
      const k = Math.max(1, Math.min(Math.floor(env.cols / pic.cols), Math.floor(env.rows / pic.rows)));
      // a gentle bounce on arrival, then still
      const bob = env.still || at > 600 ? 0 : Math.round(Math.sin((at / 600) * Math.PI) * -Math.min(2, Math.max(0, env.rows - pic.rows * k)));
      drawScaled(f, pic, Math.floor((env.cols - pic.cols * k) / 2), Math.floor((env.rows - pic.rows * k) / 2) + bob, k, null, rainbowOf(env, effect, at));
    } };
  }
  if (sc.bars !== undefined) {
    const buf = new Float32Array(1024);
    return { length: sc.duration ?? 6000, spoken: say(() => t`Audio bars`), draw(f) {
      const src = env.audio(sc.bars), n = Math.max(1, Math.floor((env.cols + 1) / 2));
      const bins = src ? src.spectrum(buf.length >= src.bins ? buf.subarray(0, src.bins) : new Float32Array(src.bins)) : null;
      for (let b = 0; b < n; b++) {
        let v = 0;
        if (bins && bins.length) {
          // a log-spaced band per bar: the bass is not one bar out of many
          const a = Math.floor(Math.pow(bins.length * 0.7, b / n)), z = Math.max(a + 1, Math.floor(Math.pow(bins.length * 0.7, (b + 1) / n)));
          for (let i = a; i < z && i < bins.length; i++) v = Math.max(v, bins[i]!);
        }
        const hgt = Math.round(v * env.rows);
        for (let j = 0; j < hgt; j++) {
          const y = env.rows - 1 - j, x = b * 2;
          if (x >= env.cols) break;
          const i = y * env.cols + x, k = j / Math.max(1, env.rows - 1);
          f.lit[i] = 255; f.rgb[i] = env.ink || ledColor(k > 0.8 ? "#ff3b45" : k > 0.55 ? "#ffd23f" : "#3dff7a");
        }
      }
    } };
  }
  if (sc.clock) {
    const read = (): string => clockText(sc.clock, fitsW);
    return standing(env, read, say(() => t`Time ${read()}`), sc.duration ?? 5000, effect);
  }
  if (sc.countdown !== undefined) {
    const read = (): string => countdownText(sc.countdown, sc.done);
    return standing(env, read, say(() => read()), sc.duration ?? 5000, effect);
  }
  if (sc.score !== undefined) {
    const read = (): string => {
      const s = val(sc.score) ?? [0, 0], tm = sc.teams;
      return tm ? `${tm[0]} ${s[0]}:${s[1]} ${tm[1]}` : `${s[0]} : ${s[1]}`;
    };
    return standing(env, read, say(() => read()), sc.duration ?? 5000, effect);
  }
  if (sc.ticker !== undefined) {
    const text = (val(sc.ticker) ?? []).join("  •  ");
    return moving(env, text, say(() => spokenText(text)), { ...sc, effect: sc.effect ?? "none" });
  }
  const text = String(val(sc.text) ?? "");
  const env1 = sc.ink ? { ...env, ink: ledColor(sc.ink) } : env;
  if (typeof sc.text === "function" || (fitsW(text) && (sc.direction ?? env.direction) !== "up" && (sc.direction ?? env.direction) !== "down" && effect !== "typewriter")) {
    return standing(env1, () => String(val(sc.text) ?? ""), say(() => spokenText(String(val(sc.text) ?? ""))), sc.duration ?? Math.max(env.pause * 2, 2400), effect);
  }
  return moving(env1, text, say(() => spokenText(text)), sc);
}

/** Mix two frames into `out` for a transition at progress p (0 → a, 1 → b). */
export function mixFrames(out: LedFrame, a: LedFrame, b: LedFrame, p: number, kind: LedTransition): void {
  const { cols, rows } = out;
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2, rMax = Math.hypot(cx + 1, cy + 1);
  for (let y = 0, i = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++, i++) {
      let useB: boolean;
      switch (kind) {
        case "cut": useB = p >= 0.5; break;
        case "wipe": useB = x < p * (cols + 2) - 1; break;
        case "dissolve": useB = ledNoise(x, y) < p; break;
        case "rain": useB = y < p * rows * 2.2 - ledNoise(x, 7) * rows * 1.2; break;
        case "iris": useB = Math.hypot(x - cx, (y - cy) * 1.15) < p * rMax; break;
        default: useB = p >= 0.5;
      }
      const s = useB ? b : a;
      out.lit[i] = s.lit[i]!; out.rgb[i] = s.rgb[i]!;
    }
  }
  if (kind === "wipe" && p > 0 && p < 1) {
    // a bright edge runs ahead of the wipe
    const ex = Math.floor(p * (cols + 2) - 1);
    if (ex >= 0 && ex < cols) for (let y = 0; y < rows; y++) out.lit[y * cols + ex] = Math.max(out.lit[y * cols + ex]!, 150);
  }
}
