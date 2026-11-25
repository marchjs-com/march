// Waveform: the bars of a sound, as in a voice message or a podcast player. The bars come from `peaks` (0–1), from
// `src` (an audio file: fetched and decoded once it is on screen, the peaks computed once per URL), or live from a
// `source` (march/audio) as bars rolling in from the inline end; `live` without a source is the decorative motion of a
// recording (ChatComposer). A playhead (`progress` or `currentTime` / `duration`) paints the played bars, `regions`
// (chapters) lie under the bars with their labels below, and `seekable` makes it a slider (pointer and keyboard).
// Static and source bars are drawn on one canvas (src/audio/canvas.ts); the decorative bars are a row of DOM bars
// animated with play() on the compositor: no canvas, no per-frame script and no audio code run for them.
import "./waveform.css";
import { WaveformBars, shell } from "./bars.ts";
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, isRtl, type MaybeFn, type ClassProp, type Handler } from "../../../ui/util.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { whenVisible } from "../../../ui/observe.ts";
import { formatDuration } from "../../../ui/format.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { onFrame, mutate } from "../../../motion/engine/clock.ts";
import { still } from "../../../motion/engine/parts.ts";
import { toAudioSource, type AudioSourceLike } from "../../../audio/index.ts";
import { audioCanvas } from "../../../audio/canvas.ts";

/** A stretch of the sound (a chapter, a highlight). @tr Sesin bir bölümü (bölüm, öne çıkan an). */
export interface WaveformRegion {
  /** Start: seconds when the duration is known, else 0–1. @tr Başlangıç: süre biliniyorsa saniye, yoksa 0–1. */
  start: number;
  /** End, in the same unit as `start`. @tr Bitiş, `start` ile aynı birimde. */
  end: number;
  /** Its name, shown under the bars and read with the position. @tr Adı; çubukların altında görünür, konumla birlikte okunur. */
  label?: string | undefined;
  /** Theme color token of the band (default: the category colors in turn). @tr Bandın tema renk belirteci (varsayılan: kategori renkleri sırayla). */
  color?: ColorToken | undefined;
}

/** What decoding a file gives: peaks 0–1 (normalized) and the duration in seconds. */
export interface WaveformData { peaks: Float32Array; duration: number }

export interface WaveformProps {
  /** The bar heights, 0–1 (any length: resampled to the bar count). @tr Çubuk yükseklikleri, 0–1 (her uzunluk olur: çubuk sayısına örneklenir). */
  peaks?: MaybeFn<readonly number[] | Float32Array | null | undefined>;
  /** An audio file URL: fetched and decoded once it is on screen; its peaks and duration are used. @tr Bir ses dosyası adresi: ekrana gelince indirilip çözülür; tepeleri ve süresi kullanılır. */
  src?: MaybeFn<string | null | undefined>;
  /** Live audio (march/audio source or input): bars roll in from the inline end. @tr Canlı ses (march/audio kaynağı ya da girdisi): çubuklar satır sonundan kayarak gelir. */
  source?: AudioSourceLike | undefined;
  /** Live bars; without `source` a decorative recording motion (no audio needed). Default false. @tr Canlı çubuklar; `source` yoksa süs amaçlı kayıt hareketi (ses gerekmez). Varsayılan false. */
  live?: boolean | undefined;
  /** Playhead 0–1. @tr Oynatma konumu 0–1. */
  progress?: MaybeFn<number | null | undefined>;
  /** Playhead in seconds (with `duration`). @tr Saniye cinsinden oynatma konumu (`duration` ile). */
  currentTime?: MaybeFn<number | null | undefined>;
  /** Length in seconds (default: the decoded file's). @tr Saniye cinsinden uzunluk (varsayılan: çözülen dosyanınki). */
  duration?: MaybeFn<number | null | undefined>;
  /** Chapters / highlights drawn under the bars. @tr Çubukların altına çizilen bölümler / öne çıkan anlar. */
  regions?: MaybeFn<readonly WaveformRegion[] | null | undefined>;
  /** Number of bars (their width then fills the box). Default: as many as fit (24 for decorative bars). @tr Çubuk sayısı (genişlikleri kutuyu doldurur). Varsayılan: sığdığı kadar (süs çubuklarında 24). */
  bars?: number | undefined;
  /** Bar width in px. Default 3. @tr px cinsinden çubuk genişliği. Varsayılan 3. */
  barWidth?: number | undefined;
  /** Space between bars in px. Default 2. @tr px cinsinden çubuk arası boşluk. Varsayılan 2. */
  gap?: number | undefined;
  /** Rounded bar ends. Default true. @tr Yuvarlak çubuk uçları. Varsayılan true. */
  rounded?: boolean | undefined;
  /** "mirror": bars centered (voice message), "bottom": bars standing on the baseline. Default "mirror". @tr "mirror": ortalanmış çubuklar (sesli mesaj), "bottom": tabana dayalı çubuklar. Varsayılan "mirror". */
  align?: "mirror" | "bottom" | undefined;
  /** Height of the bars in px. Default 48 (CSS `--m-wave-h`). @tr Çubukların px cinsinden yüksekliği. Varsayılan 48 (CSS `--m-wave-h`). */
  height?: number | undefined;
  /** Theme color token of the bars (default: a quiet gray; live bars: the accent). @tr Çubukların tema renk belirteci (varsayılan: sakin gri; canlı çubuklar: vurgu rengi). */
  color?: ColorToken | undefined;
  /** Theme color token of the played bars and the playhead (default: the accent). @tr Çalınmış çubukların ve oynatma çizgisinin tema renk belirteci (varsayılan: vurgu rengi). */
  progressColor?: ColorToken | undefined;
  /** The playhead line. Default true (when there is a position). @tr Oynatma çizgisi. Varsayılan true (bir konum varken). */
  playhead?: boolean | undefined;
  /** The region labels under the bars. Default true. @tr Çubukların altındaki bölüm adları. Varsayılan true. */
  regionLabels?: boolean | undefined;
  /** Seek by pointer (press, drag) and keyboard (arrows ±5 %, Home, End): a slider. Default false. @tr İşaretçiyle (bas, sürükle) ve klavyeyle (oklar ±%5, Home, End) konum seçilir: bir kaydırıcı. Varsayılan false. */
  seekable?: MaybeFn<boolean | undefined>;
  /** Called with the chosen position (0–1) and its time in seconds (0 without a duration). @tr Seçilen konumla (0–1) ve saniye cinsinden zamanıyla çağrılır (süre yoksa 0). */
  onSeek?: Handler<[progress: number, time: number]> | undefined;
  /** Called when a press without dragging lands in a region. @tr Sürüklemeden yapılan bir basış bir bölüme düşünce çağrılır. */
  onRegionClick?: Handler<[region: WaveformRegion, index: number]> | undefined;
  /** Called when a `src` file is decoded. @tr Bir `src` dosyası çözülünce çağrılır. */
  onLoad?: Handler<[data: WaveformData]> | undefined;
  /** Accessible name. Default "Waveform" (live: "Live waveform"). @tr Erişilebilir ad. Varsayılan "Waveform" (canlı: "Live waveform"). */
  label?: MaybeFn<string | undefined>;
  /** Own spoken position of the slider (seconds, duration in seconds). Default "1:05 of 4:00" (+ the region's label). @tr Kaydırıcının kendi okunan konum metni (saniye, saniye cinsinden süre). Varsayılan "1:05 of 4:00" (+ bölümün adı). */
  valueText?: ((time: number, duration: number) => string) | undefined;
  /** Motion: the bars grow in when they arrive, the decorative bars move. false: still. Default true. @tr Hareket: çubuklar gelince büyüyerek belirir, süs çubukları oynar. false: durgun. Varsayılan true. */
  motion?: MaybeFn<boolean | undefined>;
  /** Extra classes on the root. @tr Köke eklenen sınıflar. */
  class?: ClassProp;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const num = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** Highest |value| per bucket: `n` bars from any number of peaks (fewer peaks repeat). */
export function resamplePeaks(src: ArrayLike<number>, n: number, out = new Float32Array(n)): Float32Array {
  const len = src.length;
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * len) / n), b = Math.max(a + 1, Math.floor(((i + 1) * len) / n));
    let m = 0;
    for (let k = a; k < b && k < len; k++) { const v = Math.abs(src[k] ?? 0); if (v > m) m = v; }
    out[i] = clamp01(m);
  }
  return out;
}

const decoded = new Map<string, Promise<WaveformData>>();
/**
 * Fetch and decode an audio file into 1024 peaks (normalized to 0–1) and its duration; once per URL (cached).
 * @tr Bir ses dosyasını indirip 1024 tepeye (0–1'e oranlanmış) ve süresine çöz; adres başına bir kez (önbellekli).
 */
export function decodePeaks(url: string, count = 1024): Promise<WaveformData> {
  const key = `${count} ${url}`;
  let p = decoded.get(key);
  if (p) return p;
  p = (async () => {
    const g = globalThis as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext };
    const OAC = g.OfflineAudioContext ?? g.webkitOfflineAudioContext;
    if (!OAC || typeof fetch !== "function") throw new Error("unsupported");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // an offline context decodes without a user gesture and plays nothing
    const buf = await new OAC(1, 1, 44100).decodeAudioData(await res.arrayBuffer());
    const peaks = new Float32Array(count), step = buf.length / count;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < count; i++) {
        let m = peaks[i]!;
        for (let k = Math.floor(i * step), e = Math.floor((i + 1) * step); k < e; k++) { const v = Math.abs(d[k]!); if (v > m) m = v; }
        peaks[i] = m;
      }
    }
    let top = 0; for (const v of peaks) if (v > top) top = v;
    if (top > 0) for (let i = 0; i < count; i++) peaks[i] = peaks[i]! / top;
    return { peaks, duration: buf.duration };
  })();
  decoded.set(key, p);
  p.catch(() => decoded.delete(key));
  return p;
}

/** `<Waveform peaks={voice.peaks} currentTime={$t} duration={voice.length} seekable onSeek={(p, s) => audio.currentTime = s} />` */
export function Waveform(props: WaveformProps): Element {
  if (props.live && !props.source) return WaveformBars(props);
  const bw = Math.max(1, props.barWidth ?? 3), gap = Math.max(0, props.gap ?? 2);
  const data = signal<WaveformData | null>(null), state = signal<"idle" | "loading" | "ready" | "error">("idle");
  const drag = signal<number | null>(null), hover = signal<number | null>(null), own = signal(0);
  const seekable = (): boolean => !!val(props.seekable) && !props.source;
  const D = computed(() => num(val(props.duration)) ?? data()?.duration ?? 0);
  const given = computed<number | null>(() => {
    const p = num(val(props.progress));
    if (p != null) return clamp01(p);
    const ct = num(val(props.currentTime)), d = D();
    return ct != null && d > 0 ? clamp01(ct / d) : null;
  });
  // the position shown: a drag wins, then the given position, then the last seek
  const pos = computed(() => drag() ?? given() ?? (seekable() ? own() : null));
  const regions = computed(() => val(props.regions) ?? []);
  const frac = (x: number): number => clamp01(D() > 0 ? x / D() : x);

  // the bars: given peaks, a decoded file, or (live) a rolling history of the source's level
  const canvas = h("canvas", { class: "m-wave-canvas", "aria-hidden": "true" }) as HTMLCanvasElement;
  const history: number[] = [];
  let grow = 1, scratch = new Float32Array(0);
  const view = audioCanvas(canvas, (ctx, w, hh, color) => {
    ctx.clearRect(0, 0, w, hh);
    const n = Math.max(1, props.bars ?? Math.floor((w + gap) / (bw + gap)));
    const width = props.bars ? Math.max(1, (w - gap * (n - 1)) / n) : bw, stride = width + gap;
    if (scratch.length !== n) scratch = new Float32Array(n);
    if (props.source) {
      // newest at the inline end; empty slots stay at the floor
      scratch.fill(0);
      const k = Math.min(n, history.length);
      for (let i = 0; i < k; i++) scratch[n - k + i] = history[history.length - k + i]!;
    } else {
      const src = untrack(() => val(props.peaks) ?? data()?.peaks);
      if (src && src.length) resamplePeaks(src, n, scratch); else scratch.fill(0);
    }
    const p = untrack(pos), hv = untrack(hover);
    const base = color("--m-wave-bar"), played = color("--m-wave-played");
    const r = props.rounded === false ? 0 : width / 2, mirror = props.align !== "bottom";
    for (let i = 0; i < n; i++) {
      // growing in: each bar a little after the one before it
      const g = grow >= 1 ? 1 : clamp01((grow - (i / n) * 0.4) / 0.6), e = 1 - (1 - g) ** 3;
      const bh = Math.max(Math.min(hh, 2), scratch[i]! * hh * e), x = i * stride, y = mirror ? (hh - bh) / 2 : hh - bh;
      const at = (i + 0.5) / n;
      ctx.globalAlpha = 1;
      ctx.fillStyle = p != null && at <= p ? played : base;
      if (hv != null && p != null && at > p && at <= hv) { ctx.fillStyle = played; ctx.globalAlpha = 0.45; }
      ctx.beginPath();
      if (r && ctx.roundRect) ctx.roundRect(x, y, width, bh, Math.min(r, bh / 2)); else ctx.rect(x, y, width, bh);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  let queued = false;
  const redraw = (): void => { if (!queued) { queued = true; mutate(() => { queued = false; view.draw(); }); } };

  // grow in once the bars arrive (motion engine clock; still: at once)
  let stopGrow: (() => void) | null = null;
  const growIn = (): void => {
    stopGrow?.(); stopGrow = null;
    if (still(props.motion)) { grow = 1; redraw(); return; }
    grow = 0; let t0 = -1;
    stopGrow = onFrame((t) => {
      if (t0 < 0) t0 = t;
      grow = Math.min(1, (t - t0) / 600);
      view.draw();
      if (grow >= 1) { stopGrow?.(); stopGrow = null; }
    });
  };
  onCleanup(() => stopGrow?.());

  // the playhead and the regions (DOM: they mirror with the inline direction by themselves)
  const head = props.playhead === false ? null : h("span", { class: "m-wave-playhead", "aria-hidden": "true", hidden: () => pos() == null }) as HTMLElement;
  const bands = h("span", { class: "m-wave-regions", "aria-hidden": "true" }, () => regions().map((g, i) => {
    const a = frac(g.start), b = Math.max(a, frac(g.end));
    return h("span", { class: "m-wave-region", "data-m-color": g.color ?? `cat-${(i % 8) + 1}`, style: { insetInlineStart: `${a * 100}%`, width: `${(b - a) * 100}%` } });
  }));
  const marks = props.regionLabels === false ? null : h("div", { class: "m-wave-marks", "aria-hidden": "true", hidden: () => !regions().some((g) => g.label) }, () => regions().map((g, i) => {
    const a = frac(g.start), b = Math.max(a, frac(g.end));
    return g.label ? h("span", { class: "m-wave-mark", "data-m-color": g.color ?? `cat-${(i % 8) + 1}`, style: { insetInlineStart: `${a * 100}%`, maxWidth: `${(b - a) * 100}%` } }, g.label) : null;
  }));
  // seeking: press, drag, release; arrows ±5 %, Home, End
  const commit = (f: number): void => { own.set(f); props.onSeek?.(f, f * D()); };
  const at = (clientX: number): number => {
    const r = root.getBoundingClientRect(), x = r.width ? (clientX - r.left) / r.width : 0;
    return clamp01(isRtl(root) ? 1 - x : x);
  };
  // the shared pointer drag: a press seeks, a drag scrubs (Escape cancels), a press in a region also names it
  const press = (e: PointerEvent): void => {
    if (!seekable() || e.button > 0) return;
    e.preventDefault(); root.focus();
    const f0 = at(e.clientX);
    drag.set(f0);
    pointerDrag(e, {
      threshold: 3,
      onMove: (p) => drag.set(at(p.clientX)),
      onEnd: (p, cancelled) => { drag.set(null); if (!cancelled) commit(at(p.clientX)); },
      onClick: () => {
        drag.set(null); commit(f0);
        const list = regions(), i = list.findIndex((g) => f0 >= frac(g.start) && f0 < frac(g.end));
        if (i >= 0) props.onRegionClick?.(list[i]!, i);
      },
    });
  };
  const move = (e: PointerEvent): void => { if (seekable() && drag() == null) hover.set(at(e.clientX)); };
  const key = (e: KeyboardEvent): void => {
    if (!seekable()) return;
    const rtl = isRtl(root), f = pos() ?? 0;
    const step = e.key === "PageUp" || e.key === "PageDown" ? 0.1 : 0.05;
    let next: number | null = null;
    if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = f + step;
    else if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = f - step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    if (next == null) return;
    e.preventDefault();
    commit(clamp01(next));
  };
  const root = shell(props, {
    onPointerDown: press, onPointerMove: move, onPointerLeave: () => hover.set(null), onKeyDown: key,
  }, h("div", { class: "m-wave-track" }, bands, canvas, head), marks);
  effect(() => { const p = pos(); if (head) head.style.setProperty("--m-wave-p", String(p ?? 0)); hover(); redraw(); });

  // live: a bar of the loudest level every 70 ms (each reading under reduced motion)
  if (props.source) {
    const src = toAudioSource(props.source);
    let acc = 0, last = 0;
    onCleanup(src.onUpdate((s) => {
      acc = Math.max(acc, s.peak(), s.level());
      const now = performance.now();
      if (now - last < 70 && !still(props.motion)) return;
      last = now; history.push(acc); acc = 0;
      if (history.length > 1024) history.splice(0, history.length - 1024);
      view.draw();
    }));
    src.use(root);
  } else {
    // the peaks: given, or decoded from `src` once it is on screen
    let shown = false;
    const load = (): void => {
      const url = untrack(() => val(props.src));
      if (!url) return;
      state.set("loading");
      decodePeaks(url).then((d) => {
        if (untrack(() => val(props.src)) !== url) return;
        data.set(d); state.set("ready"); props.onLoad?.(d); growIn();
      }, () => state.set("error"));
    };
    whenVisible(root, (v) => { if (v && !shown) { shown = true; load(); } });
    // a new URL later: load it (the first one waits for the element to be seen)
    let first = true;
    effect(() => { val(props.src); if (!first && shown) untrack(load); first = false; });
    let had = false;
    effect(() => { const p = val(props.peaks); if (p && p.length && !had) { had = true; untrack(growIn); } else redraw(); });
  }
  effect(() => root.setAttribute("data-state", props.source ? "live" : state()));

  // a slider while seekable, else an image
  const valueText = (f: number): string => {
    const d = D(), s = f * d;
    const g = regions().find((r) => f >= frac(r.start) && f < frac(r.end) && r.label);
    const text = props.valueText ? props.valueText(s, d) : d > 0 ? t`${formatDuration(s * 1000)} of ${formatDuration(d * 1000)}` : `${Math.round(f * 100)}%`;
    return g ? `${text}, ${g.label}` : text;
  };
  effect(() => {
    const label = val(props.label) ?? (props.source ? t`Live waveform` : t`Waveform`);
    const set = (k: string, v: string | null): void => { if (v == null) root.removeAttribute(k); else root.setAttribute(k, v); };
    set("aria-label", label);
    if (seekable()) {
      // whole seconds (or percent): the spoken value changes at most once a second while it plays
      const f = pos() ?? 0, d = D();
      set("role", "slider"); set("tabindex", "0");
      set("aria-valuemin", "0"); set("aria-valuemax", String(d > 0 ? Math.round(d) : 100));
      set("aria-valuenow", String(d > 0 ? Math.round(f * d) : Math.round(f * 100)));
      set("aria-valuetext", valueText(f));
      set("aria-orientation", "horizontal");
    } else {
      const d = D();
      set("role", "img"); set("tabindex", null);
      for (const k of ["aria-valuemin", "aria-valuemax", "aria-valuenow", "aria-orientation"]) set(k, null);
      set("aria-valuetext", null);
      if (d > 0 && !props.source) set("aria-label", `${label}, ${formatDuration(d * 1000)}`);
    }
    root.classList.toggle("is-seekable", seekable());
  });

  return root;
}
