// Spectrum (march/media): the frequencies of a sound, live. Bars on a log-frequency scale (low notes get as much room
// as high ones) with falling peak caps, mirrored around the middle, around a circle or as a line; one theme color, the
// four HADİ colors or your own tokens. It reads any march/audio source and draws on the motion clock.
import "./spectrum.css";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, clamp, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, colorList, tokenColor, type ColorToken, type MultiColors } from "../../../theme/colors.ts";
import { still } from "../../../motion/engine/parts.ts";
import { now, mutate } from "../../../motion/engine/clock.ts";
import { type AudioSource, type AudioSourceLike } from "../../../audio/index.ts";
import { audioCanvas } from "../../../audio/canvas.ts";
import { barEdges, barValues } from "./bands.ts";
import { levelInWords, hzInWords } from "../oscilloscope/words.ts";
import { liveSource } from "../../../audio/live.ts";

/** What an own drawing layer gets after each frame. @tr Kendi çizim katmanının her karede aldığı. */
export interface SpectrumFrame {
  /** Box width in CSS px. @tr Kutu genişliği (CSS px). */
  width: number;
  /** Box height in CSS px. @tr Kutu yüksekliği (CSS px). */
  height: number;
  /** Each bar's value 0–1, low to high. @tr Her çubuğun değeri 0–1, pesten tize. */
  values: Float32Array;
  /** Each bar's peak cap 0–1. @tr Her çubuğun tepe başlığı 0–1. */
  peaks: Float32Array;
  /** The bar edges in Hz (bars + 1). @tr Çubuk sınırları (Hz; çubuk sayısı + 1). */
  edges: Float32Array;
  /** The bar color (a CSS color read from the theme; the first one of several). @tr Çubuk rengi (temadan okunan CSS rengi; birden çoksa ilki). */
  color: string;
  /** True while the source delivers readings. @tr Kaynak okuma verdiği sürece true. */
  active: boolean;
}

export interface SpectrumProps {
  /** What to show: an audio source (march/audio), "demo", "mic", an <audio> element, a stream or a number 0–1. Nothing: empty bars. Start a "mic" / "demo" source from a click. @tr Gösterilecek: bir ses kaynağı (march/audio), "demo", "mic", bir <audio> öğesi, bir akış ya da 0–1 bir sayı. Yoksa: boş çubuklar. "mic" / "demo" kaynağını bir tıklamayla başlatın. */
  source?: AudioSourceLike | undefined;
  /** "bars" (default) · "mirror": around the middle line · "circle": around a ring · "line": a curve with a soft fill. @tr "bars" (varsayılan) · "mirror": orta çizginin iki yanına · "circle": bir halkanın çevresine · "line": yumuşak dolgulu eğri. */
  variant?: MaybeFn<"bars" | "mirror" | "circle" | "line" | undefined>;
  /** Number of bars. Default 48. @tr Çubuk sayısı. Varsayılan 48. */
  bars?: MaybeFn<number | undefined>;
  /** Frequency scale: "log" (default; as the ear hears) or "linear". @tr Frekans ölçeği: "log" (varsayılan; kulağın duyduğu gibi) ya da "linear". */
  scale?: MaybeFn<"log" | "linear" | undefined>;
  /** Lowest frequency in Hz. Default 30. @tr En düşük frekans (Hz). Varsayılan 30. */
  minHz?: MaybeFn<number | undefined>;
  /** Highest frequency in Hz. Default 16000. @tr En yüksek frekans (Hz). Varsayılan 16000. */
  maxHz?: MaybeFn<number | undefined>;
  /** Falling peak caps above the bars. Default true; off with reduced motion. @tr Çubukların üstünde düşen tepe başlıkları. Varsayılan true; azaltılmış harekette kapalı. */
  peaks?: MaybeFn<boolean | undefined>;
  /** How fast a peak cap falls, in full heights per second. Default 0.5. @tr Tepe başlığının düşüş hızı (saniyede tam yükseklik). Varsayılan 0,5. */
  peakFall?: MaybeFn<number | undefined>;
  /** Space between bars in px. Default 2. @tr Çubuklar arası boşluk (px). Varsayılan 2. */
  gap?: MaybeFn<number | undefined>;
  /** Corner radius of the bars in px. Default 2. @tr Çubuk köşe yarıçapı (px). Varsayılan 2. */
  radius?: MaybeFn<number | undefined>;
  /** Amplification (1 = as measured). Default 1. @tr Yükseltme (1 = ölçüldüğü gibi). Varsayılan 1. */
  gain?: MaybeFn<number | undefined>;
  /** One theme color token: "brand-blue", "success", "cat-3"… Default: the accent. @tr Tek tema renk belirteci: "brand-blue", "success", "cat-3"… Varsayılan: vurgu rengi. */
  color?: MaybeFn<ColorToken | undefined>;
  /** Several colors from low to high: "brand" (the four HADİ colors) or a list of tokens; "single": one color. @tr Pesten tize birden çok renk: "brand" (dört HADİ rengi) ya da belirteç listesi; "single": tek renk. */
  colors?: MultiColors | undefined;
  /** How several colors are laid out: "gradient" (default) or "segments" (equal hard-edged parts). @tr Birden çok renk nasıl dizilir: "gradient" (varsayılan) ya da "segments" (keskin sınırlı eşit parçalar). */
  paint?: "gradient" | "segments" | undefined;
  /** Height: px or a CSS length. Default 160px. @tr Yükseklik: px ya da CSS uzunluğu. Varsayılan 160px. */
  height?: MaybeFn<number | string | undefined>;
  /** Accessible name (default "Spectrum"). @tr Erişilebilir ad (varsayılan "Spektrum"). */
  label?: MaybeFn<string | undefined>;
  /** Text shown while there is no signal (default "No signal"); false: none. @tr Sinyal yokken gösterilen metin (varsayılan "Sinyal yok"); false: yok. */
  idleText?: MaybeFn<string | false | undefined>;
  /** Your own layer, drawn after each frame: `(ctx, frame) => …` (labels, a band marker). @tr Her karede sonra çizilen kendi katmanınız: `(ctx, frame) => …` (etiketler, bant işareti). */
  draw?: ((ctx: CanvasRenderingContext2D, frame: SpectrumFrame) => void) | undefined;
  /** false or "none": no falling caps (as with reduced motion). @tr false ya da "none": düşen başlık yok (azaltılmış harekette olduğu gibi). */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

type Ctx = CanvasRenderingContext2D;
const bar = (ctx: Ctx, x: number, y: number, w: number, hgt: number, r: number): void => {
  const rr = clamp(r, 0, Math.min(w, hgt) / 2);
  if (rr && ctx.roundRect) ctx.roundRect(x, y, w, hgt, rr); else ctx.rect(x, y, w, hgt);
};

/** `<Spectrum source={song} variant="mirror" colors="brand" />` */
export function Spectrum(props: SpectrumProps): Element {
  // the source as given now (another one later: the view follows it)
  const source = liveSource(() => props.source);
  let src: AudioSource | null = null;
  const on = (): boolean => !!source()?.active();
  const colors = computed(() => colorList(props.colors), { equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
  const heard = signal({ level: 0, hz: 0 });
  const size = (): string | undefined => { const x = val(props.height); return x == null ? undefined : typeof x === "number" ? `${x}px` : x; };
  let spec = new Float32Array(1024);
  let values: Float32Array = new Float32Array(0), peaks: Float32Array = new Float32Array(0), edges: Float32Array = new Float32Array(0), edgeKey = "", last = now();
  const layout = (): number => {
    const n = Math.max(1, Math.round(val(props.bars) ?? 48));
    const key = `${n}|${val(props.minHz) ?? 30}|${val(props.maxHz) ?? 16000}|${val(props.scale) ?? "log"}`;
    if (key !== edgeKey) {
      edgeKey = key;
      edges = barEdges(n, val(props.minHz) ?? 30, val(props.maxHz) ?? 16000, val(props.scale) === "linear" ? "linear" : "log");
      if (values.length !== n) { values = new Float32Array(n); peaks = new Float32Array(n); }
    }
    return n;
  };
  const capsOn = (): boolean => (val(props.peaks) ?? true) && !still(props.motion);
  // a new reading: each bar's value, and the peak caps falling toward it (read phase, before the frame is drawn)
  const sample = (): void => {
    const n = layout(), at = now(), dt = Math.min(0.25, Math.max(0, (at - last) / 1000)), caps = capsOn();
    last = at;
    if (on() && src) barValues(src.spectrum(spec), edges, src.sampleRate() || 48000, values, val(props.gain) ?? 1); else values.fill(0);
    const fall = (val(props.peakFall) ?? 0.5) * dt;
    for (let i = 0; i < n; i++) peaks[i] = caps ? Math.max(values[i]!, peaks[i]! - fall) : values[i]!;
  };
  const colorVars = (): Record<string, string> => {
    const out: Record<string, string> = {};
    colors()?.forEach((tok, i) => { out[`--m-spec-c${i}`] = tokenColor(tok); });
    return out;
  };

  const canvas = h("canvas", { class: "m-spec-canvas", "aria-hidden": "true" }) as HTMLCanvasElement;
  const root = h("div", {
    class: () => cx("m-spec", `m-spec-${val(props.variant) ?? "bars"}`, !on() && "is-idle", val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)), "data-m-colors": () => (colors() ? (Array.isArray(props.colors) ? "custom" : String(props.colors)) : null),
    role: "img",
    "aria-label": () => {
      const name = val(props.label) ?? t`Spectrum`;
      if (!on()) { const idle = val(props.idleText); return `${name}: ${typeof idle === "string" ? idle : t`No signal`}`; }
      const { level, hz } = heard(), words = levelInWords(level);
      return `${name}: ${level < 0.02 || !hz ? words : t`${words}, loudest near ${hzInWords(hz)}`}`;
    },
    style: () => ({ "--m-spec-h": size(), ...colorVars() }),
  },
  canvas,
  () => { const idle = val(props.idleText); return idle === false ? null : h("span", { class: "m-spec-idle", "aria-hidden": "true" }, () => (typeof idle === "string" ? idle : t`No signal`)); }) as HTMLElement;

  const view = audioCanvas(canvas, (ctx, w, hgt, color) => {
    const n = layout(), live = on() && !!src, variant = val(props.variant) ?? "bars", caps = live && capsOn(), list = untrack(colors);

    ctx.clearRect(0, 0, w, hgt);
    // the paint: one color, or the list from low to high (a gradient or hard segments); a ring gets it around itself
    const cxy = [w / 2, hgt / 2] as const;
    let paint: string | CanvasGradient = color("--m-spec-bar");
    if (list && list.length > 1) {
      const g = variant === "circle" && ctx.createConicGradient ? ctx.createConicGradient(-Math.PI / 2, cxy[0], cxy[1]) : ctx.createLinearGradient(0, 0, w, 0);
      list.forEach((_, i) => {
        const c = color(`--m-spec-c${i}`);
        if (props.paint === "segments") { g.addColorStop(i / list.length, c); g.addColorStop((i + 1) / list.length - 1e-4, c); }
        else g.addColorStop(variant === "circle" ? i / list.length : i / (list.length - 1), c);
      });
      if (variant === "circle" && props.paint !== "segments") g.addColorStop(1, color("--m-spec-c0"));
      paint = g;
    } else if (list) paint = color("--m-spec-c0");
    const cap = color("--m-spec-peak"), idle = color("--m-spec-idle");
    const gap = Math.max(0, val(props.gap) ?? 2), r = val(props.radius) ?? 2;
    ctx.fillStyle = live ? paint : idle; ctx.strokeStyle = ctx.fillStyle;

    if (variant === "circle") {
      const m = Math.min(w, hgt), r0 = m * 0.24, len = m * 0.24;
      ctx.lineCap = "round"; ctx.lineWidth = Math.max(1, (2 * Math.PI * r0) / n - gap);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), l = Math.max(1, values[i]! * len);
        ctx.moveTo(cxy[0] + c * r0, cxy[1] + s * r0); ctx.lineTo(cxy[0] + c * (r0 + l), cxy[1] + s * (r0 + l));
      }
      ctx.stroke();
      if (caps) {
        ctx.fillStyle = cap; ctx.beginPath();
        for (let i = 0; i < n; i++) {
          if (peaks[i]! < 0.02) continue;
          const a = -Math.PI / 2 + (i / n) * Math.PI * 2, d = r0 + peaks[i]! * len + ctx.lineWidth;
          ctx.moveTo(cxy[0] + Math.cos(a) * d + 1.25, cxy[1] + Math.sin(a) * d); ctx.arc(cxy[0] + Math.cos(a) * d, cxy[1] + Math.sin(a) * d, 1.25, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    } else if (variant === "line") {
      const step = w / n, y = (v: number): number => hgt - 2 - v * (hgt - 6);
      ctx.beginPath(); ctx.moveTo(0, y(values[0]!));
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * step, nx = (i + 1.5) * step, v = values[i]!, nv = values[Math.min(n - 1, i + 1)]!;
        ctx.quadraticCurveTo(x, y(v), (x + nx) / 2, (y(v) + y(nv)) / 2);
      }
      ctx.lineTo(w, y(values[n - 1]!));
      ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
      if (live) { ctx.lineTo(w, hgt); ctx.lineTo(0, hgt); ctx.closePath(); ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; }
      if (caps) { ctx.fillStyle = cap; ctx.beginPath(); for (let i = 0; i < n; i++) { if (peaks[i]! < 0.02) continue; const x = (i + 0.5) * step, py = y(peaks[i]!) - 4; ctx.moveTo(x + 1.5, py); ctx.arc(x, py, 1.5, 0, Math.PI * 2); } ctx.fill(); }
    } else {
      // bars and mirror: equal widths; a quiet bar is dimmer than a loud one
      const g2 = Math.min(gap, (w / n) * 0.5), bw = (w - g2 * (n - 1)) / n, mirror = variant === "mirror", mid = hgt / 2;
      const full = mirror ? mid - 3 : hgt - 4, capH = 2;
      for (let i = 0; i < n; i++) {
        const x = i * (bw + g2), v = values[i]!, bh = Math.max(live ? 1 : 2, v * full);
        ctx.globalAlpha = live ? 0.45 + 0.55 * v : 1;
        ctx.beginPath(); bar(ctx, x, mirror ? mid - bh : hgt - bh, bw, mirror ? bh * 2 : bh, r); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (caps) {
        ctx.fillStyle = cap; ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = i * (bw + g2), p = peaks[i]! * full;
          if (p < 2) continue;
          if (mirror) { ctx.rect(x, mid - p - capH - 1, bw, capH); ctx.rect(x, mid + p + 1, bw, capH); }
          else ctx.rect(x, hgt - p - capH - 2, bw, capH);
        }
        ctx.fill();
      }
    }
    if (props.draw) { ctx.save(); props.draw(ctx, { width: w, height: hgt, values, peaks, edges, color: list ? color("--m-spec-c0") : color("--m-spec-bar"), active: live }); ctx.restore(); }
  });

  effect(() => {
    const given = source();
    untrack(() => {
      src = given;
      if (given && spec.length !== given.bins) spec = new Float32Array(given.bins);
      if (!given) return;
      given.use(root);
      let said = -1e9;
      onCleanup(given.onUpdate((s) => {
        sample(); view.draw();
        // the spoken summary (level and loudest band) changes at most once a second
        const at = now();
        if (at - said < 1000) return;
        said = at;
        let top = 0;
        for (let i = 1; i < values.length; i++) if (values[i]! > values[top]!) top = i;
        const hz = values[top]! > 0.05 ? Math.sqrt(edges[top]! * edges[top + 1]!) : 0;
        heard.set({ level: s.level(), hz: Math.round(hz) });
      }));
    });
  });
  // a new color, colors, variant or idle state: read the theme colors again and redraw
  effect(() => { val(props.color); colors(); val(props.variant); if (!on()) { layout(); values.fill(0); peaks.fill(0); } view.refresh(); });
  // any other drawn prop: draw again (an idle or paused view too)
  effect(() => {
    layout(); val(props.gap); val(props.radius); val(props.gain); val(props.peakFall); capsOn(); void props.paint;
    mutate(view.draw);
  });
  return root;
}
