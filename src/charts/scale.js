// Scales and ticks for charts: linear, time, band. Plain functions, no DOM.
//   const x = scaleLinear([0, 100], [0, 640]); x(50) === 320; x.invert(320) === 50; x.ticks(5)
//   const t = scaleTime([start, end], [0, 640]); t(date) → px; t.ticks(6) → ms values on calendar boundaries
//   const b = scaleBand(["a", "b"], [0, 200], { paddingInner: 0.2 }); b("a"), b.bandwidth, b.center("b")

const round = (v) => Number(v.toPrecision(12));

/** A "nice" step (1, 2, 5 × 10^n) that splits `span` into about `count` parts. */
export function niceStep(span, count = 5) {
  const raw = Math.abs(span) / Math.max(1, count);
  if (!raw || !isFinite(raw)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return round((f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * p);
}

/** Round a domain outwards to nice values. Returns `{ min, max, step, ticks }`. */
export function niceTicks(min, max, count = 5) {
  if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    const d = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= min === 0 ? 0 : d; max += d;
  }
  const step = niceStep(max - min, count);
  const lo = round(Math.floor(min / step) * step), hi = round(Math.ceil(max / step) * step);
  const ticks = [];
  for (let i = 0, n = Math.round((hi - lo) / step); i <= n; i++) ticks.push(round(lo + i * step));
  return { min: lo, max: hi, step, ticks };
}

/** Linear scale. `s(v)` → range value; `s.invert(px)`; `s.ticks(n)`; `s.nice(n)` → new scale on a nice domain. */
export function scaleLinear(domain = [0, 1], range = [0, 1]) {
  const [d0, d1] = domain.map(Number), [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const s = (v) => (k ? r0 + (Number(v) - d0) * k : (r0 + r1) / 2);
  s.invert = (p) => (k ? d0 + (p - r0) / k : d0);
  s.domain = [d0, d1];
  s.range = [r0, r1];
  s.ticks = (n = 5) => {
    const lo = Math.min(d0, d1), hi = Math.max(d0, d1), eps = (hi - lo) * 1e-9;
    return niceTicks(lo, hi, n).ticks.filter((t) => t >= lo - eps && t <= hi + eps);
  };
  s.nice = (n = 5) => { const t = niceTicks(d0, d1, n); return scaleLinear([t.min, t.max], range); };
  return s;
}

const SEC = 1e3, MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const STEPS = [[SEC, 1], [SEC, 5], [SEC, 15], [SEC, 30], [MIN, 1], [MIN, 5], [MIN, 15], [MIN, 30], [HOUR, 1], [HOUR, 3], [HOUR, 6], [HOUR, 12],
  [DAY, 1], [DAY, 2], [DAY, 7], [DAY * 30, 1], [DAY * 30, 3], [DAY * 365, 1]];
const ms = (v) => (v instanceof Date ? v.getTime() : Number(v));

/** Tick values (epoch ms) on calendar boundaries: seconds … days, weeks, months, quarters, years. */
export function timeTicks(t0, t1, count = 6) {
  t0 = ms(t0); t1 = ms(t1);
  if (!(t1 > t0)) return isFinite(t0) ? [t0] : [];
  const span = t1 - t0;
  let [unit, k] = STEPS.find(([u, n]) => span / (u * n) <= count) ?? [DAY * 365, 0];
  if (!k) k = Math.max(1, niceStep(span / (DAY * 365), count));
  const out = [];
  const d = new Date(t0);
  if (unit < DAY) {
    const step = unit * k, off = d.getTimezoneOffset() * MIN;
    for (let t = Math.ceil((t0 - off) / step) * step + off; t <= t1; t += step) out.push(t);
    return out;
  }
  d.setHours(0, 0, 0, 0);
  if (unit === DAY) {
    if (k === 7) d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Mondays
    const add = (x) => x.setDate(x.getDate() + k);
    while (d.getTime() < t0) add(d);
    for (; d.getTime() <= t1; add(d)) out.push(d.getTime());
    return out;
  }
  d.setDate(1);
  if (unit === DAY * 30) {
    d.setMonth(Math.floor(d.getMonth() / k) * k);
    const add = (x) => x.setMonth(x.getMonth() + k);
    while (d.getTime() < t0) add(d);
    for (; d.getTime() <= t1; add(d)) out.push(d.getTime());
    return out;
  }
  d.setMonth(0);
  d.setFullYear(Math.floor(d.getFullYear() / k) * k);
  const add = (x) => x.setFullYear(x.getFullYear() + k);
  while (d.getTime() < t0) add(d);
  for (; d.getTime() <= t1; add(d)) out.push(d.getTime());
  return out;
}

/** Time scale over Dates or epoch ms. `s.invert(px)` returns a Date. */
export function scaleTime(domain, range = [0, 1]) {
  const lin = scaleLinear(domain.map(ms), range);
  const s = (v) => lin(ms(v));
  s.invert = (p) => new Date(lin.invert(p));
  s.domain = lin.domain;
  s.range = lin.range;
  s.ticks = (n = 6) => timeTicks(lin.domain[0], lin.domain[1], n);
  return s;
}

/** Band scale for categories. `s(v)` → band start; `s.bandwidth`; `s.step`; `s.center(v)`; `s.invert(px)` → nearest value. */
export function scaleBand(domain = [], range = [0, 1], { paddingInner = 0.2, paddingOuter = 0.1 } = {}) {
  const [r0, r1] = range, n = domain.length;
  const index = new Map(domain.map((v, i) => [v, i]));
  const step = n ? (r1 - r0) / Math.max(1, n - paddingInner + paddingOuter * 2) : 0;
  const bandwidth = step * (1 - paddingInner);
  const start = r0 + step * paddingOuter;
  const s = (v) => { const i = index.get(v); return i == null ? NaN : start + i * step; };
  s.center = (v) => s(v) + bandwidth / 2;
  s.invert = (p) => domain[Math.max(0, Math.min(n - 1, Math.floor((p - start + (step - bandwidth) / 2) / (step || 1))))];
  s.domain = domain;
  s.range = [r0, r1];
  s.bandwidth = bandwidth;
  s.step = step;
  return s;
}
