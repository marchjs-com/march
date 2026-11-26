// Oscilloscope (march/media): the shape of a sound, live. A trace of the waveform over a graticule, triggered so the
// picture stands still, with a phosphor afterglow (the last frames fade instead of vanishing); `mode="xy"` draws the
// left channel against the right (a Lissajous figure; a mono input is paired with itself a quarter period later).
// Two looks: a clean modern panel and a retro CRT. It reads any march/audio source and draws on the motion clock.
import "./oscilloscope.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { still } from "../../../motion/engine/parts.ts";
import { now, mutate } from "../../../motion/engine/clock.ts";
import { type AudioSource, type AudioSourceLike } from "../../../audio/index.ts";
import { audioCanvas } from "../../../audio/canvas.ts";
import { triggerIndex, periodOf, isMono } from "./trace.ts";
import { liveSource } from "../../../audio/live.ts";
import { levelInWords } from "./words.ts";

/** What an own drawing layer gets after each trace. @tr Kendi çizim katmanının her izden sonra aldığı. */
export interface OscilloscopeFrame {
  /** Box width in CSS px. @tr Kutu genişliği (CSS px). */
  width: number;
  /** Box height in CSS px. @tr Kutu yüksekliği (CSS px). */
  height: number;
  /** The left channel, −1…1 (empty while idle). @tr Sol kanal, −1…1 (boştayken sıfırlar). */
  samples: Float32Array;
  /** The trace color (a CSS color read from the theme). @tr İzin rengi (temadan okunan CSS rengi). */
  color: string;
  /** True while the source delivers readings. @tr Kaynak okuma verdiği sürece true. */
  active: boolean;
}

export interface OscilloscopeProps {
  /** What to show: an audio source (march/audio), "demo", "mic", an <audio> element, a stream or a number 0–1. Nothing: a quiet flat line. Start a "mic" / "demo" source from a click. @tr Gösterilecek: bir ses kaynağı (march/audio), "demo", "mic", bir <audio> öğesi, bir akış ya da 0–1 bir sayı. Yoksa: sessiz düz çizgi. "mic" / "demo" kaynağını bir tıklamayla başlatın. */
  source?: AudioSourceLike | undefined;
  /** "wave" (default): the signal over time · "xy": left against right (a Lissajous figure). @tr "wave" (varsayılan): zamana göre sinyal · "xy": sol kanala karşı sağ (Lissajous şekli). */
  mode?: MaybeFn<"wave" | "xy" | undefined>;
  /** Start each sweep where the signal rises through 0 (true, default) or through this level (−1…1), so the wave stands still; false: free running. @tr Her taramayı sinyalin 0'dan (true, varsayılan) ya da bu düzeyden (−1…1) yükseldiği yerde başlat, dalga sabit dursun; false: serbest akış. */
  trigger?: MaybeFn<boolean | number | undefined>;
  /** Time across the screen in ms. Default 20. @tr Ekranın enine sığan süre (ms). Varsayılan 20. */
  timebase?: MaybeFn<number | undefined>;
  /** Phosphor afterglow 0 (none: each frame clears) – 0.95 (long trails). Default 0.55. Off with reduced motion. @tr Fosfor iz kalıcılığı 0 (yok: her kare silinir) – 0,95 (uzun iz). Varsayılan 0,55. Azaltılmış harekette kapalı. */
  persistence?: MaybeFn<number | undefined>;
  /** The graticule: true (10 × 8 divisions, default), false, or `{ x, y }` divisions. @tr Ölçek ızgarası: true (10 × 8 bölme, varsayılan), false ya da `{ x, y }` bölme sayısı. */
  grid?: MaybeFn<boolean | { x?: number | undefined; y?: number | undefined } | undefined>;
  /** "modern" (default): a clean panel in the theme · "crt": a dark phosphor tube with scanlines. @tr "modern" (varsayılan): temaya uyan sade panel · "crt": tarama çizgili koyu fosfor tüp. */
  look?: MaybeFn<"modern" | "crt" | undefined>;
  /** Trace color, a theme token: "brand-green", "success", "cat-3"… Default: the accent (phosphor green on "crt"). @tr İz rengi, tema belirteci: "brand-green", "success", "cat-3"… Varsayılan: vurgu rengi ("crt"de fosfor yeşili). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Trace width in px. Default 2. @tr İz kalınlığı (px). Varsayılan 2. */
  lineWidth?: MaybeFn<number | undefined>;
  /** Glow around the trace in px; 0 or false: none. Default 8 (14 on "crt"). @tr İzin çevresindeki parıltı (px); 0 ya da false: yok. Varsayılan 8 ("crt"de 14). */
  glow?: MaybeFn<number | false | undefined>;
  /** Vertical amplification (1 = full scale). Default 1. @tr Dikey yükseltme (1 = tam ölçek). Varsayılan 1. */
  gain?: MaybeFn<number | undefined>;
  /** Height: px or a CSS length. Default 180px. @tr Yükseklik: px ya da CSS uzunluğu. Varsayılan 180px. */
  height?: MaybeFn<number | string | undefined>;
  /** Accessible name (default "Oscilloscope"). @tr Erişilebilir ad (varsayılan "Osiloskop"). */
  label?: MaybeFn<string | undefined>;
  /** Text on the screen while there is no signal (default "No signal"); false: none. @tr Sinyal yokken ekrandaki metin (varsayılan "Sinyal yok"); false: yok. */
  idleText?: MaybeFn<string | false | undefined>;
  /** Your own layer, drawn after each trace: `(ctx, frame) => …` (markers, a cursor, a label). @tr Her izden sonra çizilen kendi katmanınız: `(ctx, frame) => …` (işaretler, imleç, etiket). */
  draw?: ((ctx: CanvasRenderingContext2D, frame: OscilloscopeFrame) => void) | undefined;
  /** false or "none": no afterglow (as with reduced motion). @tr false ya da "none": iz kalıcılığı yok (azaltılmış harekette olduğu gibi). */
  motion?: MaybeFn<boolean | "none" | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

const fit = (x: number): number => (x < -1 ? -1 : x > 1 ? 1 : x);

/** `<Oscilloscope source={song} look="crt" />` */
export function Oscilloscope(props: OscilloscopeProps): Element {
  // the source as given now (another one later: the view follows it)
  const source = liveSource(() => props.source);
  let src: AudioSource | null = null;
  const on = (): boolean => !!source()?.active();
  const heard = signal(0);
  const look = (): "modern" | "crt" => (val(props.look) === "crt" ? "crt" : "modern");
  const grid = (): { x: number; y: number } | null => {
    const g = val(props.grid);
    return g === false ? null : { x: (typeof g === "object" && g.x) || 10, y: (typeof g === "object" && g.y) || 8 };
  };
  const size = (): string | undefined => { const x = val(props.height); return x == null ? undefined : typeof x === "number" ? `${x}px` : x; };
  let n = 1024, left = new Float32Array(n), right = new Float32Array(n);

  const canvas = h("canvas", { class: "m-osc-canvas", "aria-hidden": "true" }) as HTMLCanvasElement;
  const root = h("div", {
    class: () => cx("m-osc", `m-osc-${look()}`, !on() && "is-idle", val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)), role: "img",
    "aria-label": () => {
      const name = val(props.label) ?? t`Oscilloscope`;
      if (on()) return `${name}: ${levelInWords(heard())}`;
      const idle = val(props.idleText);
      return `${name}: ${typeof idle === "string" ? idle : t`No signal`}`;
    },
    style: () => { const g = grid(); return { "--m-osc-h": size(), "--m-osc-gx": g?.x, "--m-osc-gy": g?.y }; },
  },
  () => (grid() ? h("div", { class: "m-osc-grid", "aria-hidden": "true" }) : null),
  canvas,
  () => { const idle = val(props.idleText); return idle === false ? null : h("span", { class: "m-osc-idle", "aria-hidden": "true" }, () => (typeof idle === "string" ? idle : t`No signal`)); }) as HTMLElement;

  const view = audioCanvas(canvas, (ctx, w, hgt, color) => {
    const live = on(), crt = look() === "crt";
    const fade = live && !still(props.motion) ? Math.min(0.95, Math.max(0, val(props.persistence) ?? 0.55)) : 0;
    if (fade > 0) {
      // phosphor: the previous frames fade out a little instead of vanishing
      ctx.save(); ctx.globalCompositeOperation = "destination-out"; ctx.globalAlpha = 1 - fade;
      ctx.fillStyle = color("--m-scrim", "black"); ctx.fillRect(0, 0, w, hgt); ctx.restore();
    } else ctx.clearRect(0, 0, w, hgt);
    const line = color("--m-osc-line");
    const g = val(props.glow), blur = g === false ? 0 : g ?? (crt ? 14 : 8);
    ctx.save();
    ctx.lineWidth = val(props.lineWidth) ?? 2; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = line; ctx.fillStyle = line;
    const xy = val(props.mode) === "xy", cx0 = w / 2, cy0 = hgt / 2;
    if (!live || !src) {
      left.fill(0);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      if (xy) { ctx.arc(cx0, cy0, ctx.lineWidth * 1.5, 0, Math.PI * 2); ctx.fill(); } else { ctx.moveTo(0, cy0); ctx.lineTo(w, cy0); ctx.stroke(); }
    } else {
      if (blur) { ctx.shadowColor = line; ctx.shadowBlur = blur; }
      const gain = val(props.gain) ?? 1;
      src.waveform(left, 0);
      ctx.beginPath();
      if (xy) {
        src.waveform(right, 1);
        // a mono input has nothing to plot against: pair it with itself a quarter period later (an ellipse, not a line)
        const shift = isMono(left, right) ? Math.max(1, Math.round(periodOf(left) / 4) || 12) : 0;
        const r = (Math.min(w, hgt) / 2) * 0.9, end = n - shift;
        for (let i = 0; i < end; i++) {
          const x = cx0 + fit(left[i]! * gain) * r, y = cy0 - fit((shift ? left[i + shift]! : right[i]!) * gain) * r;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
      } else {
        const rate = src.sampleRate() || 48000;
        const span = Math.min(n - 1, Math.max(16, Math.round(((val(props.timebase) ?? 20) / 1000) * rate)));
        const trig = val(props.trigger) ?? true;
        const at = trig === false ? 0 : Math.max(0, triggerIndex(left, typeof trig === "number" ? trig : 0, 1, n - span));
        const stepBy = Math.max(1, Math.floor(span / (w * 2))), half = (hgt / 2) * 0.92;
        for (let k = 0; k <= span; k += stepBy) {
          const x = (k / span) * w, y = cy0 - fit(left[at + k]! * gain) * half;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.restore();
    if (props.draw) { ctx.save(); props.draw(ctx, { width: w, height: hgt, samples: left, color: line, active: live }); ctx.restore(); }
  });

  effect(() => {
    const s = source();
    untrack(() => {
      src = s;
      const want = s ? s.bins * 2 : 1024;
      if (want !== n) { n = want; left = new Float32Array(n); right = new Float32Array(n); }
      if (!s) return;
      s.use(root);
      let said = -1e9;
      onCleanup(s.onUpdate((x) => {
        view.draw();
        // the spoken level changes at most once a second
        const at = now();
        if (at - said >= 1000) { said = at; heard.set(x.level()); }
      }));
    });
  });
  // a new color, look or idle state: read the theme colors again and redraw
  effect(() => { val(props.color); look(); on(); view.refresh(); });
  // any other drawn prop: draw again (a paused or idle screen too)
  effect(() => {
    val(props.mode); val(props.lineWidth); val(props.glow); val(props.gain); val(props.trigger); val(props.timebase);
    val(props.persistence); still(props.motion); mutate(view.draw);
  });
  return root;
}
