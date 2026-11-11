// Small charts: Sparkline, Stat (KPI box), ProgressRing (0–100 score) and BarList (ranked horizontal bars).
import { computed, read, reactive } from "../core/reactive.ts";
import { h } from "../dom/h.js";
import { For } from "../dom/flow.js";
import { lttb } from "./lttb.js";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, attr } from "./util.js";

const f1 = (v) => Math.round(v * 10) / 10;

/** Tiny trend line without axes. `data` = numbers or objects (`y` key/fn). */
export function Sparkline(props) {
  const w = computed(() => num(read(props.width)) ?? 120), ht = computed(() => num(read(props.height)) ?? 32);
  const vals = computed(() => { const g = accessor(props.y); return rowsOf(props.data).map((d, i) => num(g(d, i))); });
  const fmt = computed(() => formatter(read(props.format)));
  const geo = computed(() => {
    const v = vals(), W = w(), H = ht(), pad = 3;
    let idx = v.map((_, i) => i).filter((i) => v[i] != null);
    if (idx.length > W * 2) idx = lttb(idx, Math.round(W * 2), (i) => i, (i) => v[i]);
    if (!idx.length) return { line: "", area: "", last: null };
    let lo = Infinity, hi = -Infinity;
    for (const i of idx) { lo = Math.min(lo, v[i]); hi = Math.max(hi, v[i]); }
    if (read(props.zero)) lo = Math.min(lo, 0);
    const n = v.length - 1 || 1, sx = (i) => f1(pad + (i / n) * (W - pad * 2));
    const sy = (x) => f1(hi === lo ? H / 2 : H - pad - ((x - lo) / (hi - lo)) * (H - pad * 2));
    const pts = idx.map((i) => `${sx(i)},${sy(v[i])}`);
    const last = idx[idx.length - 1];
    return { line: `M${pts.join("L")}`, area: `M${sx(idx[0])},${H}L${pts.join("L")}L${sx(last)},${H}Z`, last: [sx(last), sy(v[last])] };
  });
  const summary = () => {
    const v = vals().filter((x) => x != null), f = fmt();
    if (!v.length) return read(props.empty) ?? "No data";
    return `${v.length} values, from ${f(v[0])} to ${f(v[v.length - 1])}, min ${f(Math.min(...v))}, max ${f(Math.max(...v))}`;
  };
  return h("svg", {
    class: () => `hm-sparkline ${seriesClass(num(read(props.color)) ?? 0)}`, style: () => colorStyle(props.colors, 0),
    role: "img", "aria-label": () => (read(props.title) ? `${read(props.title)}: ${summary()}` : summary()),
    viewBox: () => `0 0 ${w()} ${ht()}`, width: w, height: ht, preserveAspectRatio: "none",
  },
  () => (read(props.area) ? h("path", { class: "hm-chart-area", d: attr(() => geo().area) }) : null),
  h("path", { class: "hm-chart-line", d: attr(() => geo().line) }),
  h("circle", { class: "hm-chart-marker", r: 2.5, visibility: () => (geo().last && read(props.dot) !== false ? "visible" : "hidden"),
    cx: attr(() => geo().last?.[0] ?? 0), cy: attr(() => geo().last?.[1] ?? 0) }));
}

/**
 * KPI box: label, formatted value, delta (fraction by default: 0.12 → "+12%") with an arrow, optional sparkline.
 * `previous` computes the delta; `invert` marks a decrease as good (e.g. costs); `deltaFormat` formats |delta|.
 */
export function Stat(props) {
  const fmt = computed(() => formatter(read(props.format)));
  const delta = computed(() => {
    const d = num(read(props.delta));
    if (d != null) return d;
    const v = num(read(props.value)), p = num(read(props.previous));
    return v != null && p ? (v - p) / Math.abs(p) : null;
  });
  const dir = computed(() => { const d = delta(); return d == null ? null : d > 0 ? "up" : d < 0 ? "down" : "flat"; });
  const deltaText = () => {
    const d = delta(), f = formatter(read(props.deltaFormat), (v) => formatter(["percent", 1])(v));
    return `${d > 0 ? "+" : d < 0 ? "−" : ""}${f(Math.abs(d))}`;
  };
  const hasSpark = computed(() => !!read(props.spark));
  const tone = () => { const d = dir(); if (!d || d === "flat") return "hm-stat-neutral"; return (d === "up") !== !!read(props.invert) ? "hm-stat-good" : "hm-stat-bad"; };
  return h("div", { class: () => ["hm-stat", read(props.class)].filter(Boolean).join(" ") },
    h("div", { class: "hm-stat-label" }, () => read(props.label) ?? ""),
    h("div", { class: "hm-stat-value" }, () => { const v = read(props.value); return v == null ? (read(props.empty) ?? "—") : fmt()(v); }),
    () => (dir() ? h("div", { class: () => `hm-stat-delta hm-stat-${dir()} ${tone()}` },
      h("span", { class: "hm-stat-arrow", "aria-hidden": "true" }, () => ({ up: "▲", down: "▼", flat: "–" })[dir()]),
      h("span", { class: "hm-sr-only" }, () => ({ up: "Up ", down: "Down ", flat: "No change " })[dir()]),
      h("span", { class: "hm-stat-delta-value" }, deltaText),
      () => (read(props.hint) ? h("span", { class: "hm-stat-hint" }, ` ${read(props.hint)}`) : null)) : null),
    () => (hasSpark() ? h(Sparkline, { data: reactive(() => read(props.spark)), y: props.sparkY, width: 120, height: 32, area: true, title: reactive(() => read(props.label)) }) : null));
}

/** Score ring 0–100 (or 0–`max`). Level class `hm-ring-low|mid|high` from `thresholds` (default [50, 80]). */
export function ProgressRing(props) {
  const S = computed(() => num(read(props.size)) ?? 64), T = computed(() => num(read(props.thickness)) ?? 8);
  const max = computed(() => num(read(props.max)) ?? 100);
  const v = computed(() => Math.max(0, Math.min(max(), num(read(props.value)) ?? 0)));
  const r = computed(() => (S() - T()) / 2), C = computed(() => 2 * Math.PI * r());
  const level = computed(() => { const [a, b] = read(props.thresholds) ?? [50, 80], p = (v() / max()) * 100; return p < a ? "low" : p < b ? "mid" : "high"; });
  const text = () => formatter(read(props.format), (x) => String(Math.round(x)))(v());
  return h("svg", {
    class: () => `hm-ring hm-ring-${level()}`, role: "img", viewBox: () => `0 0 ${S()} ${S()}`, width: S, height: S,
    "aria-label": () => `${read(props.label) ?? "Score"}: ${text()} of ${max()}`,
  },
  h("circle", { class: "hm-ring-track", cx: () => S() / 2, cy: () => S() / 2, r, "stroke-width": T }),
  h("circle", { class: "hm-ring-value", cx: () => S() / 2, cy: () => S() / 2, r, "stroke-width": T, transform: () => `rotate(-90 ${S() / 2} ${S() / 2})`,
    "stroke-dasharray": attr(() => `${f1((C() * v()) / max())} ${f1(C())}`) }),
  h("text", { class: "hm-ring-text", x: () => S() / 2, y: () => S() / 2, "text-anchor": "middle", "dominant-baseline": "central", "aria-hidden": "true" }, text));
}

/** Ranked horizontal bars with labels ("top N" lists). Rows are buttons when `onSelect` is set. */
export function BarList(props) {
  const fmt = computed(() => formatter(read(props.format)));
  const items = computed(() => {
    const l = accessor(props.x ?? "label"), y = accessor(Array.isArray(props.y) ? props.y[0] : props.y ?? "value");
    let list = rowsOf(props.data).map((d, i) => ({ key: String(l(d, i)), label: String(l(d, i)), value: num(y(d, i)) ?? 0, datum: d, index: i }));
    if (read(props.sort) !== false) list = list.slice().sort((a, b) => b.value - a.value);
    const n = num(read(props.limit));
    return n ? list.slice(0, n) : list;
  });
  const max = computed(() => num(read(props.max)) ?? Math.max(0, ...items().map((i) => i.value)));
  return h("div", { class: () => ["hm-barlist", read(props.class)].filter(Boolean).join(" "), role: "list", "aria-label": () => read(props.title) ?? null },
    h(For, { each: items, key: (i) => i.key, fallback: () => h("div", { class: "hm-chart-empty" }, read(props.empty) ?? "No data") }, (it, idx) => {
      const pct = attr(() => `${max() > 0 ? f1((Math.max(0, it().value) / max()) * 100) : 0}%`);
      const sel = props.onSelect;
      return h("div", { role: "listitem", class: "hm-barlist-item" },
        h(sel ? "button" : "div", { class: "hm-barlist-row", ...(sel ? { type: "button", onClick: () => sel({ ...it(), rank: idx() + 1 }) } : {}) },
          h("svg", { class: "hm-barlist-bar", "aria-hidden": "true", width: "100%", height: "100%", preserveAspectRatio: "none" },
            h("rect", { class: () => `hm-barlist-fill ${seriesClass(num(read(props.color)) ?? 0)}`, style: () => colorStyle(props.colors, 0), x: 0, y: 0, height: "100%", width: pct })),
          h("span", { class: "hm-barlist-label" }, () => it().label),
          h("span", { class: "hm-barlist-value" }, () => fmt()(it().value))));
    }));
}
