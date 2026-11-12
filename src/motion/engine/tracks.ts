// The target-independent value layer: keyframes are normalized into per-property tracks and compiled into typed arrays.
// Sampling a track writes into a preallocated Float64Array (`out`): no objects, arrays or strings are created per frame
// for JS targets (object / canvas / WebGL). Only the DOM fallback formats a string, because style needs one.
//   numbers            0 → 1                               (n = 1)
//   vectors            [0, 0, 1] → [1, .5, 0]              (n = length; uniforms, positions)
//   colors             "#f00" → "oklch(.7 .1 200)"         (n = 4, premultiplied OKLab + alpha)
//   strings w/ numbers "translate(0px, 10%) rotate(0deg)"  (n = count of numbers; the text around them must match)
//   anything else      switches halfway (discrete)
import { ease as toEase, spread, NUM, type Ease, type EaseInput } from "./ease.ts";
import { parseColor, formatOklab, oklabToRgba } from "./color.ts";

export type Value = number | string | ArrayLike<number> | null | undefined;
/** Keyframes: an array of frames (`[{ opacity: 0 }, { opacity: 1 }]`) or property-indexed (`{ opacity: [0, 1] }`). */
export type Frames = ReadonlyArray<Record<string, unknown>> | Record<string, unknown>;

export interface RawTrack { prop: string; offsets: number[]; values: Value[]; eases: (EaseInput | undefined)[] }
const META = new Set(["offset", "easing", "composite"]);

/** Normalize keyframes into one raw track per property (offsets filled in like CSS does). */
export function normalize(frames: Frames): RawTrack[] {
  const map = new Map<string, RawTrack>();
  const get = (prop: string): RawTrack => { let t = map.get(prop); if (!t) map.set(prop, (t = { prop, offsets: [], values: [], eases: [] })); return t; };
  if (Array.isArray(frames)) {
    const list = frames as ReadonlyArray<Record<string, unknown>>;
    const offs = spread(list.map((f) => (typeof f.offset === "number" ? f.offset : null)));
    list.forEach((f, i) => {
      for (const k in f) {
        if (META.has(k)) continue;
        const t = get(k);
        t.offsets.push(offs[i]!); t.values.push(f[k] as Value); t.eases.push(f.easing as EaseInput | undefined);
      }
    });
  } else {
    const rec = frames as Record<string, unknown>;
    const eas = rec.easing;
    for (const k in rec) {
      if (META.has(k)) continue;
      const v = rec[k];
      const vals: Value[] = Array.isArray(v) && !isVector(v) ? (v as Value[]) : [v as Value];
      const offs = Array.isArray(rec.offset) ? spread(vals.map((_, i) => ((rec.offset as unknown[])[i] as number | undefined) ?? null)) : spread(vals.map(() => null));
      const t = get(k);
      vals.forEach((val, i) => { t.offsets.push(offs[i]!); t.values.push(val); t.eases.push(Array.isArray(eas) ? (eas[i] as EaseInput | undefined) : (eas as EaseInput | undefined)); });
    }
  }
  // implicit start / end: filled from the current value when compiled (or left to WAAPI when native)
  for (const t of map.values()) {
    if (t.offsets[0]! > 0) { t.offsets.unshift(0); t.values.unshift(null); t.eases.unshift(undefined); }
    if (t.offsets[t.offsets.length - 1]! < 1) { t.offsets.push(1); t.values.push(null); t.eases.push(undefined); }
  }
  return [...map.values()];
}
/** A vector value inside property-indexed frames: an array of arrays means keyframes, a flat number array of length>1 at the top level means keyframes too. Vectors are typed arrays or nested arrays. */
const isVector = (v: unknown): boolean => ArrayBuffer.isView(v);
const KIND_NUM = 0, KIND_COLOR = 1, KIND_DISCRETE = 2;
const fmt = (x: number): string => `${Math.round(x * 1000) / 1000}`;

/** A compiled property track. Drivers read `out` (numbers) or `text()` (CSS string). */
export class Track {
  readonly prop: string;
  /** 0 numbers, 1 color, 2 discrete. */
  readonly kind: number;
  /** Numbers per value. */
  readonly n: number;
  /** The current sampled value (written by sample()). */
  readonly out: Float64Array;
  /** The value was a plain number (not a string or a vector). */
  readonly scalar: boolean;
  /** The value was an array / typed array (a vector). */
  readonly vector: boolean;
  #offs: Float64Array;
  #vals: Float64Array;
  #eases: (Ease | null)[];
  #parts: string[] | null = null;
  #strs: string[] | null = null;
  #seg = 0;
  #pick = 0;

  constructor(raw: RawTrack, current: () => Value) {
    this.prop = raw.prop;
    const values = raw.values.map((v) => (v == null ? current() : v));
    const first = values.find((v) => v != null);
    const k = values.length;
    this.#offs = Float64Array.from(raw.offsets);
    this.#eases = raw.eases.map((e) => (e == null ? null : toEase(e, "linear")));
    
    this.scalar = typeof first === "number";
    this.vector = first != null && typeof first === "object";
    let kind = KIND_NUM, n = 1;
    let vals = new Float64Array(0);
    if (this.scalar || this.vector) {
      n = this.vector ? (first as ArrayLike<number>).length : 1;
      vals = new Float64Array(k * n);
      values.forEach((v, i) => {
        if (typeof v === "number") vals[i * n] = v;
        else if (v != null && typeof v === "object") for (let j = 0; j < n; j++) vals[i * n + j] = (v as ArrayLike<number>)[j] ?? 0;
        else vals[i * n] = parseFloat(String(v)) || 0;
      });
    } else {
      const strs = values.map((v) => (v == null ? "" : String(v)));
      const colors = new Float64Array(k * 4);
      if (strs.every((s, i) => parseColor(s, colors, i * 4))) { kind = KIND_COLOR; n = 4; vals = colors; }
      else {
        const parts = strs.map((s) => s.split(NUM));
        const nums = strs.map((s) => (s.match(NUM) ?? []).map(Number));
        const same = parts.every((p) => p.length === parts[0]!.length && p.every((x, i) => x === parts[0]![i]));
        if (same && nums[0]!.length > 0) {
          n = nums[0]!.length; this.#parts = parts[0]!; vals = new Float64Array(k * n);
          nums.forEach((arr, i) => arr.forEach((x, j) => { vals[i * n + j] = x; }));
        } else { kind = KIND_DISCRETE; this.#strs = strs; n = 0; }
      }
    }
    this.kind = kind; this.n = n; this.#vals = vals;
    this.out = new Float64Array(Math.max(n, 1));
  }

  /** Sample at progress p (0..1, may overshoot with back / spring easings: the end segments extrapolate). */
  sample(p: number): void {
    const o = this.#offs, last = o.length - 1;
    if (last <= 0) { this.#copy(0); return; }
    let i = this.#seg;
    while (i > 0 && p < o[i]!) i--;
    while (i < last - 1 && p >= o[i + 1]!) i++;
    this.#seg = i;
    const a = o[i]!, b = o[i + 1]!;
    let t = b > a ? (p - a) / (b - a) : 1;
    const e = this.#eases[i];
    if (e && t > 0 && t < 1) t = e(t);
    if (this.kind === KIND_DISCRETE) { this.#pick = t < 0.5 ? i : i + 1; return; }
    const n = this.n, v = this.#vals, out = this.out, x = i * n, y = x + n;
    for (let j = 0; j < n; j++) { const s = v[x + j]!; out[j] = s + (v[y + j]! - s) * t; }
  }
  #copy(i: number): void {
    if (this.kind === KIND_DISCRETE) { this.#pick = i; return; }
    for (let j = 0; j < this.n; j++) this.out[j] = this.#vals[i * this.n + j]!;
  }
  /** The current value as a CSS string (colors as oklab()). */
  text(): string {
    if (this.kind === KIND_DISCRETE) return this.#strs![this.#pick] ?? "";
    if (this.kind === KIND_COLOR) return formatOklab(this.out);
    const p = this.#parts;
    if (!p) return fmt(this.out[0]!);
    let s = p[0]!;
    for (let j = 0; j < this.n; j++) s += fmt(this.out[j]!) + p[j + 1]!;
    return s;
  }
  /** The first number of the current value. */
  num(): number { return this.out[0]!; }
  /** Colors only: sRGB 0..1 + alpha into `dest` (WebGL uniforms). */
  rgba(dest: Float32Array | Float64Array | number[], j = 0): void { oklabToRgba(this.out, 0, dest, j); }
}

/** Keyframe objects for WAAPI from raw tracks (null = implicit, left out; colors as oklab() so CSS mixes in OKLab). */
export function nativeFrames(raw: RawTrack[]): Keyframe[] | null {
  const byOffset = new Map<number, Keyframe>();
  for (const t of raw) {
    for (let i = 0; i < t.offsets.length; i++) {
      let v = t.values[i];
      if (v == null) continue;
      if (typeof v === "object") return null; // vectors are JS only
      if (typeof v === "string") { const c = [0, 0, 0, 0]; if (parseColor(v, c)) v = formatOklab(c); }
      const off = t.offsets[i]!;
      let f = byOffset.get(off);
      if (!f) byOffset.set(off, (f = { offset: off }));
      f[t.prop] = v;
      const e = t.eases[i];
      if (e != null && f.easing == null) { const css = toEase(e, "linear").css; if (!css) return null; f.easing = css; }
    }
  }
  return [...byOffset.keys()].sort((a, b) => a - b).map((k) => byOffset.get(k)!);
}
