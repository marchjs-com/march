// DotMatrix (march/data): an LED dot-matrix display, the board of a bus destination sign, a stock ticker or a
// scoreboard. Text and numbers are drawn in a 5×7 font (ASCII and the Turkish letters, your own glyphs on top) as lit
// dots over the unlit ones. A change of value animates (a wipe or a dissolve, dot by dot, on the motion engine); text
// longer than the window scrolls like a marquee (it pauses on hover and while `paused`, stays still under reduced
// motion). Screen readers hear the whole text once, never the moving dots.
//   <DotMatrix value="ANKARA 14:05" />   <DotMatrix value={$temp} format={{ maximumFractionDigits: 1 }} columns={6} align="end" />
//   <DotMatrix value="Kapılar kapanıyor, lütfen geri çekilin" columns={16} color="danger" />
import "./dot-matrix.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, clamp, isRtl, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import type { Playback } from "../../../motion/engine/playback.ts";
import { still } from "../../../motion/engine/parts.ts";
import { whenVisible } from "../../../ui/observe.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

/** A glyph: 5 columns, bit 0 the top row (7 rows); or 7 strings of 5 characters where "#" (or any non-space, non-".") is lit. @tr Bir glif: 5 sütun, bit 0 en üst satır (7 satır); ya da "#" (boşluk ve "." dışında her karakter) yanık olan 5 karakterlik 7 dize. */
export type DotGlyph = readonly number[] | readonly string[];
/** The parts of the display on or off. @tr Ekranın parçaları açık ya da kapalı. */
export interface DotMatrixParts { off?: boolean; glow?: boolean; bezel?: boolean }

export interface DotMatrixProps {
  /** The text or number shown (it may be live). @tr Gösterilen metin ya da sayı (canlı olabilir). */
  value: MaybeFn<string | number | null | undefined>;
  /** Format of a number: a function or Intl.NumberFormat options. Default: the number in the page's language. @tr Bir sayının biçimi: bir işlev ya da Intl.NumberFormat seçenekleri. Varsayılan: sayfanın dilinde sayı. */
  format?: ((n: number) => string) | Intl.NumberFormatOptions | undefined;
  /** Width of the window in characters; longer text scrolls. Default: as wide as the text. @tr Pencerenin karakter cinsinden genişliği; daha uzun metin kayar. Varsayılan: metin kadar geniş. */
  columns?: MaybeFn<number | undefined>;
  /** Where shorter text sits: "start" (default), "center" or "end" (numbers on a scoreboard). @tr Daha kısa metnin yeri: "start" (varsayılan), "center" ya da "end" (skor tabelasındaki sayılar). */
  align?: MaybeFn<"start" | "center" | "end" | undefined>;
  /** Text wider than the window: "auto" scrolls it (default), false cuts it at the window's end. @tr Pencereden geniş metin: "auto" kaydırır (varsayılan), false pencerenin sonunda keser. */
  scroll?: MaybeFn<"auto" | false | undefined>;
  /** Scroll speed in dot columns per second. Default 18. @tr Kayma hızı, saniyede nokta sütunu. Varsayılan 18. */
  speed?: MaybeFn<number | undefined>;
  /** Stop scrolling (the text stays where it is). Default false. @tr Kaymayı durdur (metin olduğu yerde kalır). Varsayılan false. */
  paused?: MaybeFn<boolean | undefined>;
  /** Pause scrolling while the pointer is over the display. Default true. @tr İşaretçi ekranın üzerindeyken kaymayı duraklat. Varsayılan true. */
  pauseOnHover?: MaybeFn<boolean | undefined>;
  /** How long a new text stands still before it scrolls (ms). Default 1200. @tr Yeni bir metnin kaymadan önce durduğu süre (ms). Varsayılan 1200. */
  hold?: MaybeFn<number | undefined>;
  /** Empty dot columns between characters. Default 1. @tr Karakterler arasındaki boş nokta sütunu. Varsayılan 1. */
  spacing?: MaybeFn<number | undefined>;
  /** Your own glyphs, added to (or replacing) the 5×7 font: `{ "♥": [".#.#.", "#####", …] }`. @tr 5×7 yazı tipine eklenen (ya da yerini alan) kendi glifleriniz: `{ "♥": [".#.#.", "#####", …] }`. */
  glyphs?: Readonly<Record<string, DotGlyph>> | undefined;
  /** Dot shape: "round" (default) or "square". @tr Nokta biçimi: "round" (varsayılan) ya da "square". */
  dot?: MaybeFn<"round" | "square" | undefined>;
  /** Dot size: "sm", "md" (default), "lg", or the dot pitch in px. @tr Nokta boyutu: "sm", "md" (varsayılan), "lg" ya da px cinsinden nokta aralığı. */
  size?: MaybeFn<"sm" | "md" | "lg" | number | undefined>;
  /** Theme color token of the lit dots. Default amber ("warning"). @tr Yanık noktaların tema renk belirteci. Varsayılan amber ("warning"). */
  color?: MaybeFn<ColorToken | undefined>;
  /** How a new value appears: "wipe" (column by column, default), "dissolve" (dot by dot) or "none" (at once). @tr Yeni bir değerin gelişi: "wipe" (sütun sütun, varsayılan), "dissolve" (nokta nokta) ya da "none" (hemen). */
  transition?: MaybeFn<"wipe" | "dissolve" | "none" | undefined>;
  /** Length of that change (ms). Default 420. @tr Bu değişimin süresi (ms). Varsayılan 420. */
  duration?: MaybeFn<number | undefined>;
  /** Easing of the change (a name or a token). Default "out". @tr Değişimin yumuşatması (bir ad ya da belirteç). Varsayılan "out". */
  easing?: string | undefined;
  /** Motion: false (or "none") shows a new value at once and stops the scrolling (the start of the text stays); reduced motion does the same. Default true. @tr Hareket: false (ya da "none") yeni değeri hemen gösterir ve kaymayı durdurur (metnin başı kalır); azaltılmış hareket de öyle. Varsayılan true. */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Accessible name before the text. Default "Display". @tr Metinden önceki erişilebilir ad. Varsayılan "Display". */
  label?: MaybeFn<string | undefined>;
  /** Parts on or off: off (the unlit dots), glow (the light around the lit dots), bezel (the dark housing). @tr Parçalar açık ya da kapalı: off (sönük noktalar), glow (yanık noktaların ışıltısı), bezel (koyu gövde). */
  parts?: MaybeFn<DotMatrixParts | undefined>;
  /** Extra class on the root (`m-dm`). @tr Köke (`m-dm`) eklenen sınıf. */
  class?: ClassProp;
}

const ROWS = 7, GAP_CHARS = 3;
// the 5×7 font: ASCII 32–126 then the extra characters, 5 column bytes each (bit 0 = the top row), as hex
const ASCII = "000000000000005f00000007000700147f147f14242a7f2a12231308646236495522500005030000001c2241000041221c00082a1c2a0808083e080800503000000808080808006060000020100804023e5149453e00427f400042615149462141454b311814127f1027454545393c4a49493001710905033649494936064949291e003636000000563600000814224100141414141400412214080201510906324979413e7e1111117e7f494949363e414141227f4141221c7f494949417f090901013e414151327f0808087f00417f41002040413f017f081422417f404040407f0204027f7f0408107f3e4141413e7f090909063e4151215e7f09192946464949493101017f01013f4040403f1f2040201f7f2018207f631408146303047804036151494543007f41410002040810200041417f0004020102044040404040000102040020545454787f484444383844444420384444487f3854545418087e0901020c5252523e7f0804047800447d40002040443d007f1028440000417f40007c041804787c0804047838444444387c14141408081414187c7c080404084854545420043f4440203c4040207c1c2040201c3c4030403c44281028440c5050503c4464544c44000836410000007f000000413608000804081008";
const EXTRA = "ÇĞİÖŞÜçğıöşü°";
const EXTRA_HEX = "1e21612112384546553000447d4400384544453822256525193c4140413c1c22622210081556553c00447c40003846444638242a6a2a103c4240227c0006090906";
const cols5 = (hex: string, i: number): number[] => Array.from({ length: 5 }, (_, k) => parseInt(hex.slice(i * 10 + k * 2, i * 10 + k * 2 + 2), 16));

/** The 5 columns of `ch` (bit 0 = the top row): your glyphs first, then the font; an unknown character is a box. */
export function glyphOf(ch: string, own?: Readonly<Record<string, DotGlyph>>): number[] {
  const g = own?.[ch];
  if (g) {
    if (typeof g[0] === "string") return Array.from({ length: 5 }, (_, c) => (g as readonly string[]).reduce((b, row, r) => b | ((row[c] ?? " ") !== " " && row[c] !== "." ? 1 << r : 0), 0));
    return Array.from({ length: 5 }, (_, c) => Number(g[c]) & 127);
  }
  const code = ch.charCodeAt(0);
  if (ch.length === 1 && code >= 32 && code <= 126) return cols5(ASCII, code - 32);
  const x = EXTRA.indexOf(ch);
  if (x >= 0) return cols5(EXTRA_HEX, x);
  return [0x7f, 0x41, 0x41, 0x41, 0x7f];
}

/** The dot columns of a text: each character's 5 columns, `spacing` empty columns between characters. */
export function textColumns(text: string, spacing = 1, own?: Readonly<Record<string, DotGlyph>>): number[] {
  const out: number[] = [];
  [...text].forEach((ch, i) => { if (i) for (let s = 0; s < spacing; s++) out.push(0); out.push(...glyphOf(ch, own)); });
  return out;
}

/** A path of dots: one sub-path per lit (bit set) dot of `cols`, starting at column `x0`. */
function dotsPath(cols: readonly number[], round: boolean, x0 = 0): string {
  let d = "";
  const r = 0.39;
  for (let c = 0; c < cols.length; c++) {
    const v = cols[c]!;
    if (!v) continue;
    for (let row = 0; row < ROWS; row++) {
      if (!((v >> row) & 1)) continue;
      const x = c + x0 + 0.5, y = row + 0.5;
      d += round ? `M${+(x - r).toFixed(2)} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0` : `M${+(x - r).toFixed(2)} ${+(y - r).toFixed(2)}h${r * 2}v${r * 2}h${-r * 2}z`;
    }
  }
  return d;
}
// a fixed pseudo-random order of the dots for the dissolve (the same every time)
const order = (c: number, r: number): number => { const s = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453; return s - Math.floor(s); };

/** `<DotMatrix value="ANKARA 14:05" />` */
export function DotMatrix(props: DotMatrixProps): Element {
  const own = (): Readonly<Record<string, DotGlyph>> | undefined => props.glyphs;
  const parts = (): DotMatrixParts => val(props.parts) ?? {};
  // FORMAT number: a function, or Intl options in the page's language
  const text = computed((): string => {
    const v = val(props.value);
    if (typeof v !== "number") return v == null ? "" : String(v);
    const f = props.format;
    return typeof f === "function" ? f(v) : new Intl.NumberFormat(locale(), f).format(v);
  });
  const spacing = (): number => clamp(Math.round(val(props.spacing) ?? 1), 0, 4);
  const cols = computed(() => textColumns(text(), spacing(), own()));
  // the window in dot columns: `columns` characters, or as wide as the text
  const width = computed((): number => {
    const n = val(props.columns), s = spacing();
    return Math.max(5, n && n > 0 ? Math.round(n) * (5 + s) - s : cols().length);
  });
  const scrolls = computed(() => val(props.scroll) !== false && cols().length > width());
  const rtl = signal(false);
  // the text placed in the window (aligned when it is shorter; a start in a right-to-left page is on the right)
  const placed = computed((): number[] => {
    const c = cols(), w = width();
    if (c.length >= w) return scrolls() ? c : c.slice(0, w);
    const a = val(props.align) ?? "start", free = w - c.length;
    const left = a === "center" ? Math.floor(free / 2) : (a === "end") !== rtl() ? free : 0;
    return [...Array<number>(left).fill(0), ...c, ...Array<number>(free - left).fill(0)];
  });
  // a scrolling text runs in a loop: the text, a gap of three characters, the text again
  const loop = computed(() => cols().length + GAP_CHARS * (5 + spacing()));

  // ANIMATE the change: `shown` is the window as drawn while a change runs (null: the text itself, placed / scrolling)
  const shown = signal<number[] | null>(null);
  // the scroll position in dot columns (`pos`, fractional) and the column drawn (`col`: the board moves a whole column at a time)
  const col = signal(0);
  let pos = 0;
  const windowOf = (src: readonly number[], at: number, loopLen: number | null): number[] => {
    const w = width(), out = new Array<number>(w).fill(0);
    for (let i = 0; i < w; i++) { const k = loopLen ? (((i + at) % loopLen) + loopLen) % loopLen : i; out[i] = src[k] ?? 0; }
    return out;
  };
  const mix = (a: readonly number[], b: readonly number[], q: number): number[] => {
    const kind = val(props.transition) ?? "wipe", w = width(), out = new Array<number>(w).fill(0), rev = rtl();
    for (let c = 0; c < w; c++) {
      const x = a[c] ?? 0, y = b[c] ?? 0;
      if (kind === "dissolve") { let v = 0; for (let r = 0; r < ROWS; r++) v |= (((order(c, r) < q ? y : x) >> r) & 1) << r; out[c] = v; }
      else out[c] = ((rev ? w - 1 - c : c) + 0.5) / w < q ? y : x;
    }
    return out;
  };
  // what is on the board now: the text drawn last (and its loop when it scrolled) at the column shown
  let last: { src: number[]; loop: number | null } | null = null, tween: Playback | null = null, holdUntil = 0, clock = 0;
  effect(() => {
    const next = placed(), nextLoop = scrolls() ? loop() : null;
    width(); val(props.transition);
    untrack(() => {
      // a change mid-way starts from the mixed frame on the board
      const before = shown.peek() ?? (last ? windowOf(last.src, col.peek(), last.loop) : null);
      last = { src: next, loop: nextLoop };
      pos = 0; col.set(0); holdUntil = clock + (val(props.hold) ?? 1200);
      tween?.cancel(); tween = null;
      if (!before || (val(props.transition) ?? "wipe") === "none" || still(props.motion)) { shown.set(null); return; }
      const goal = windowOf(next, 0, nextLoop);
      shown.set(mix(before, goal, 0));
      const me = (tween = animateValue(0, 1, {
        duration: val(props.duration) ?? 420, easing: props.easing ?? "out",
        onUpdate: (q: number) => { if (tween === me) shown.set(q >= 1 ? null : mix(before, goal, q)); },
      }));
      // done: the board draws the text itself again (placed, scrolling)
      void me.finished.then(() => { if (tween === me) { tween = null; shown.set(null); } }, () => {});
    });
  });
  onCleanup(() => tween?.cancel());

  // TIMER frame: the scroll moves on the engine's clock while on screen, scrolling, not paused, not hovered
  const visible = signal(true), hovered = signal(false);
  const running = computed(() => visible() && scrolls() && !val(props.paused) && !(hovered() && (val(props.pauseOnHover) ?? true)) && !still(props.motion));
  effect(() => {
    if (!running()) return;
    onCleanup(onFrame((_t, dt) => {
      clock += dt;
      if (shown.peek() || clock < holdUntil) return;
      pos = (pos + (dt / 1000) * Math.max(0.5, val(props.speed) ?? 18)) % loop();
      col.set(Math.floor(pos));
    }, { phase: "update" }));
  });
  // motion off: the start of the text stands
  effect(() => { if (still(props.motion)) { pos = 0; col.set(0); } });

  // ---- the drawing (viewBox in dots: one dot per unit)
  // the scrolling text runs left (the way the font's letters read) whatever the page's direction
  const round = (): boolean => val(props.dot) !== "square";
  const lit = computed((): string => {
    const s = shown();
    if (s) return dotsPath(s, round());
    const src = placed();
    // a scrolling text is drawn with its next lap, so the loop has no seam; the group moves by the column
    return scrolls() ? dotsPath(src, round()) + dotsPath(src, round(), loop()) : dotsPath(src, round());
  });
  const shift = computed(() => (shown() || !scrolls() ? null : `translate(${-col()} 0)`));
  const unlit = computed(() => (parts().off === false ? "" : dotsPath(new Array<number>(width()).fill(127), round())));
  const pitch = (): string | null => { const s = val(props.size); return typeof s === "number" ? `${s}px` : null; };
  const screen = h("svg", {
    class: "m-dm-screen", "aria-hidden": "true", focusable: "false",
    viewBox: () => `0 0 ${width()} ${ROWS}`, preserveAspectRatio: "xMidYMid meet",
    style: () => ({ "--m-dm-cols": width() }),
  },
  h("path", { class: "m-dm-off", d: unlit }),
  h("g", { class: () => cx("m-dm-lit", parts().glow !== false && "is-glow"), transform: shift }, h("path", { d: lit })));

  const root = h("div", {
    class: () => {
      const s = val(props.size);
      return cx("m-dm", typeof s === "string" && `m-dm-${s}`, parts().bezel === false && "m-dm-bare", scrolls() && "is-scrolling", shown() && "is-changing", val(props.class));
    },
    role: "img",
    "data-m-color": () => colorAttr(val(props.color)),
    "aria-label": () => { const l = val(props.label) ?? t`Display`; return text() ? `${l}: ${text()}` : l; },
    style: () => ({ "--m-dm-dot": pitch() }),
    onPointerEnter: () => hovered.set(true),
    onPointerLeave: () => hovered.set(false),
  }, screen) as HTMLElement;

  // OBSERVE visible: no scrolling off screen; MIRROR rtl: read once the display is in the page
  whenVisible(root, (v) => { visible.set(v); if (v) rtl.set(isRtl(root)); });
  return root;
}
