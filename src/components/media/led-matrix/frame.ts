// The picture of an LED matrix: one byte of brightness per LED (0 = off, 255 = full) and, optionally, one color per
// LED (0 = the matrix color). Every LED part works on it: PixelFont writes text into one, PixelSprite and LedEyes draw
// into one, LedBoard mixes two of them for a transition, and LedMatrix paints only the LEDs that changed since the
// last picture. Plain typed arrays: no allocation per frame once a frame exists.
//   const f = ledFrame(32, 8); setLed(f, 3, 4); blit(f, ledArt([".#.", "###"]), 10, 2); LedMatrix frame={() => f}
/** One picture for a dot matrix. @tr Bir nokta matrisi için tek resim. */
export interface LedFrame {
  /** LEDs across. @tr Yatayda LED sayısı. */
  cols: number;
  /** LEDs down. @tr Dikeyde LED sayısı. */
  rows: number;
  /** Brightness per LED, row by row, 0–255. @tr LED başına parlaklık, satır satır, 0–255. */
  lit: Uint8ClampedArray;
  /** Color per LED as 0xRRGGBB + 1 (0: the matrix color). @tr LED başına renk, 0xRRGGBB + 1 (0: matrisin rengi). */
  rgb: Uint32Array;
}

/** An empty (all off) frame. @tr Boş (tümü sönük) bir resim. */
export function ledFrame(cols: number, rows: number): LedFrame {
  const c = Math.max(0, Math.floor(cols)), r = Math.max(0, Math.floor(rows));
  return { cols: c, rows: r, lit: new Uint8ClampedArray(c * r), rgb: new Uint32Array(c * r) };
}

/** Turn every LED off. @tr Tüm LED'leri söndürür. */
export function clearFrame(f: LedFrame): LedFrame { f.lit.fill(0); f.rgb.fill(0); return f; }

/** A color as stored in a frame: "#f80", "#ff8800" or 0xff8800 → 0xRRGGBB + 1; anything else 0 (the matrix color). */
export function ledColor(c: string | number | null | undefined): number {
  if (typeof c === "number") return c >= 0 ? (c & 0xffffff) + 1 : 0;
  const m = typeof c === "string" ? /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim()) : null;
  if (!m) return 0;
  const hx = m[1]!.length === 3 ? m[1]!.replace(/./g, (d) => d + d) : m[1]!;
  return parseInt(hx, 16) + 1;
}

/** Light one LED (out of range: nothing). @tr Bir LED'i yakar (alan dışıysa bir şey yapmaz). */
export function setLed(f: LedFrame, x: number, y: number, lit = 255, rgb = 0): void {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= f.cols || y >= f.rows) return;
  const i = y * f.cols + x;
  f.lit[i] = lit; f.rgb[i] = rgb;
}

/** Brightness of one LED (0 outside). @tr Bir LED'in parlaklığı (dışarıda 0). */
export const ledAt = (f: LedFrame, x: number, y: number): number => (x < 0 || y < 0 || x >= f.cols || y >= f.rows ? 0 : f.lit[(y | 0) * f.cols + (x | 0)]!);

/** Draw `src` into `dst` at (dx, dy): lit LEDs only (unlit ones leave `dst` as it is); `scale` dims, `rgb` recolors. */
export function blit(dst: LedFrame, src: LedFrame, dx: number, dy: number, scale = 1, rgb?: number): void {
  dx = Math.round(dx); dy = Math.round(dy);
  const x0 = Math.max(0, -dx), y0 = Math.max(0, -dy), x1 = Math.min(src.cols, dst.cols - dx), y1 = Math.min(src.rows, dst.rows - dy);
  for (let y = y0; y < y1; y++) {
    let s = y * src.cols + x0, d = (y + dy) * dst.cols + x0 + dx;
    for (let x = x0; x < x1; x++, s++, d++) {
      const v = src.lit[s]!;
      if (!v) continue;
      dst.lit[d] = scale === 1 ? v : v * scale;
      dst.rgb[d] = rgb ?? src.rgb[s]!;
    }
  }
}

/** Copy `src` over `dst` (same size; a smaller source is placed top-left and the rest cleared). */
export function copyFrame(dst: LedFrame, src: LedFrame): void {
  if (dst.cols === src.cols && dst.rows === src.rows) { dst.lit.set(src.lit); dst.rgb.set(src.rgb); return; }
  clearFrame(dst); blit(dst, src, 0, 0);
}

/**
 * Pixel art as text: one string per row; "." or " " is off, any other character is lit. `palette` maps characters to
 * colors ("#f33"); a character not in it uses the matrix color.
 * @tr Metin olarak piksel çizimi: satır başına bir dize; "." ya da " " sönük, başka her karakter yanık. `palette`
 * karakterleri renklere eşler ("#f33"); paletinde olmayan karakter matrisin rengini kullanır.
 */
export function ledArt(rows: readonly string[], palette?: Record<string, string | number> | null): LedFrame {
  const lines = rows.map((r) => [...r]);
  const f = ledFrame(Math.max(0, ...lines.map((l) => l.length)), lines.length);
  const pal = new Map<string, number>();
  for (const k in palette ?? {}) pal.set(k, ledColor(palette![k]));
  lines.forEach((l, y) => l.forEach((ch, x) => { if (ch !== "." && ch !== " ") setLed(f, x, y, 255, pal.get(ch) ?? 0); }));
  return f;
}

/** Is `x` a frame? @tr `x` bir resim mi? */
export const isLedFrame = (x: unknown): x is LedFrame => !!x && typeof x === "object" && (x as LedFrame).lit instanceof Uint8ClampedArray;

/** A stable little hash 0–1 of an LED's place (dissolve and rain transitions, sparkles). */
export const ledNoise = (x: number, y: number): number => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
