// Loudness readings of an audio source (march/audio), as a broadcast or streaming loudness meter shows them:
// momentary (the last 400 ms) and short-term (the last 3 s) loudness in LUFS, the integrated (gated) loudness of
// everything heard since the start or the last reset, and the stereo correlation (−1 out of phase … 0 wide … +1 mono).
//   const src = audioSource(audioEl); const lu = loudness(src); src.use(el)
//   lu.momentary() · lu.shortTerm() · lu.integrated() · lu.correlation() · lu.reset()
// The loudness follows ITU-R BS.1770 as closely as a browser meter can: each reading K-weights the source's latest
// waveform window (the two filters of the standard, for the source's sample rate), takes its mean square per channel
// and averages those over the window's time. The windows are what the source reads per frame (fftSize samples), so it
// is an approximation of a sample-exact meter: good to a few tenths of a dB on steady material, enough to aim at a
// target (−14 LUFS for streaming, −23 LUFS for broadcast). Readings update with the source (on screen only; twice a
// second under reduced motion). Silence reads the absolute gate, −70 LUFS.
import { signal, onCleanup, type Accessor } from "../core/reactive.ts";
import { now } from "../motion/engine/clock.ts";
import type { AudioSource } from "./index.ts";

/** The loudness readings of a source. @tr Bir kaynağın ses yüksekliği okumaları. */
export interface Loudness {
  /** Momentary loudness (last 400 ms) in LUFS; −70 when silent. @tr Anlık ses yüksekliği (son 400 ms), LUFS; sessizken −70. */
  readonly momentary: Accessor<number>;
  /** Short-term loudness (last 3 s) in LUFS; −70 when silent. @tr Kısa süreli ses yüksekliği (son 3 sn), LUFS; sessizken −70. */
  readonly shortTerm: Accessor<number>;
  /** Integrated loudness since the start or the last reset (gated at −70 LUFS and 10 LU below), in LUFS. @tr Başlangıçtan ya da son sıfırlamadan beri bütünleşik ses yüksekliği (−70 LUFS ve 10 LU altında geçitli), LUFS. */
  readonly integrated: Accessor<number>;
  /** Stereo correlation −1…+1 (+1 mono, 0 unrelated, −1 out of phase); 0 when silent. @tr Stereo korelasyon −1…+1 (+1 mono, 0 ilişkisiz, −1 ters faz); sessizken 0. */
  readonly correlation: Accessor<number>;
  /** Forget the history (the integrated loudness starts again). @tr Geçmişi unut (bütünleşik ses yüksekliği yeniden başlar). */
  reset(): void;
  /** Stop reading the source (also done with the current owner). @tr Kaynağı okumayı bırak (geçerli sahiple de yapılır). */
  stop(): void;
}

export interface LoudnessOptions {
  /** Time of the correlation average in ms. Default 300. @tr Korelasyon ortalamasının süresi (ms). Varsayılan 300. */
  correlationWindow?: number | undefined;
}

/** The absolute gate and the floor of every reading, in LUFS. @tr Mutlak geçit ve her okumanın tabanı, LUFS. */
export const LUFS_FLOOR = -70;
const MOMENTARY = 400, SHORT = 3000, BLOCK = 100;

/** The two biquads of the K-weighting (BS.1770: a high shelf, then the RLB high-pass) for a sample rate: [b0, b1, b2, a1, a2] each. @tr K ağırlıklandırmanın iki biquad süzgeci (BS.1770: yüksek raf, sonra RLB yüksek geçiren), bir örnekleme hızı için: her biri [b0, b1, b2, a1, a2]. */
export function kWeighting(rate: number): [number[], number[]] {
  // the standard's analogue prototypes, re-derived for any rate (as libebur128 does)
  let K = Math.tan((Math.PI * 1681.974450955533) / rate);
  const Q = 0.7071752369554196, Vh = 10 ** (3.999843853973347 / 20), Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const shelf = [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  K = Math.tan((Math.PI * 38.13547087602444) / rate);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  const high = [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0];
  return [shelf, high];
}

/** LUFS of a sum of channel mean squares (BS.1770: −0.691 + 10·log10), never below the floor. @tr Kanal ortalama karelerinin toplamının LUFS değeri (BS.1770: −0,691 + 10·log10), tabanın altına inmez. */
export const lufs = (power: number): number => (power > 0 ? Math.max(LUFS_FLOOR, -0.691 + 10 * Math.log10(power)) : LUFS_FLOOR);

/** The mean square of `x` after K-weighting; the first quarter only settles the filters. */
function weighted(x: Float32Array, f: [number[], number[]]): number {
  const [s, p] = f;
  let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0, sum = 0;
  const from = x.length >> 2;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    // direct form I, shelf then high-pass
    const y = s[0]! * v + s[1]! * a1 + s[2]! * a2 - s[3]! * b1 - s[4]! * b2;
    a2 = a1; a1 = v; b2 = b1; b1 = y;
    const z = p[0]! * y + p[1]! * c1 + p[2]! * c2 - p[3]! * d1 - p[4]! * d2;
    c2 = c1; c1 = y; d2 = d1; d1 = z;
    if (i >= from) sum += z * z;
  }
  return sum / Math.max(1, x.length - from);
}

/** Read the loudness of `source` (see the top of this file). @tr `source`'un ses yüksekliğini oku (dosyanın başına bak). */
export function loudness(source: AudioSource, o: LoudnessOptions = {}): Loudness {
  const momentary = signal(LUFS_FLOOR), shortTerm = signal(LUFS_FLOOR), integrated = signal(LUFS_FLOOR), correlation = signal(0);
  // one window of the source (fftSize = 2 × bins samples) per channel
  const left = new Float32Array(source.bins * 2), right = new Float32Array(source.bins * 2);
  let filters: [number[], number[]] | null = null, rate = 0;
  // the readings of the last 3 s: time, power (left + right mean squares), and the correlation sums
  const blocks: { t: number; p: number; lr: number; ll: number; rr: number }[] = [];
  // integrated: 400 ms blocks every 100 ms in a histogram of 0.1 LU bins from the gate up (count and power per bin)
  const BINS = 800, count = new Float64Array(BINS), power = new Float64Array(BINS);
  let lastBlock = -Infinity;
  const corrMs = (): number => Math.max(BLOCK, o.correlationWindow ?? 300);

  function gated(): number {
    let n = 0, sum = 0;
    for (let i = 0; i < BINS; i++) { n += count[i]!; sum += power[i]!; }
    if (!n) return LUFS_FLOOR;
    const rel = lufs(sum / n) - 10, from = Math.max(0, Math.ceil((rel - LUFS_FLOOR) * 10));
    n = 0; sum = 0;
    for (let i = from; i < BINS; i++) { n += count[i]!; sum += power[i]!; }
    return n ? lufs(sum / n) : LUFS_FLOOR;
  }

  function read(src: AudioSource): void {
    const r = src.sampleRate() || 48000;
    if (r !== rate || !filters) { rate = r; filters = kWeighting(r); }
    src.waveform(left, 0); src.waveform(right, 1);
    let lr = 0, ll = 0, rr = 0;
    for (let i = 0; i < left.length; i++) { const a = left[i]!, b = right[i]!; lr += a * b; ll += a * a; rr += b * b; }
    const t = now();
    blocks.push({ t, p: weighted(left, filters) + weighted(right, filters), lr, ll, rr });
    while (blocks.length > 1 && blocks[0]!.t < t - SHORT) blocks.shift();
    const mean = (ms: number): number => {
      let s = 0, n = 0;
      for (let i = blocks.length - 1; i >= 0 && (n === 0 || blocks[i]!.t > t - ms); i--) { s += blocks[i]!.p; n++; }
      return s / Math.max(1, n);
    };
    const m = mean(MOMENTARY);
    momentary.set(lufs(m)); shortTerm.set(lufs(mean(SHORT)));
    let a = 0, b = 0, c = 0;
    for (let i = blocks.length - 1, n = 0; i >= 0 && (n === 0 || blocks[i]!.t > t - corrMs()); i--, n++) { a += blocks[i]!.lr; b += blocks[i]!.ll; c += blocks[i]!.rr; }
    correlation.set(b * c > 1e-12 ? Math.max(-1, Math.min(1, a / Math.sqrt(b * c))) : 0);
    // a gating block every 100 ms (75 % overlap of 400 ms blocks); the absolute gate drops silence
    if (t - lastBlock >= BLOCK || t < lastBlock) {
      lastBlock = t;
      const l = lufs(m);
      if (m > 0 && l > LUFS_FLOOR) { const k = Math.min(BINS - 1, Math.floor((l - LUFS_FLOOR) * 10)); count[k]!++; power[k]! += m; }
      integrated.set(gated());
    }
  }
  const off = source.onUpdate(read);
  function reset(): void {
    blocks.length = 0; count.fill(0); power.fill(0); lastBlock = -Infinity;
    momentary.set(LUFS_FLOOR); shortTerm.set(LUFS_FLOOR); integrated.set(LUFS_FLOOR); correlation.set(0);
  }
  onCleanup(off);
  return { momentary, shortTerm, integrated, correlation, reset, stop: off };
}
