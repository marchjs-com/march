// The pixel fonts of the LED parts: "5x7" (the hand-drawn glyphs in glyphs.ts, every Turkish letter included) and
// "8x8" (the same drawings one column bolder: a bigger, brighter face for wide boards). Text is laid out on an LED
// frame 8 rows high: rows 0–6 the letters, row 7 descenders. Letters are as wide as they are drawn (an "i" is narrow),
// digits are all five wide so a clock never jumps; `:heart:` puts a pixel emoji in the line.
import { ledFrame, blit, setLed, type LedFrame } from "../led-matrix/frame.ts";
import { GLYPHS_5X7 } from "./glyphs.ts";
import { spriteOf, spriteAt } from "../pixel-sprite/sprites.ts";

/** The pixel fonts. @tr Piksel yazı tipleri. */
export type PixelFontName = "5x7" | "8x8";
/** Height of every line of LED text, in LEDs. @tr Her LED metin satırının LED cinsinden yüksekliği. */
export const PIXEL_FONT_HEIGHT = 8;

interface Glyph { w: number; rows: number[] }
let raw: Map<string, number[]> | null = null;
const B32 = "0123456789abcdefghijklmnopqrstuv";
function table(): Map<string, number[]> {
  if (raw) return raw;
  raw = new Map();
  for (let i = 0; i + 9 <= GLYPHS_5X7.length; i += 9) raw.set(GLYPHS_5X7[i]!, [...GLYPHS_5X7.slice(i + 1, i + 9)].map((c) => B32.indexOf(c)));
  return raw;
}

const cache = new Map<string, Glyph | null>();
/** A glyph of a font: its width and its rows as bits (bit w−1 = the leftmost column); null when the font has none. */
function glyph(ch: string, font: PixelFontName): Glyph | null {
  const key = font + ch;
  let g = cache.get(key);
  if (g !== undefined) return g;
  let rows = table().get(ch);
  if (!rows) {
    // é → e, Å → A: a letter with an unknown mark falls back to its base letter
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    rows = base !== ch ? table().get(base) : undefined;
  }
  if (!rows) { cache.set(key, null); return null; }
  let bits = rows.slice(), w = 5;
  if (font === "8x8") { bits = bits.map((r) => (r << 1) | r); w = 6; }
  if (!/[0-9]/.test(ch)) {
    // proportional: trim the empty columns on both sides
    const all = bits.reduce((a, r) => a | r, 0);
    if (all) {
      let lo = 0, hi = w - 1;
      while (!(all & (1 << (w - 1 - lo)))) lo++;
      while (!(all & (1 << (w - 1 - hi)))) hi--;
      const nw = hi - lo + 1, shift = w - 1 - hi;
      bits = bits.map((r) => (r >> shift) & ((1 << nw) - 1));
      w = nw;
    }
  }
  g = { w, rows: bits };
  cache.set(key, g);
  return g;
}

/** Can the font draw this character? @tr Yazı tipi bu karakteri çizebilir mi? */
export const hasGlyph = (ch: string, font: PixelFontName = "5x7"): boolean => ch === " " || !!glyph(ch, font);

/** Options of text layout. @tr Metin yerleşiminin seçenekleri. */
export interface PixelTextOptions {
  /** "5x7" (default) or "8x8" (bolder). @tr "5x7" (varsayılan) ya da "8x8" (daha kalın). */
  font?: PixelFontName | undefined;
  /** LEDs between letters. Default 1. @tr Harfler arasındaki LED sayısı. Varsayılan 1. */
  spacing?: number | undefined;
  /** Width of a space. Default 3 (4 in "8x8"). @tr Boşluğun genişliği. Varsayılan 3 ("8x8"de 4). */
  space?: number | undefined;
  /** Clock time in ms for animated emoji (`:fire:`). Default 0. @tr Hareketli emojiler (`:fire:`) için ms cinsinden saat. Varsayılan 0. */
  time?: number | undefined;
  /** Color of the letters ("#f80"); default the screen's color. Emoji keep their own colors. @tr Harflerin rengi ("#f80"); varsayılan ekranın rengi. Emojiler kendi renklerini korur. */
  rgb?: number | undefined;
}

/** One laid-out piece of text: a letter or an emoji, where it starts and how wide it is. @tr Yerleştirilmiş tek parça: bir harf ya da emoji, başladığı yer ve genişliği. */
export interface PixelTextPart { text: string; x: number; w: number; emoji: boolean }
/** Laid-out text: the frame and its parts. @tr Yerleştirilmiş metin: resmi ve parçaları. */
export interface PixelText { frame: LedFrame; parts: PixelTextPart[] }

const TOKEN = /:([a-z0-9-]+):/g;
type Segmenter = { segment(s: string): Iterable<{ segment: string }> };
const SEG = (Intl as { Segmenter?: new (l?: string, o?: { granularity: string }) => Segmenter }).Segmenter;
const graphemes: Segmenter | null = SEG ? new SEG(undefined, { granularity: "grapheme" }) : null;
/** Split text into letters and `:emoji:` tokens (graphemes: a Turkish letter or a flag stays whole). */
export function textParts(text: string): { text: string; emoji: boolean }[] {
  const out: { text: string; emoji: boolean }[] = [];
  let at = 0;
  const seg = (s: string): void => {
    const list = graphemes ? [...graphemes.segment(s)].map((x) => x.segment) : [...s];
    for (const ch of list) out.push({ text: ch, emoji: false });
  };
  for (const m of text.matchAll(TOKEN)) {
    if (!spriteOf(m[1]!)) continue;
    seg(text.slice(at, m.index));
    out.push({ text: m[0], emoji: true });
    at = m.index! + m[0].length;
  }
  seg(text.slice(at));
  return out;
}

/** Width in LEDs of a text in a font. @tr Bir metnin bir yazı tipindeki LED cinsinden genişliği. */
export const textWidth = (text: string, o: PixelTextOptions = {}): number => layoutText(text, o).frame.cols;

/**
 * Lay text out on an LED frame 8 rows high, as wide as the text. Unknown characters show as "?".
 * @tr Metni 8 satır yüksekliğinde, metin kadar geniş bir LED resmine yerleştirir. Bilinmeyen karakterler "?" görünür.
 */
export function layoutText(text: string, o: PixelTextOptions = {}): PixelText {
  const font = o.font ?? "5x7", gap = o.spacing ?? 1, sp = o.space ?? (font === "8x8" ? 4 : 3);
  const items = textParts(String(text ?? "")).map((p) => {
    if (p.emoji) {
      const s = spriteOf(p.text.slice(1, -1))!, f = spriteAt(s, o.time ?? 0);
      // trim empty columns so an emoji sits as close as a letter
      let lo = f.cols, hi = -1;
      for (let y = 0; y < f.rows; y++) for (let x = 0; x < f.cols; x++) if (f.lit[y * f.cols + x]) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
      return { ...p, w: hi < 0 ? sp : hi - lo + 1, draw: (dst: LedFrame, x: number) => blit(dst, f, x - lo, Math.floor((PIXEL_FONT_HEIGHT - f.rows) / 2)) };
    }
    if (p.text === " " || p.text === " ") return { ...p, w: sp, draw: null };
    const g = glyph(p.text, font) ?? glyph("?", font)!;
    return { ...p, w: g.w, draw: (dst: LedFrame, x: number) => {
      for (let y = 0; y < 8; y++) { const r = g.rows[y]!; if (r) for (let c = 0; c < g.w; c++) if (r & (1 << (g.w - 1 - c))) setLed(dst, x + c, y, 255, o.rgb ?? 0); }
    } };
  });
  let width = 0;
  items.forEach((it, i) => { width += it.w + (i < items.length - 1 ? gap : 0); });
  const frame = ledFrame(width, PIXEL_FONT_HEIGHT), parts: PixelTextPart[] = [];
  let x = 0;
  for (const it of items) {
    it.draw?.(frame, x);
    parts.push({ text: it.text, x, w: it.w, emoji: it.emoji });
    x += it.w + gap;
  }
  return { frame, parts };
}

/**
 * Break text into lines no wider than `cols` LEDs (at spaces; a word longer than a line is cut). For paging text on a
 * narrow screen and for vertical scrolling.
 * @tr Metni `cols` LED'den geniş olmayan satırlara böler (boşluklardan; satırdan uzun sözcük kesilir). Dar ekranda metni
 * sayfalamak ve dikey kaydırma için.
 */
export function wrapText(text: string, cols: number, o: PixelTextOptions = {}): string[] {
  const lines: string[] = [];
  for (const para of String(text ?? "").split("\n")) {
    let line = "";
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, o) <= cols) { line = next; continue; }
      if (line) lines.push(line);
      line = word;
      // a word wider than the screen: cut it into pieces that fit
      while (line && textWidth(line, o) > cols) {
        const parts = textParts(line);
        let k = parts.length - 1;
        while (k > 1 && textWidth(parts.slice(0, k).map((x) => x.text).join(""), o) > cols) k--;
        lines.push(parts.slice(0, k).map((x) => x.text).join(""));
        line = parts.slice(k).map((x) => x.text).join("");
      }
    }
    lines.push(line);
  }
  return lines;
}

/** What a screen reader hears for LED text: the text with `:name:` as "name". @tr Ekran okuyucunun LED metni için duyduğu: `:ad:` yerine "ad". */
export const spokenText = (s: string): string => s.replace(/:([a-z0-9-]+):/g, (_, n: string) => n.replace(/-/g, " ")).replace(/\s+/g, " ").trim();
