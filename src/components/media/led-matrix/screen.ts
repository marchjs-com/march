// The LED screen every LED part renders (LedMatrix, PixelFont, PixelSprite, LedEyes, LedBoard): the look props, the
// panel with its canvas and bloom halo, and the painter that repaints only the LEDs that changed. Internal: the parts
// share it; apps use the components.
import { computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { mutate } from "../../../motion/engine/clock.ts";
import { watchVisibility, isVisible } from "../../../motion/engine/visibility.ts";
import { audioCanvas } from "../../../audio/canvas.ts";
import { ledFrame, ledArt, isLedFrame, type LedFrame } from "./frame.ts";

/** The shape of one LED. @tr Tek bir LED'in biçimi. */
export type LedShape = "round" | "square" | "tube";
/** One LED color for the whole screen, or "rgb" (each LED its own color, the rest the accent). @tr Tüm ekran için tek LED rengi ya da "rgb" (her LED kendi renginde, kalanlar vurgu renginde). */
export type LedColor = "rgb" | "theme" | "amber" | "green" | "red" | "blue" | "white" | ColorToken;
/** What a screen shows: a frame, or pixel art as text ("." off). @tr Ekranın gösterdiği: bir resim ya da metin olarak piksel çizimi ("." sönük). */
export type LedPicture = LedFrame | readonly string[] | null | undefined;

/** The look of an LED screen (shared by every LED part). @tr Bir LED ekranının görünümü (tüm LED parçalarında ortak). */
export interface LedLookProps {
  /** "round" (default) LEDs, "square" pixels or "tube" (glowing capsules). @tr "round" (varsayılan) LED, "square" piksel ya da "tube" (parlayan kapsül). */
  shape?: MaybeFn<LedShape | undefined>;
  /** Space between LEDs, 0–0.8 of an LED's pitch. Default 0.18. @tr LED'ler arası boşluk, adımın 0–0,8'i. Varsayılan 0,18. */
  gap?: MaybeFn<number | undefined>;
  /** Corner roundness of square pixels, 0 (sharp) – 1 (round). Default 0.3. @tr Kare piksellerin köşe yuvarlaklığı, 0 (keskin) – 1 (yuvarlak). Varsayılan 0,3. */
  roundness?: MaybeFn<number | undefined>;
  /** Bloom halo around lit LEDs in px; 0 or false: none. Default 6. @tr Yanan LED'lerin çevresindeki ışıma (px); 0 ya da false: yok. Varsayılan 6. */
  bloom?: MaybeFn<number | false | undefined>;
  /** How much unlit LEDs show, 0 (invisible) – 0.4. Default 0.1. @tr Sönük LED'lerin ne kadar göründüğü, 0 (görünmez) – 0,4. Varsayılan 0,1. */
  ghost?: MaybeFn<number | undefined>;
  /** Thin dark lines across the screen, like an old display. @tr Eski ekranlardaki gibi ekranı yatay geçen ince koyu çizgiler. */
  scanlines?: MaybeFn<boolean | undefined>;
  /** "rgb" (default: each LED its own color, the others the accent), "theme" (the accent only), "amber", "green", "red", "blue", "white" or a theme token ("brand-pink"). @tr "rgb" (varsayılan: her LED kendi renginde, diğerleri vurgu renginde), "theme" (yalnız vurgu rengi), "amber", "green", "red", "blue", "white" ya da bir tema belirteci ("brand-pink"). */
  color?: MaybeFn<LedColor | undefined>;
  /** "dark" (default): a black LED panel in both themes · "theme": the page's surface · "none": no panel. @tr "dark" (varsayılan): iki temada da siyah LED paneli · "theme": sayfanın yüzeyi · "none": panel yok. */
  panel?: MaybeFn<"dark" | "theme" | "none" | undefined>;
  /** Size of one LED in px (the screen is cols × pitch wide); default: the screen fills its width. @tr Bir LED'in px boyutu (ekran sütun × adım genişliğinde); varsayılan: ekran genişliği doldurur. */
  pitch?: MaybeFn<number | undefined>;
}

const MONO = new Set(["amber", "green", "red", "blue", "white"]);
const hex = (n: number): string => `#${(n - 1).toString(16).padStart(6, "0")}`;
const clampN = (x: unknown, lo: number, hi: number, d: number): number => (typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);

/** The look props as plain values (LedBoard and the other parts pass them on unchanged). */
export const LOOK_KEYS = ["shape", "gap", "roundness", "bloom", "ghost", "scanlines", "color", "panel", "pitch"] as const;

/** The root class and data attributes of a screen with this look (shared by every LED part). */
export function lookAttrs(p: LedLookProps): { class: () => string; "data-m-led": () => string | null; "data-m-color": () => string | null } {
  const c = (): string => (val(p.color) ?? "rgb") as string;
  return {
    class: () => cx(`m-led-${val(p.shape) ?? "round"}`, `m-led-panel-${val(p.panel) ?? "dark"}`, val(p.scanlines) && "is-scanlined"),
    "data-m-led": () => (MONO.has(c()) ? c() : null),
    "data-m-color": () => (MONO.has(c()) || c() === "rgb" || c() === "theme" ? null : colorAttr(c())),
  };
}

/** One LED drawn once per color and size; every lit LED is a copy of it (a canvas drawImage, not a path per LED). */
function dotSprite(shape: LedShape, size: number, round: number, color: string): HTMLCanvasElement | null {
  const c = globalThis.document?.createElement("canvas") as HTMLCanvasElement | undefined;
  const g = c?.getContext?.("2d");
  if (!c || !g) return null;
  const s = Math.max(1, Math.ceil(size));
  c.width = s; c.height = s;
  g.fillStyle = color;
  g.beginPath();
  if (shape === "square") {
    const r = (s / 2) * round;
    g.roundRect ? g.roundRect(0, 0, s, s, r) : g.rect(0, 0, s, s);
    g.fill();
  } else if (shape === "tube") {
    // a capsule standing upright, brighter along its middle like a filament
    const w = s * 0.62, x = (s - w) / 2;
    g.roundRect ? g.roundRect(x, 0, w, s, w / 2) : g.rect(x, 0, w, s);
    g.fill();
    const core = g.createLinearGradient(x, 0, x + w, 0);
    core.addColorStop(0, "rgba(255,255,255,0)"); core.addColorStop(0.5, "rgba(255,255,255,.45)"); core.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = core; g.fill();
  } else {
    g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    g.fill();
    // a soft highlight: an LED is a little lens, brighter in its middle
    const hi = g.createRadialGradient(s * 0.42, s * 0.38, 0, s / 2, s / 2, s / 2);
    hi.addColorStop(0, "rgba(255,255,255,.5)"); hi.addColorStop(0.55, "rgba(255,255,255,0)");
    g.fillStyle = hi; g.fill();
  }
  return c;
}

/** The painter of a screen: what LedMatrix (and LedBoard through it) uses to put a frame on a canvas. */
export interface LedPainter {
  /** Paint the frame now (changed LEDs only). */
  paint(): void;
  /** Repaint every LED on the next frame (after a look change). */
  invalidate(): void;
}

/** Paint `frame()` on `canvas` with the look `p`; the halo canvas (optional) gets a blurred copy for the bloom. */
export function ledPainter(canvas: HTMLCanvasElement, halo: HTMLCanvasElement | null, frame: () => LedFrame, p: LedLookProps, host: Element): LedPainter {
  let shown = ledFrame(0, 0), all = true, key = "", sprites = new Map<string, HTMLCanvasElement | null>();
  const hctx = halo?.getContext?.("2d") ?? null;
  const view = audioCanvas(canvas, (ctx, w, hgt, color) => {
    if (!isVisible(host)) { all = true; return; }
    const f = frame(), cols = f.cols, rows = f.rows;
    if (!cols || !rows) { ctx.clearRect(0, 0, w, hgt); shown = ledFrame(0, 0); return; }
    const pitch = Math.min(w / cols, hgt / rows), ox = (w - pitch * cols) / 2, oy = (hgt - pitch * rows) / 2;
    const shape = (val(p.shape) ?? "round") as LedShape, gap = clampN(val(p.gap), 0, 0.8, 0.18), round = clampN(val(p.roundness), 0, 1, 0.3);
    const ghost = clampN(val(p.ghost), 0, 0.4, 0.1), base = color("--m-led-on", "#ffb000"), mono = (val(p.color) ?? "rgb") !== "rgb";
    const dpr = globalThis.devicePixelRatio || 1, dot = pitch * (1 - gap), inset = (pitch - dot) / 2;
    const k = `${w}|${hgt}|${cols}|${rows}|${shape}|${gap}|${round}|${ghost}|${base}|${mono}|${dpr}`;
    if (k !== key || all || shown.cols !== cols || shown.rows !== rows) {
      if (k !== key) sprites = new Map();
      key = k; all = true;
      ctx.clearRect(0, 0, w, hgt);
      if (shown.cols !== cols || shown.rows !== rows) shown = ledFrame(cols, rows);
    }
    const sprite = (c: string): HTMLCanvasElement | null => {
      let s = sprites.get(c);
      if (s === undefined) { s = dotSprite(shape, dot * dpr, round, c); sprites.set(c, s); }
      return s;
    };
    for (let y = 0, i = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, i++) {
        const v = f.lit[i]!, rgb = mono ? 0 : f.rgb[i]!;
        if (!all && shown.lit[i] === v && shown.rgb[i] === rgb) continue;
        shown.lit[i] = v; shown.rgb[i] = rgb;
        const px = ox + x * pitch, py = oy + y * pitch;
        // the LED's own cell only: neighbours stay as they are
        if (!all) ctx.clearRect(px, py, pitch, pitch);
        const a = ghost + (1 - ghost) * (v / 255);
        if (a < 0.004) continue;
        const c = rgb ? hex(rgb) : base, s = sprite(c);
        ctx.globalAlpha = a;
        if (s) ctx.drawImage(s, px + inset, py + inset, dot, dot);
        else { ctx.fillStyle = c; ctx.fillRect(px + inset, py + inset, dot, dot); }
      }
    }
    ctx.globalAlpha = 1;
    all = false;
    // the bloom: a quarter-size copy of the screen, blurred by CSS (one GPU blit, whatever the number of LEDs)
    if (hctx && halo && val(p.bloom) !== false && val(p.bloom) !== 0) {
      const hw = Math.max(1, Math.round(canvas.width / 4)), hh = Math.max(1, Math.round(canvas.height / 4));
      if (halo.width !== hw) halo.width = hw;
      if (halo.height !== hh) halo.height = hh;
      hctx.clearRect(0, 0, hw, hh);
      hctx.drawImage(canvas, 0, 0, hw, hh);
    }
  });
  let queued = false;
  const paint = (): void => { if (queued) return; queued = true; mutate(() => { queued = false; view.draw(); }); };
  // back on screen: everything is painted again (nothing was painted while away)
  onCleanup(watchVisibility(host, (on) => { if (on) { all = true; paint(); } }));
  return { paint, invalidate: () => { all = true; view.refresh(); } };
}

/** The picture a prop gives, as a frame (art is parsed once per value). */
export function pictureOf(pic: () => LedPicture, palette: () => Record<string, string> | undefined): () => LedFrame {
  return computed(() => {
    const x = pic();
    if (isLedFrame(x)) return x;
    return Array.isArray(x) ? ledArt(x as readonly string[], palette()) : ledFrame(0, 0);
  }, { equals: false });
}

/** The screen element every LED part renders: panel, canvas, halo; `frame` is painted whenever it changes. */
export function ledScreen(look: LedLookProps, frame: () => LedFrame, label: () => string, cls?: ClassProp, extra?: unknown, attrs?: Record<string, unknown>): HTMLElement {
  const a = lookAttrs(look);
  const halo = h("canvas", { class: "m-led-halo", "aria-hidden": "true" }) as HTMLCanvasElement;
  const canvas = h("canvas", { class: "m-led-canvas", "aria-hidden": "true" }) as HTMLCanvasElement;
  const bloom = (): number => { const b = val(look.bloom); return b === false ? 0 : clampN(b, 0, 40, 6); };
  const root = h("div", {
    role: "img", ...attrs,
    class: () => cx("m-led", a.class(), val(cls)), "data-m-led": a["data-m-led"], "data-m-color": a["data-m-color"],
    "aria-label": label,
    style: () => {
      const f = frame(), p = val(look.pitch);
      return { "--m-led-cols": f.cols, "--m-led-rows": f.rows, "--m-led-bloom": `${bloom()}px`, "--m-led-w": p ? `${f.cols * p}px` : undefined };
    },
  }, h("div", { class: "m-led-screen" }, () => (bloom() ? halo : null), canvas), extra ?? null) as HTMLElement;
  const painter = ledPainter(canvas, halo, frame, look, root);
  effect(() => { frame(); painter.paint(); });
  // a new look: every LED again, with the theme colors read again
  effect(() => { for (const k of LOOK_KEYS) val(look[k]); untrack(() => painter.invalidate()); });
  return root;
}

/** The props of a part drawn on LedMatrix: the part's own props (read lazily, so live values stay live) plus overrides. */
export function screenProps<P extends object>(props: P, own: Record<string, unknown>): P {
  const o = Object.create(props) as P;
  for (const k in own) Object.defineProperty(o, k, { value: own[k], enumerable: true });
  return o;
}
