import { clamp } from "../core/util.ts";
// Scales and ticks for charts: linear, time, band. Plain functions, no DOM.
//   const x = scaleLinear([0, 100], [0, 640]); x(50) === 320; x.invert(320) === 50; x.ticks(5)
//   const t = scaleTime([start, end], [0, 640]); t(date) → px; t.ticks(6) → ms values on calendar boundaries
//   const b = scaleBand(["a", "b"], [0, 200], { paddingInner: 0.2 }); b("a"), b.bandwidth, b.center("b")

export type Range = readonly [number, number];
export interface NiceTicks { min: number; max: number; step: number; ticks: number[] }
export interface LinearScale {
  (v: unknown): number;
  invert(p: number): number;
  domain: [number, number];
  range: [number, number];
  ticks(n?: number): number[];
  nice(n?: number): LinearScale;
}
export interface TimeScale {
  (v: unknown): number;
  invert(p: number): Date;
  domain: [number, number];
  range: [number, number];
  ticks(n?: number): number[];
}
export interface BandScale<V> {
  (v: V): number;
  center(v: V): number;
  invert(p: number): V | undefined;
  domain: readonly V[];
  range: [number, number];
  bandwidth: number;
  step: number;
}

const round = (v: number): number => Number(v.toPrecision(12));

/** A "nice" step (1, 2, 5 × 10^n) that splits `span` into about `count` parts. */
export function niceStep(span: number, count = 5): number {
  const raw = Math.abs(span) / Math.max(1, count);
  if (!raw || !isFinite(raw)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return round((f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p);
}

/** Round a domain outwards to nice values. Returns `{ min, max, step, ticks }`. */
export function niceTicks(min: number, max: number, count = 5): NiceTicks {
  if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    const d = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= min === 0 ? 0 : d; max += d;
  }
  const step = niceStep(max - min, count);
  const lo = round(Math.floor(min / step) * step), hi = round(Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let i = 0, n = Math.round((hi - lo) / step); i <= n; i++) ticks.push(round(lo + i * step));
  return { min: lo, max: hi, step, ticks };
}

/** Linear scale. `s(v)` → range value; `s.invert(px)`; `s.ticks(n)`; `s.nice(n)` → new scale on a nice domain. */
export function scaleLinear(domain: readonly [unknown, unknown] = [0, 1], range: Range = [0, 1]): LinearScale {
  const d0 = Number(domain[0]), d1 = Number(domain[1]), [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const fn = (v: unknown): number => (k ? r0 + (Number(v) - d0) * k : (r0 + r1) / 2);
  return Object.assign(fn, {
    invert: (p: number): number => (k ? d0 + (p - r0) / k : d0),
    domain: [d0, d1] as [number, number],
    range: [r0, r1] as [number, number],
    ticks: (n = 5): number[] => {
      const lo = Math.min(d0, d1), hi = Math.max(d0, d1), eps = (hi - lo) * 1e-9;
      return niceTicks(lo, hi, n).ticks.filter((t) => t >= lo - eps && t <= hi + eps);
    },
    nice: (n = 5): LinearScale => { const t = niceTicks(d0, d1, n); return scaleLinear([t.min, t.max], range); },
  });
}

const SEC = 1e3, MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const STEPS: ReadonlyArray<readonly [number, number]> = [[SEC, 1], [SEC, 5], [SEC, 15], [SEC, 30], [MIN, 1], [MIN, 5], [MIN, 15], [MIN, 30], [HOUR, 1], [HOUR, 3], [HOUR, 6], [HOUR, 12],
  [DAY, 1], [DAY, 2], [DAY, 7], [DAY * 30, 1], [DAY * 30, 3], [DAY * 365, 1]];
const ms = (v: unknown): number => (v instanceof Date ? v.getTime() : Number(v));

/** Tick values (epoch ms) on calendar boundaries: seconds … days, weeks, months, quarters, years. */
export function timeTicks(start: number | Date, stop: number | Date, count = 6): number[] {
  const t0 = ms(start), t1 = ms(stop);
  if (!(t1 > t0)) return isFinite(t0) ? [t0] : [];
  const span = t1 - t0;
  let [unit, k] = STEPS.find(([u, n]) => span / (u * n) <= count) ?? [DAY * 365, 0];
  if (!k) k = Math.max(1, niceStep(span / (DAY * 365), count));
  const out: number[] = [];
  const d = new Date(t0);
  if (unit < DAY) {
    const step = unit * k, off = d.getTimezoneOffset() * MIN;
    for (let t = Math.ceil((t0 - off) / step) * step + off; t <= t1; t += step) out.push(t);
    return out;
  }
  d.setHours(0, 0, 0, 0);
  if (unit === DAY) {
    if (k === 7) d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Mondays
    const add = (x: Date): number => x.setDate(x.getDate() + k);
    while (d.getTime() < t0) add(d);
    for (; d.getTime() <= t1; add(d)) out.push(d.getTime());
    return out;
  }
  d.setDate(1);
  if (unit === DAY * 30) {
    d.setMonth(Math.floor(d.getMonth() / k) * k);
    const add = (x: Date): number => x.setMonth(x.getMonth() + k);
    while (d.getTime() < t0) add(d);
    for (; d.getTime() <= t1; add(d)) out.push(d.getTime());
    return out;
  }
  d.setMonth(0);
  d.setFullYear(Math.floor(d.getFullYear() / k) * k);
  const add = (x: Date): number => x.setFullYear(x.getFullYear() + k);
  while (d.getTime() < t0) add(d);
  for (; d.getTime() <= t1; add(d)) out.push(d.getTime());
  return out;
}

/** Time scale over Dates or epoch ms. `s.invert(px)` returns a Date. */
export function scaleTime(domain: readonly [unknown, unknown], range: Range = [0, 1]): TimeScale {
  const lin = scaleLinear([ms(domain[0]), ms(domain[1])], range);
  const fn = (v: unknown): number => lin(ms(v));
  return Object.assign(fn, {
    invert: (p: number): Date => new Date(lin.invert(p)),
    domain: lin.domain,
    range: lin.range,
    ticks: (n = 6): number[] => timeTicks(lin.domain[0], lin.domain[1], n),
  });
}

/** Band scale for categories. `s(v)` → band start; `s.bandwidth`; `s.step`; `s.center(v)`; `s.invert(px)` → nearest value. */
export function scaleBand<V>(domain: readonly V[] = [], range: Range = [0, 1], { paddingInner = 0.2, paddingOuter = 0.1 }: { paddingInner?: number; paddingOuter?: number } = {}): BandScale<V> {
  const [r0, r1] = range, n = domain.length;
  const index = new Map(domain.map((v, i) => [v, i]));
  const step = n ? (r1 - r0) / Math.max(1, n - paddingInner + paddingOuter * 2) : 0;
  const bandwidth = step * (1 - paddingInner);
  const start = r0 + step * paddingOuter;
  const fn = (v: V): number => { const i = index.get(v); return i == null ? NaN : start + i * step; };
  return Object.assign(fn, {
    center: (v: V): number => fn(v) + bandwidth / 2,
    invert: (p: number): V | undefined => domain[clamp(Math.floor((p - start + (step - bandwidth) / 2) / (step || 1)), 0, n - 1)],
    domain,
    range: [r0, r1] as [number, number],
    bandwidth,
    step,
  });
}
