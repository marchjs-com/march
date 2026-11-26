// The built-in pixel emoji and icons (own drawings, 8 × 8): what `:name:` in LED text and `<PixelSprite name>` show.
// Features (eyes, mouths) are holes, not dark pixels, so every drawing still reads on a one-color screen.
// The format is the one of a `.led.json` file: `{ w, h, fps, loop, palette, frames: [[rows…], …] }`.
import { ledArt, type LedFrame } from "../led-matrix/frame.ts";

/** A pixel sprite (the `.led.json` format). @tr Bir piksel çizimi (`.led.json` biçimi). */
export interface LedSprite {
  /** Width in LEDs (default: the longest row). @tr LED cinsinden genişlik (varsayılan: en uzun satır). */
  w?: number | undefined;
  /** Height in LEDs (default: the number of rows). @tr LED cinsinden yükseklik (varsayılan: satır sayısı). */
  h?: number | undefined;
  /** Frames per second of an animated sprite. Default 4. @tr Hareketli çizimin saniyedeki kare sayısı. Varsayılan 4. */
  fps?: number | undefined;
  /** Play the frames again and again (default true). @tr Kareleri tekrar tekrar oynat (varsayılan true). */
  loop?: boolean | undefined;
  /** Colors of the characters: `{ r: "#ff3355" }`; others use the screen's color. @tr Karakterlerin renkleri: `{ r: "#ff3355" }`; diğerleri ekranın rengini kullanır. */
  palette?: Record<string, string> | undefined;
  /** One or more frames, each a list of rows ("." off). @tr Bir ya da daha çok kare, her biri satır listesi ("." sönük). */
  frames: readonly (readonly string[])[];
}

const R = "#ff3b5c", Y = "#ffd23f", O = "#ff9a1f", B = "#4aa8ff", G = "#3ddc84", W = "#eef3ff";
const one = (palette: Record<string, string>, ...frames: string[][]): LedSprite => ({ palette, frames, fps: 4 });
const face = (rows: string[]): LedSprite => one({ y: Y }, rows);

/** Every built-in sprite by name. @tr Adına göre tüm hazır çizimler. */
export const LED_SPRITES: Record<string, LedSprite> = {
  heart: one({ r: R, p: "#ffb3c2" }, ["........", ".rr..rr.", "rpprrrrr", "rprrrrrr", "rrrrrrrr", ".rrrrrr.", "..rrrr..", "...rr..."]),
  heartbeat: { palette: { r: R }, fps: 3, frames: [
    ["........", ".rr..rr.", "rrrrrrrr", "rrrrrrrr", "rrrrrrrr", ".rrrrrr.", "..rrrr..", "...rr..."],
    ["........", "........", "..r..r..", ".rrrrrr.", ".rrrrrr.", "..rrrr..", "...rr...", "........"]] },
  smile: face(["..yyyy..", ".yyyyyy.", "yy.yy.yy", "yyyyyyyy", "y.yyyy.y", "yy....yy", ".yyyyyy.", "..yyyy.."]),
  wink: face(["..yyyy..", ".yyyyyy.", "yy.yyyyy", "yyyy..yy", "y.yyyy.y", "yy....yy", ".yyyyyy.", "..yyyy.."]),
  sad: face(["..yyyy..", ".yyyyyy.", "yy.yy.yy", "yyyyyyyy", "yy....yy", "y.yyyy.y", ".yyyyyy.", "..yyyy.."]),
  laugh: face(["..yyyy..", ".yyyyyy.", "y.yyyy.y", "yyyyyyyy", "y......y", "yy....yy", ".yyyyyy.", "..yyyy.."]),
  star: one({ y: Y }, ["...y....", "...y....", "..yyy...", "yyyyyyy.", ".yyyyy..", "..yyy...", ".yy.yy..", ".y...y.."]),
  sun: one({ y: Y, o: O }, ["...o....", ".o.y.o..", "..yyy...", "oyyyyyo.", "..yyy...", ".o.y.o..", "...o....", "........"]),
  moon: one({ w: "#ffe9a8" }, ["...www..", "..ww....", ".ww.....", ".ww.....", ".ww.....", "..ww....", "...www..", "........"]),
  cloud: one({ c: "#dfe8f5" }, ["........", "...cc...", "..cccc..", ".cccccc.", "cccccccc", "cccccccc", "........", "........"]),
  rain: { palette: { c: "#dfe8f5", b: B }, fps: 4, frames: [
    ["...cc...", "..cccc..", ".cccccc.", "cccccccc", "........", ".b..b..b", "........", "b..b..b."],
    ["...cc...", "..cccc..", ".cccccc.", "cccccccc", "........", "b..b..b.", "........", ".b..b..b"]] },
  bolt: one({ y: Y }, ["....yy..", "...yy...", "..yy....", ".yyyyy..", "...yy...", "..yy....", ".yy.....", ".y......"]),
  fire: { palette: { r: "#ff4b2b", o: O, y: "#ffe14a" }, fps: 5, frames: [
    ["...r....", "..rr..r.", "..rro.r.", ".rroorr.", ".roooor.", "rooyyoor", "royyyyor", ".roooor."],
    ["....r...", ".r..rr..", ".r.orr..", ".rroorr.", ".roooor.", "rooyyoor", "royyyyor", ".roooor."]] },
  drop: one({ b: B, w: "#cfe8ff" }, ["...b....", "...b....", "..bbb...", ".bbbbb..", ".wbbbb..", ".wbbbb..", "..bbb...", "........"]),
  note: one({ m: "#c08bff" }, ["...mm...", "...m.m..", "...m..m.", "...m....", "...m....", ".mmm....", "mmmm....", ".mm....."]),
  bell: one({ y: Y }, ["...y....", "..yyy...", ".yyyyy..", ".yyyyy..", ".yyyyy..", "yyyyyyy.", "........", "...y...."]),
  check: one({ g: G }, ["........", ".......g", "......gg", ".....gg.", "g...gg..", "gg.gg...", ".ggg....", "..g....."]),
  cross: one({ r: "#ff4757" }, ["........", "rr....rr", ".rr..rr.", "..rrrr..", "..rrrr..", ".rr..rr.", "rr....rr", "........"]),
  "arrow-right": one({}, ["...#....", "...##...", "#######.", "########", "#######.", "...##...", "...#....", "........"]),
  "arrow-left": one({}, ["....#...", "...##...", ".#######", "########", ".#######", "...##...", "....#...", "........"]),
  "arrow-up": one({}, ["...##...", "..####..", ".######.", "########", "...##...", "...##...", "...##...", "...##..."]),
  "arrow-down": one({}, ["...##...", "...##...", "...##...", "...##...", "########", ".######.", "..####..", "...##..."]),
  coffee: { palette: { b: "#b0703f", w: "#e8e8e8" }, fps: 3, frames: [
    [".w..w...", "..w..w..", "........", "bbbbbb..", "bbbbbbbb", "bbbbbb.b", "bbbbbbb.", ".bbbb..."],
    ["..w..w..", ".w..w...", "........", "bbbbbb..", "bbbbbbbb", "bbbbbb.b", "bbbbbbb.", ".bbbb..."]] },
  rocket: { palette: { w: "#e8eefc", b: B, r: "#ff4b2b", y: "#ffe14a" }, fps: 6, frames: [
    ["...ww...", "..wwww..", "..wbbw..", "..wwww..", "..wwww..", ".wwwwww.", ".w.yy.w.", "...rr..."],
    ["...ww...", "..wwww..", "..wbbw..", "..wwww..", "..wwww..", ".wwwwww.", ".w.yy.w.", "..r..r.."]] },
  flower: one({ p: "#ff6fb5", y: Y, g: G }, ["...p....", "..pyp...", ".pyyyp..", "..pyp...", "...p....", ".g.g....", "..gg....", "...g...."]),
  "thumbs-up": one({ y: Y }, ["...y....", "..yy....", "..yy....", "yyyyyyy.", "yyyyyyy.", "yyyyyyy.", "yyyyyy..", "yyyyy..."]),
  cat: one({ o: "#ffa94d" }, ["o.....o.", "oo...oo.", "ooooooo.", "o.ooo.o.", "ooooooo.", "oo.o.oo.", ".ooooo..", "........"]),
  home: one({ r: "#ff6b4a", w: W }, ["...r....", "..rrr...", ".rrrrr..", "rrrrrrr.", ".wwwww..", ".ww.ww..", ".ww.ww..", "........"]),
  gift: one({ r: "#ff4757", y: Y }, ["..y.y...", "...y....", "rrryrrr.", "rrryrrr.", "yyyyyyy.", "rrryrrr.", "rrryrrr.", "........"]),
  sparkle: { palette: { y: Y }, fps: 3, frames: [
    ["........", "...y....", "..yyy...", ".yyyyy..", "..yyy...", "...y....", "........", "........"],
    ["...y....", "...y....", "...y....", "yyy.yyy.", "...y....", "...y....", "...y....", "........"]] },
};

/** The names of the built-in sprites. @tr Hazır çizimlerin adları. */
export const LED_SPRITE_NAMES = Object.keys(LED_SPRITES);

const cache = new WeakMap<LedSprite, LedFrame[]>();
/** The frames of a sprite as LED frames (parsed once). @tr Bir çizimin kareleri LED resmi olarak (bir kez ayrıştırılır). */
export function spriteFrames(s: LedSprite): LedFrame[] {
  let f = cache.get(s);
  if (!f) {
    f = s.frames.map((rows) => ledArt(rows, s.palette));
    cache.set(s, f);
  }
  return f;
}

/** A sprite by name (built-in or registered), or the sprite itself. @tr Ada göre (hazır ya da kayıtlı) bir çizim ya da çizimin kendisi. */
export const spriteOf = (x: string | LedSprite | null | undefined): LedSprite | null =>
  !x ? null : typeof x === "string" ? (LED_SPRITES[x] ?? null) : Array.isArray(x.frames) ? x : null;

/** Add (or replace) a named sprite, usable as `:name:` in any LED text. @tr Adlı bir çizim ekler (ya da değiştirir); her LED metninde `:ad:` olarak kullanılır. */
export function defineSprite(name: string, sprite: LedSprite): void { LED_SPRITES[name] = sprite; }

/** The frame of a sprite at a time in ms (an animated sprite loops at its fps). @tr Bir çizimin ms cinsinden bir andaki karesi (hareketli çizim kendi fps'iyle döner). */
export function spriteAt(s: LedSprite, ms: number): LedFrame {
  const f = spriteFrames(s), n = f.length;
  if (n <= 1) return f[0]!;
  const k = Math.floor((ms / 1000) * (s.fps ?? 4));
  return f[s.loop === false ? Math.min(n - 1, k) : ((k % n) + n) % n]!;
}

/** Read a `.led.json` text into a sprite (invalid text: null). @tr Bir `.led.json` metnini çizime çevirir (geçersizse null). */
export function parseLedJson(text: string): LedSprite | null {
  try {
    const x = JSON.parse(text) as LedSprite;
    if (!x || !Array.isArray(x.frames) || !x.frames.every((f) => Array.isArray(f) && f.every((r) => typeof r === "string"))) return null;
    return x;
  } catch { return null; }
}
