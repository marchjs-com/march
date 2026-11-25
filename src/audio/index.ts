// march/audio: one audio source for every meter and visualizer (LevelMeter, Gauge's needle VU, Oscilloscope, Spectrum,
// Waveform's live mode, AudioReactive). A source turns an input into readings: level (0–1), bands (bass / mid / treble),
// the left / right levels, a waveform (time domain, −1…1) and a spectrum (0–1 per frequency bin).
//   const mic = audioSource("mic")                   // opt-in: asks for the microphone on start() (a user gesture)
//   const song = audioSource(audioEl)                // an <audio> / <video> element (it keeps playing to the speakers)
//   const call = audioSource(stream)                 // a MediaStream (a call, a live stream)
//   const demo = audioSource("demo")                 // a synthesized loop: no file, no permission (muted by default)
//   const cpu = audioSource(() => $load / 100)       // any number 0–1: the meters work without audio at all
//   mic.level() · mic.bands().bass · mic.channels() · mic.waveform(buf) · mic.spectrum(buf) · await mic.start() · mic.stop()
// Nothing loads Web Audio until a source with a real input starts. The readings update on the motion engine's clock
// (read phase), only while something uses them (`use(el)`) and that element is on screen; under reduced motion they
// update twice a second (a meter that stands still would say nothing). One AudioContext is shared by every source.
import { signal, onCleanup, type Accessor } from "../core/reactive.ts";
import { val, type MaybeFn } from "../core/util.ts";
import { onFrame } from "../motion/engine/clock.ts";
import { watchVisibility } from "../motion/engine/visibility.ts";
import { reducedMotion } from "../motion/engine/prefs.ts";

/** What a source listens to. @tr Bir kaynağın dinlediği şey. */
export type AudioInput = "mic" | "demo" | HTMLMediaElement | MediaStream | AudioNode | MaybeFn<number>;

/** The bass / mid / treble levels, each 0–1. @tr Bas / orta / tiz düzeyleri, her biri 0–1. */
export interface AudioBands { bass: number; mid: number; treble: number }

export interface AudioSourceOptions {
  /** FFT size: more = finer spectrum, slower reaction (power of two, 32–32768). Default 2048. @tr FFT boyutu: büyüdükçe spektrum incelir, tepki yavaşlar (2'nin kuvveti, 32–32768). Varsayılan 2048. */
  fftSize?: number | undefined;
  /** Smoothing of the level and the bands between frames, 0 (none) – 0.99. Default 0.8. @tr Düzeyin ve bantların kareler arası yumuşatması, 0 (yok) – 0,99. Varsayılan 0,8. */
  smoothing?: number | undefined;
  /** "demo" and "mic" to the speakers too. Default false (a mic would echo; the demo stays silent unless asked). @tr "demo" ve "mic" hoparlöre de gider. Varsayılan false (mikrofon yankı yapar; demo istenmedikçe sessizdir). */
  audible?: boolean | undefined;
  /** Upper edges of the bass and mid bands in Hz. Default [250, 4000]. @tr Bas ve orta bantların üst sınırı (Hz). Varsayılan [250, 4000]. */
  bandEdges?: readonly [number, number] | undefined;
}

export interface AudioSource {
  /** Loudness 0–1 (RMS, smoothed). @tr Ses yüksekliği 0–1 (RMS, yumuşatılmış). */
  readonly level: Accessor<number>;
  /** Bass, mid and treble 0–1. @tr Bas, orta ve tiz 0–1. */
  readonly bands: Accessor<AudioBands>;
  /** Left and right levels 0–1 (the same twice for a mono input). @tr Sol ve sağ düzey 0–1 (tek kanallı girişte ikisi aynı). */
  readonly channels: Accessor<readonly [number, number]>;
  /** The highest level since the last frame, unsmoothed (for peak and clip lights). @tr Son kareden beri en yüksek düzey, yumuşatılmamış (tepe ve kırpılma ışıkları için). */
  readonly peak: Accessor<number>;
  /** True while it delivers readings. @tr Okuma verdiği sürece true. */
  readonly active: Accessor<boolean>;
  /** Why it could not start ("unsupported", "denied", or the error's message); null when fine. @tr Neden başlayamadığı ("unsupported", "denied" ya da hatanın iletisi); sorun yoksa null. */
  readonly error: Accessor<string | null>;
  /** Sample rate in Hz (0 before start; 48000 for number inputs). @tr Örnekleme hızı (Hz; başlamadan 0; sayı girişlerinde 48000). */
  readonly sampleRate: () => number;
  /** Number of spectrum bins (fftSize / 2). @tr Spektrum kutusu sayısı (fftSize / 2). */
  readonly bins: number;
  /** The current waveform, −1…1, into `out` (left channel; `channel` 1 = right). @tr Güncel dalga biçimi, −1…1, `out` içine (sol kanal; `channel` 1 = sağ). */
  waveform(out?: Float32Array, channel?: 0 | 1): Float32Array;
  /** The current spectrum, 0–1 per bin (bin i is at i × sampleRate / fftSize Hz), into `out`. @tr Güncel spektrum, kutu başına 0–1 (i. kutu i × sampleRate / fftSize Hz'de), `out` içine. */
  spectrum(out?: Float32Array): Float32Array;
  /** Start listening (the microphone asks for permission here; call it from a click). @tr Dinlemeye başla (mikrofon izni burada istenir; bir tıklamadan çağır). */
  start(): Promise<void>;
  /** Stop listening and let the microphone go. @tr Dinlemeyi durdur, mikrofonu bırak. */
  stop(): void;
  /**
   * Keep the readings updating while `el` is on screen; returns the release (also run with the current owner).
   * @tr `el` ekrandayken okumaları güncel tut; bırakma işlevini döndürür (geçerli sahiple de çalışır).
   */
  use(el: Element): () => void;
  /** Run `fn` after each reading update (meters draw here). Returns the unsubscribe. @tr Her okuma güncellemesinden sonra `fn`'i çalıştır (ölçerler burada çizer). Aboneliği bırakmayı döndürür. */
  onUpdate(fn: (src: AudioSource) => void): () => void;
}

/** A source, or anything a source can be made from. @tr Bir kaynak ya da kaynak yapılabilecek bir şey. */
export type AudioSourceLike = AudioSource | AudioInput;

const SOURCE = Symbol.for("march.audioSource");
/** True when `x` is already an AudioSource. @tr `x` zaten bir AudioSource ise true. */
export const isAudioSource = (x: unknown): x is AudioSource => !!x && typeof x === "object" && (x as Record<symbol, unknown>)[SOURCE] === true;

/** `source` as an AudioSource: kept when it is one, else made (and stopped with the current owner). @tr `source` bir AudioSource olarak: öyleyse korunur, değilse yapılır (geçerli sahiple durdurulur). */
export function toAudioSource(source: AudioSourceLike, o?: AudioSourceOptions): AudioSource {
  if (isAudioSource(source)) return source;
  const s = audioSource(source, o);
  onCleanup(() => s.stop());
  return s;
}

let shared: AudioContext | null = null;
/** The one AudioContext every source (and an effects chain) shares, made on first use; null without Web Audio. @tr Her kaynağın (ve bir efekt zincirinin) paylaştığı tek AudioContext, ilk kullanımda yapılır; Web Audio yoksa null. */
export function audioContext(): AudioContext | null {
  if (shared) return shared;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Ctor ? (shared = new Ctor()) : null;
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const pow2 = (n: number): number => { const p = 2 ** Math.round(Math.log2(Math.max(32, Math.min(32768, n)))); return p; };

/** The "demo" input: a soft chord loop with a pulsing bass and a hi-hat, synthesized (no file, no permission). */
function demoGraph(ctx: AudioContext, out: AudioNode): () => void {
  const master = ctx.createGain(); master.gain.value = 0.22; master.connect(out);
  const nodes: AudioScheduledSourceNode[] = [];
  const t0 = ctx.currentTime + 0.05, BAR = 2;
  // chords (A minor – F – C – G), each a bar, as sawtooth voices through a low-pass
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.connect(master);
  const CH = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
  for (let v = 0; v < 3; v++) {
    const osc = ctx.createOscillator(); osc.type = "sawtooth";
    const g = ctx.createGain(); g.gain.value = 0.18; osc.connect(g).connect(lp);
    for (let k = 0; k < 64; k++) osc.frequency.setValueAtTime(CH[k % 4]![v]!, t0 + k * BAR);
    osc.start(t0); nodes.push(osc);
  }
  // bass: a sine on the root, pulsing on every beat
  const bass = ctx.createOscillator(); bass.type = "sine";
  const bg = ctx.createGain(); bg.gain.value = 0; bass.connect(bg).connect(master);
  for (let k = 0; k < 256; k++) {
    const t = t0 + k * (BAR / 4);
    bass.frequency.setValueAtTime(CH[Math.floor(k / 4) % 4]![0]! / 2, t);
    bg.gain.setValueAtTime(0.9, t); bg.gain.exponentialRampToValueAtTime(0.05, t + BAR / 4 - 0.02);
  }
  bass.start(t0); nodes.push(bass);
  // hi-hat: high-passed noise on the off-beats
  const noise = ctx.createBufferSource(); const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noise.buffer = buf; noise.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
  const hg = ctx.createGain(); hg.gain.value = 0; noise.connect(hp).connect(hg).connect(master);
  for (let k = 0; k < 256; k++) { const t = t0 + k * (BAR / 4) + BAR / 8; hg.gain.setValueAtTime(0.35, t); hg.gain.exponentialRampToValueAtTime(0.01, t + 0.08); }
  noise.start(t0); nodes.push(noise);
  return () => { for (const n of nodes) { try { n.stop(); } catch { /* already stopped */ } n.disconnect(); } master.disconnect(); };
}

/** A media element's audio path: `input` (its one MediaElementAudioSourceNode) → `output` (a gain) → the speakers. @tr Bir medya öğesinin ses yolu: `input` (tek MediaElementAudioSourceNode'u) → `output` (bir kazanç) → hoparlör. */
export interface MediaChain { input: MediaElementAudioSourceNode; output: GainNode }
const chains = new WeakMap<HTMLMediaElement, MediaChain>();
/**
 * The audio path of `el`, made once for its whole life (an element can feed only one MediaElementAudioSourceNode):
 * input → output by default, output → the speakers. Effects go between them (disconnect input → output, insert yours);
 * sources and meters read `output`, so they show the processed sound. Null without Web Audio.
 * @tr `el`'in ses yolu, ömrü boyunca bir kez yapılır (bir öğe yalnız bir MediaElementAudioSourceNode besleyebilir):
 * varsayılan input → output, output → hoparlör. Efektler ikisinin arasına girer (input → output bağını kes, kendininkileri
 * ekle); kaynaklar ve ölçerler `output`'u okur, işlenmiş sesi gösterir. Web Audio yoksa null.
 */
export function mediaChain(el: HTMLMediaElement): MediaChain | null {
  let c = chains.get(el);
  if (c) return c;
  const ctx = audioContext();
  if (!ctx) return null;
  const input = ctx.createMediaElementSource(el), output = ctx.createGain();
  input.connect(output); output.connect(ctx.destination);
  chains.set(el, (c = { input, output }));
  return c;
}

/** Make an audio source (see the top of this file). @tr Bir ses kaynağı yap (dosyanın başına bak). */
export function audioSource(input: AudioInput, o: AudioSourceOptions = {}): AudioSource {
  const fft = pow2(o.fftSize ?? 2048), bins = fft / 2;
  const smooth = Math.max(0, Math.min(0.99, o.smoothing ?? 0.8));
  const [edgeA, edgeB] = o.bandEdges ?? [250, 4000];
  const level = signal(0), peak = signal(0), active = signal(false), error = signal<string | null>(null);
  const bands = signal<AudioBands>({ bass: 0, mid: 0, treble: 0 }, { equals: false });
  const channels = signal<readonly [number, number]>([0, 0], { equals: false });
  const subs = new Set<(s: AudioSource) => void>();
  const numeric = typeof input === "number" || typeof input === "function";
  let rate = numeric ? 48000 : 0;
  // Web Audio parts (none for a number input)
  let ctx: AudioContext | null = null, split: ChannelSplitterNode | null = null, an: [AnalyserNode, AnalyserNode] | null = null;
  let teardown: (() => void) | null = null;
  const time: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(fft), new Float32Array(fft)];
  const freq: Float32Array<ArrayBuffer> = new Float32Array(bins);
  let phase = 0, lastNum = 0, visible = 0, stopFrame: (() => void) | null = null, lastSample = -1e9;

  // number input: a synthetic signal whose loudness is the number (a tone plus its harmonics, so every view has a shape)
  function sampleNumber(dt: number): void {
    const v = clamp01(Number(val(input as MaybeFn<number>)) || 0);
    lastNum = v; phase += dt / 1000;
    for (let i = 0; i < fft; i++) {
      const t = phase + i / rate, w = 2 * Math.PI * 220 * t;
      const s = v * (0.7 * Math.sin(w) + 0.2 * Math.sin(2 * w + 0.4) + 0.1 * Math.sin(3 * w + 1.1));
      time[0][i] = s; time[1][i] = s;
    }
    for (let i = 0; i < bins; i++) { const f = (i * rate) / fft; freq[i] = clamp01(v * (f < 1 ? 0 : Math.exp(-Math.abs(Math.log2(f / 220)) * 1.2) + 0.15 * Math.exp(-f / 3000))); }
  }
  function sampleAudio(): void {
    an![0].getFloatTimeDomainData(time[0]); an![1].getFloatTimeDomainData(time[1]);
    const db: Float32Array<ArrayBuffer> = new Float32Array(bins); an![0].getFloatFrequencyData(db);
    const lo = an![0].minDecibels, hi = an![0].maxDecibels;
    for (let i = 0; i < bins; i++) freq[i] = clamp01((db[i]! - lo) / (hi - lo));
  }
  const rms = (a: Float32Array): number => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]! * a[i]!; return Math.sqrt(s / a.length); };
  function band(from: number, to: number): number {
    const a = Math.max(1, Math.floor((from * fft) / rate)), b = Math.min(bins, Math.ceil((to * fft) / rate));
    let s = 0; for (let i = a; i < b; i++) s += freq[i]!; return b > a ? s / (b - a) : 0;
  }
  const ease = (prev: number, next: number): number => (next > prev ? next : prev * smooth + next * (1 - smooth));
  function update(dt: number): void {
    if (!active.peek()) return;
    if (numeric) sampleNumber(dt); else sampleAudio();
    // a sine of amplitude 1 has an RMS of 0.707: scale so a full signal reads 1
    const l = numeric ? lastNum : clamp01(rms(time[0]) * 1.414), r = numeric ? lastNum : clamp01(rms(time[1]) * 1.414);
    const now = Math.max(l, r);
    peak.set(now);
    level.set(ease(level.peek(), now));
    const ch = channels.peek(); channels.set([ease(ch[0], l), ease(ch[1], r)]);
    const b = bands.peek();
    bands.set({ bass: ease(b.bass, band(20, edgeA)), mid: ease(b.mid, band(edgeA, edgeB)), treble: ease(b.treble, band(edgeB, rate / 2)) });
    for (const fn of subs) fn(api);
  }
  // runs while started and at least one user is on screen (unknown counts as on screen)
  function frameOn(): void {
    if (stopFrame || !active.peek() || visible <= 0) return;
    stopFrame = onFrame((t, dt) => {
      // reduced motion: two readings a second instead of one per frame
      if (reducedMotion()) { if (t - lastSample < 500) return; lastSample = t; }
      update(dt || 16);
    }, { phase: "read" });
  }
  function frameOff(): void { stopFrame?.(); stopFrame = null; }

  async function start(): Promise<void> {
    if (active.peek()) return;
    error.set(null);
    if (numeric) { active.set(true); frameOn(); return; }
    ctx = audioContext();
    if (!ctx) { error.set("unsupported"); return; }
    try {
      if (ctx.state === "suspended") await ctx.resume();
      rate = ctx.sampleRate;
      split = ctx.createChannelSplitter(2);
      an = [ctx.createAnalyser(), ctx.createAnalyser()];
      for (const a of an) { a.fftSize = fft; a.smoothingTimeConstant = 0.6; }
      split.connect(an[0], 0); split.connect(an[1], 1);
      const into = (node: AudioNode, audible: boolean): void => { node.connect(split!); if (audible) node.connect(ctx!.destination); };
      if (input === "mic") {
        const md = globalThis.navigator?.mediaDevices;
        if (!md?.getUserMedia) { error.set("unsupported"); return; }
        const stream = await md.getUserMedia({ audio: true });
        const node = ctx.createMediaStreamSource(stream);
        into(node, !!o.audible);
        teardown = () => { node.disconnect(); for (const tr of stream.getTracks()) tr.stop(); };
      } else if (input === "demo") {
        const g = ctx.createGain(); into(g, !!o.audible);
        const stop = demoGraph(ctx, g);
        teardown = () => { stop(); g.disconnect(); };
      } else if (typeof HTMLMediaElement !== "undefined" && input instanceof HTMLMediaElement) {
        // the element's one audio path (mediaChain): read after any effects, never wired to the speakers a second time
        const n = mediaChain(input)!.output;
        n.connect(split);
        teardown = () => { try { n.disconnect(split!); } catch { /* gone */ } };
      } else if (typeof MediaStream !== "undefined" && input instanceof MediaStream) {
        const node = ctx.createMediaStreamSource(input); into(node, false);
        teardown = () => node.disconnect();
      } else {
        const node = input as AudioNode; node.connect(split);
        teardown = () => { try { node.disconnect(split!); } catch { /* gone */ } };
      }
      active.set(true);
      frameOn();
    } catch (e) {
      const name = (e as { name?: string }).name;
      error.set(name === "NotAllowedError" || name === "SecurityError" ? "denied" : (e as Error).message ?? String(e));
    }
  }
  function stop(): void {
    frameOff();
    teardown?.(); teardown = null;
    an?.forEach((a) => a.disconnect()); split?.disconnect(); an = null; split = null;
    active.set(false); level.set(0); peak.set(0); channels.set([0, 0]); bands.set({ bass: 0, mid: 0, treble: 0 });
    time[0].fill(0); time[1].fill(0); freq.fill(0);
    for (const fn of subs) fn(api);
  }
  function use(el: Element): () => void {
    let on = true, shown = true;
    visible++;
    const unwatch = watchVisibility(el, (v) => {
      if (!on || v === shown) return;
      shown = v; visible += v ? 1 : -1;
      if (visible <= 0) frameOff(); else frameOn();
    });
    frameOn();
    const release = (): void => {
      if (!on) return; on = false; unwatch(); if (shown) visible--;
      if (visible <= 0) frameOff();
    };
    onCleanup(release);
    return release;
  }
  const api: AudioSource = {
    level, bands, channels, peak, active, error, bins,
    sampleRate: () => rate,
    waveform: (out = new Float32Array(fft), c = 0) => { out.set(time[c].subarray(0, Math.min(out.length, fft))); return out; },
    spectrum: (out = new Float32Array(bins)) => { out.set(freq.subarray(0, Math.min(out.length, bins))); return out; },
    start, stop, use,
    onUpdate: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
  };
  (api as unknown as Record<symbol, boolean>)[SOURCE] = true;
  // a number needs no permission and no context: it runs at once
  if (numeric) void start();
  return api;
}
