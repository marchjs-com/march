// ChoroplethMap: regions coloured by a value (march/charts). Folder: src/components/data/choropleth-map/; shared chart
// parts (frame, tooltip, data table, formats, motion, colour scales) are in src/charts/.
// The built-in map is Turkey's 81 provinces (turkey.ts, generated from Natural Earth, public domain); it is loaded with
// a dynamic import so a page drawing its own `shapes` never downloads it. Rows are matched to shapes by id, plate code
// or name (case / diacritic insensitive, Turkish İ/ı folded). Each region tweens a 0..1 share on the motion engine and
// is filled with the colour at that share (OKLab color-mix): entrance as a west→east wave, data changes morph, leaving
// shapes fade out (presence). The visible region (focus, wheel / pinch zoom, drag pan) is a tweened view box.
import "./choropleth-map.css";
import { signal, computed, read, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { accessor, formatter, num, rowsOf, useSize, attr, textWidth, localPoint, each, nextId,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp } from "../../../charts/util.ts";
import { tween, presence, animateOf, type AnimateProp, type AnimateOptions, type MotionContext, type Present } from "../../../charts/motion.ts";
import { Frame, tooltipState, showTip } from "../../../charts/parts.ts";
import { colorScale, type ColorScale } from "../../../charts/color.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** One region of a map: an id, a name, an SVG path and an optional label point (default the centre of its box). */
export interface MapShape { id: string | number; name?: string; d: string; cx?: number; cy?: number; code?: number }
/** A GeoJSON feature (Polygon or MultiPolygon, lon/lat). */
export interface GeoFeature { type?: string; id?: string | number; properties?: Record<string, unknown> | null; geometry: { type: string; coordinates: unknown } | null }
/** A GeoJSON FeatureCollection; projected equirectangularly by `projectGeo`. */
export interface GeoCollection { type: "FeatureCollection"; features: readonly GeoFeature[] }
/** Point passed to `tooltip(point)`, `labels(point)` and `onSelect(point)` of a choropleth map. */
export interface MapPoint<D> { index: number; id: string; name: string; value: number | null; label: string; bin: number; datum: D | undefined; shape: MapShape }

export interface ChoroplethMapProps<D = unknown> extends ChartBaseProps {
  /** Rows: an array (or signal / function returning one) of objects, one per region. @tr Satırlar: bölge başına bir nesneden oluşan dizi (ya da onu döndüren sinyal / fonksiyon). */
  data?: DataProp<D>;
  /** Which region a row belongs to: a key or getter (default "id"); matches the shape id, a plate code (34, "34", "TR-34") or the name, ignoring case and diacritics. @tr Satırın hangi bölgeye ait olduğu: bir anahtar ya da getter (varsayılan "id"); şekil kimliği, plaka kodu (34, "34", "TR-34") ya da adla eşleşir; büyük/küçük harf ve aksan önemsenmez. */
  id?: Field<D> | undefined;
  /** The value of a row: a key or getter (default "value"). @tr Satırın değeri: bir anahtar ya da getter (varsayılan "value"). */
  value?: Field<D> | undefined;
  /** Built-in map: "turkey" (default, the 81 provinces) or "turkey-regions" (the 7 geographic regions; rows match by id — marmara, aegean, mediterranean, central-anatolia, black-sea, eastern-anatolia, southeastern-anatolia — or by Turkish name); ignored when `shapes` is given. @tr Hazır harita: "turkey" (varsayılan, 81 il) ya da "turkey-regions" (7 coğrafi bölge; satırlar kimliğe — marmara, aegean, mediterranean, central-anatolia, black-sea, eastern-anatolia, southeastern-anatolia — ya da Türkçe ada göre eşleşir); `shapes` verilince yok sayılır. */
  map?: Opt<"turkey" | "turkey-regions">;
  /** Your own regions: `[{ id, name, d, cx?, cy? }]` (with `viewBox`) or a GeoJSON FeatureCollection. @tr Kendi bölgeleriniz: `[{ id, name, d, cx?, cy? }]` (`viewBox` ile) ya da bir GeoJSON FeatureCollection. */
  shapes?: Opt<readonly MapShape[] | GeoCollection>;
  /** Coordinate box of `shapes`: `[width, height]` or `[x, y, width, height]` (default the shapes' bounds). @tr `shapes` koordinat kutusu: `[genişlik, yükseklik]` ya da `[x, y, genişlik, yükseklik]` (varsayılan şekillerin sınırları). */
  viewBox?: Opt<readonly number[]>;
  /** Value → colour: "sequential" (default), "diverging" (around `mid`), or two / three CSS colours or tokens. @tr Değer → renk: "sequential" (varsayılan), "diverging" (`mid` etrafında) ya da iki / üç CSS rengi veya belirteci. */
  colorScale?: Opt<ColorScale>;
  /** Classes instead of a continuous scale: a count (equal intervals) or a list of thresholds; the legend lists the class ranges. @tr Sürekli ölçek yerine sınıflar: bir sayı (eşit aralıklar) ya da eşik listesi; açıklama sınıf aralıklarını gösterir. */
  bins?: Opt<number | readonly number[]>;
  /** Low end of the colour domain (default the data minimum). @tr Renk aralığının alt ucu (varsayılan verideki en küçük değer). */
  min?: Opt<number>;
  /** High end of the colour domain (default the data maximum). @tr Renk aralığının üst ucu (varsayılan verideki en büyük değer). */
  max?: Opt<number>;
  /** Centre of a diverging scale (default the middle of the domain). @tr Iraksak ölçeğin merkezi (varsayılan aralığın ortası). */
  mid?: Opt<number>;
  /** Fill of regions without data: a CSS colour or token (default a light hatch). @tr Verisi olmayan bölgelerin dolgusu: CSS rengi ya da belirteci (varsayılan açık bir tarama). */
  noData?: Opt<string>;
  /** Labels at the regions: `true` / "name", "value", or `(point) => text`; hidden where they do not fit. @tr Bölgelerin üzerinde etiketler: `true` / "name", "value" ya da `(point) => text`; sığmadıkları yerde gizlenir. */
  labels?: Opt<boolean | "name" | "value" | ((p: MapPoint<D>) => unknown)>;
  /** Regions to fit the view to (ids, plate codes or names); changing it glides the view. @tr Görünümün sığdırılacağı bölgeler (kimlik, plaka kodu ya da ad); değişince görünüm kayarak geçer. */
  focus?: Opt<readonly (string | number)[]>;
  /** Zoom and pan: Ctrl/⌘ + wheel or pinch, drag to pan, + − and reset buttons, keys + − 0 (default true). @tr Yakınlaştırma ve kaydırma: Ctrl/⌘ + tekerlek ya da iki parmak, sürükleyerek kaydırma, + − ve sıfırla düğmeleri, + − 0 tuşları (varsayılan true). */
  zoom?: Opt<boolean>;
  /** Value format for tooltip, labels, legend and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Araç ipucu, etiketler, açıklama ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Header of the region column in the data table (default "Region"). @tr Veri tablosundaki bölge sütununun başlığı (varsayılan "Region"). */
  xLabel?: Opt<string>;
  /** Name of the value in tooltip and table (default "Value"). @tr Araç ipucu ve tablodaki değerin adı (varsayılan "Value"). */
  yLabel?: Opt<string>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<MapPoint<D>>;
  /** Called with the region on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki bölgede Enter / Space'e basılınca bölgeyle çağrılır. */
  onSelect?: Handler<[p: MapPoint<D>]> | undefined;
  /** Motion: regions colour in as a west → east wave, morph to new colours, fade out when they leave; focus and zoom glide. `true` (spring, default), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Hareket: bölgeler batıdan doğuya bir dalgayla boyanır, yeni renklerine geçer, giderken söner; odak ve yakınlaştırma kayarak geçer. `true` (yay, varsayılan), `false`, bir easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
}

interface Shape { key: string; id: string; name: string; d: string; cx: number; cy: number; code?: number | undefined; box: Box4; src: MapShape }
type Box4 = [number, number, number, number]; // x0, y0, x1, y1
type View = [number, number, number, number]; // x, y, w, h
interface Cell<D> { value: number | null; datum: D; index: number }

// ------------------------------------------------------------------ built-in map (lazy)
type TurkeyModule = typeof import("./turkey.ts");
let turkeyLoad: Promise<TurkeyModule> | null = null;
let turkeyData: TurkeyModule | null = null;
/** Load the built-in Turkey map (its own chunk). Resolves when every mounted map can draw it. */
export const loadTurkey = (): Promise<TurkeyModule> => (turkeyLoad ??= import("./turkey.ts").then((m) => (turkeyData = m)));
const TURKEY_BOX: View = [0, 0, 1000, 423];
const ACCENT = "var(--m-chart-hi, var(--m-accent, var(--m-primary)))";
const DEEP = [`var(--m-chart-lo, color-mix(in oklab, ${ACCENT} 10%, var(--m-surface, #fff)))`, ACCENT, `var(--m-chart-deep, color-mix(in oklab, ${ACCENT} 55%, var(--m-text, #17171a)))`] as const;
const ALIASES: Record<string, string> = { afyon: "tr03", icel: "tr33", maras: "tr46", urfa: "tr63", antep: "tr27" };
// the 7 geographic regions: one letter per province, by plate code (1 = Adana … 81 = Düzce)
const REGION_OF = "AGEDKIAKEMMDDKAMMIKEGMDDDIGKKDAAAMEDKIMIMIEDEAGEDIIKKMKGKIMKKDGEDIKIKIIGGKDDMKGAK";
// the 7 geographic regions: an English id (data rows may use it) and the Turkish name shown on the map (rows may use it too)
const REGIONS: Record<string, readonly [string, string]> = { M: ["marmara", "Marmara"], E: ["aegean", "Ege"], A: ["mediterranean", "Akdeniz"], I: ["central-anatolia", "İç Anadolu"], K: ["black-sea", "Karadeniz"], D: ["eastern-anatolia", "Doğu Anadolu"], G: ["southeastern-anatolia", "Güneydoğu Anadolu"] };
/** The provinces merged into their regions: one shape each (the provinces' paths), labelled at their mean centre. */
function regionsOf(list: readonly MapShape[]): MapShape[] {
  const by = new Map<string, MapShape[]>();
  for (const p of list) { const r = REGION_OF[(p.code ?? 0) - 1]; if (r) by.set(r, [...(by.get(r) ?? []), p]); }
  return [...by].map(([r, ps]) => ({ id: REGIONS[r]![0], name: REGIONS[r]![1], d: ps.map((p) => p.d).join(""),
    cx: ps.reduce((a, p) => a + (p.cx ?? 0), 0) / ps.length, cy: ps.reduce((a, p) => a + (p.cy ?? 0), 0) / ps.length }));
}

// ------------------------------------------------------------------ geometry helpers
const f2 = (v: number): number => Math.round(v * 100) / 100;
const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
/** Bounding box `[x0, y0, x1, y1]` of an SVG path (curve control points ignored). */
export function pathBox(d: string): Box4 {
  let x = 0, y = 0, sx = 0, sy = 0, cmd = "", args: number[] = [];
  const b: Box4 = [Infinity, Infinity, -Infinity, -Infinity];
  for (const m of d.matchAll(/([a-zA-Z])|(-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?)/g)) {
    if (m[1]) { cmd = m[1]; args = []; if (cmd === "z" || cmd === "Z") { x = sx; y = sy; } continue; }
    args.push(+(m[2] as string));
    const lc = cmd.toLowerCase(), n = ARGS[lc] ?? 0, rel = cmd !== cmd.toUpperCase();
    if (!n || args.length < n) continue;
    if (lc === "h") x = (rel ? x : 0) + (args[0] as number);
    else if (lc === "v") y = (rel ? y : 0) + (args[0] as number);
    else { const ex = args[n - 2] as number, ey = args[n - 1] as number; x = rel ? x + ex : ex; y = rel ? y + ey : ey; }
    if (lc === "m") { sx = x; sy = y; cmd = rel ? "l" : "L"; }
    args = [];
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  return isFinite(b[0]) ? b : [0, 0, 0, 0];
}

/** Project a GeoJSON FeatureCollection equirectangularly (x scaled by cos of the middle latitude) into `width` units. */
export function projectGeo(fc: GeoCollection, width = 1000): { shapes: MapShape[]; viewBox: [number, number] } {
  type Ring = number[][];
  const feats = fc.features.map((f) => {
    const g = f.geometry, c = g?.coordinates as unknown;
    const polys = (g?.type === "Polygon" ? [c] : g?.type === "MultiPolygon" ? (c as unknown[]) : []) as Ring[][];
    return { f, polys };
  });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { polys } of feats) for (const p of polys) for (const r of p) for (const [lon, lat] of r) {
    x0 = Math.min(x0, lon as number); x1 = Math.max(x1, lon as number); y0 = Math.min(y0, lat as number); y1 = Math.max(y1, lat as number);
  }
  if (!isFinite(x0)) return { shapes: [], viewBox: [width, width / 2] };
  const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180), s = width / (((x1 - x0) * kx) || 1);
  const px = (lon: number): number => f2((lon - x0) * kx * s), py = (lat: number): number => f2((y1 - lat) * s);
  const shapes = feats.map(({ f, polys }, i) => {
    let best = 0, cx = 0, cy = 0, d = "";
    for (const p of polys) for (const [j, r] of p.entries()) {
      const pts = r.map(([lon, lat]) => [px(lon as number), py(lat as number)] as const);
      d += pts.map(([x, y], k) => `${k ? "L" : "M"}${x} ${y}`).join("") + "Z";
      if (j) continue; // holes do not place the label
      let a = 0, gx = 0, gy = 0;
      for (let k = 0; k < pts.length; k++) {
        const [xa, ya] = pts[k] as readonly [number, number], [xb, yb] = pts[(k + 1) % pts.length] as readonly [number, number], w = xa * yb - xb * ya;
        a += w; gx += (xa + xb) * w; gy += (ya + yb) * w;
      }
      if (Math.abs(a) > best && a) { best = Math.abs(a); cx = gx / (3 * a); cy = gy / (3 * a); }
    }
    const pr = f.properties ?? {};
    const id = f.id ?? (pr.id as string | undefined) ?? (pr.iso_3166_2 as string | undefined) ?? (pr.name as string | undefined) ?? String(i);
    return { id, name: String(pr.name ?? id), d, ...(best ? { cx: f2(cx), cy: f2(cy) } : {}) };
  });
  return { shapes, viewBox: [width, Math.ceil((y1 - y0) * s)] };
}

/** Matching key: lower case, Turkish İ/I/ı folded to i, diacritics and punctuation dropped, numbers without leading zeros. */
export function regionKey(v: unknown): string {
  const s = String(v ?? "").trim().replace(/[İIı]/g, "i").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  return /^\d+$/.test(s) ? String(Number(s)) : s;
}

const isGeo = (v: unknown): v is GeoCollection => !!v && typeof v === "object" && "features" in v;
const cssColor = (c: string): string => (c.startsWith("--") ? `var(${c})` : c);
const mixOf = (a: string, b: string, k: number): string => (k <= 0 ? a : k >= 1 ? b : `color-mix(in oklab, ${b} ${Math.round(k * 1000) / 10}%, ${a})`);

/** The `animate` prop of one region: the entrance gets a west → east wave (`x` 0..1) unless a stagger is given. */
function waveOf(p: AnimateProp, x: number): (ctx: MotionContext) => AnimateOptions | false {
  return (ctx) => {
    let v = typeof p === "function" ? p(ctx) : p;
    if (v === undefined) v = true;
    if (!v) return false;
    const o: AnimateOptions = v === true ? {} : typeof v === "string" ? { easing: v } : v;
    return ctx.phase === "enter" && o.stagger == null ? { ...o, delay: (o.delay ?? 0) + Math.round(x * 700) } : o;
  };
}
/** The view box glides with the chart's easing, without stagger or delay. */
function glideOf(p: AnimateProp): AnimateProp {
  if (typeof p === "function") return (ctx: MotionContext) => { const v = p(ctx); return v && typeof v === "object" ? { ...v, stagger: 0, delay: 0, enter: true } : v; };
  return p && typeof p === "object" ? { ...p, stagger: 0, delay: 0, enter: true } : p;
}

/** Choropleth map: regions coloured by value, with a colour legend, keyboard, tooltip, focus and zoom. */
export function ChoroplethMap<D>(props: ChoroplethMapProps<D>): Element {
  const size = useSize(props, 640, 0);
  const active = signal<string | null>(null), selected = signal<string | null>(null), picked = signal(new Set<number>());
  const turkey = signal(turkeyData?.TURKEY ?? null);
  const userView = signal<View | null>(null);
  const tip = tooltipState();
  const pid = nextId("m-choro");
  let svg: Element | null = null, instant = false;

  const raw = (): readonly MapShape[] | GeoCollection | null | undefined => read(props.shapes);
  effect(() => { if (!raw() && !turkey()) void loadTurkey().then((m) => turkey.set(m.TURKEY)); });

  // shapes in map units, the full view box and the matching table
  const geo = computed(() => {
    const r = raw();
    let list: readonly MapShape[], vb: View | null = null;
    if (isGeo(r)) { const p = projectGeo(r); list = p.shapes; vb = [0, 0, p.viewBox[0], p.viewBox[1]]; }
    else if (r) list = r;
    else { const t = turkey() ?? []; list = read(props.map) === "turkey-regions" ? regionsOf(t) : t; vb = TURKEY_BOX; }
    const shapes: Shape[] = list.map((s) => {
      const box = pathBox(s.d);
      return { key: String(s.id), id: String(s.id), name: s.name ?? String(s.id), d: s.d, cx: s.cx ?? (box[0] + box[2]) / 2, cy: s.cy ?? (box[1] + box[3]) / 2, code: s.code, box, src: s };
    });
    const given = r && !isGeo(r) ? read(props.viewBox) : null;
    if (given?.length === 2) vb = [0, 0, given[0] as number, given[1] as number];
    else if (given?.length === 4) vb = [...given] as View;
    if (!vb) {
      const b = shapes.reduce<Box4>((a, s) => [Math.min(a[0], s.box[0]), Math.min(a[1], s.box[1]), Math.max(a[2], s.box[2]), Math.max(a[3], s.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);
      vb = isFinite(b[0]) ? [b[0], b[1], (b[2] - b[0]) || 1, (b[3] - b[1]) || 1] : TURKEY_BOX;
    }
    const lookup = new Map<string, string>();
    for (const s of shapes) {
      for (const k of [s.id, s.name, s.code, s.code != null ? `tr${String(s.code).padStart(2, "0")}` : null]) if (k != null) lookup.set(regionKey(k), s.key);
    }
    if (!r) for (const [a, id] of Object.entries(ALIASES)) { const k = lookup.get(id); if (k) lookup.set(a, k); }
    return { shapes, vb, lookup, ready: !!r || !!turkey() };
  });
  const byKey = computed(() => new Map(geo().shapes.map((s) => [s.key, s])));
  const find = (v: unknown): string | undefined => geo().lookup.get(regionKey(v));

  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const cells = computed(() => {
    const gi = accessor<D>(props.id ?? "id"), gv = accessor<D>(props.value ?? "value"), out = new Map<string, Cell<D>>();
    rowsOf(props.data).forEach((d, i) => { const k = find(gi(d, i)); if (k) out.set(k, { value: num(gv(d, i)), datum: d, index: i }); });
    return out;
  });
  const domain = computed(() => {
    let lo = Infinity, hi = -Infinity;
    for (const c of cells().values()) if (c.value != null) { lo = Math.min(lo, c.value); hi = Math.max(hi, c.value); }
    lo = num(read(props.min)) ?? (isFinite(lo) ? lo : 0); hi = num(read(props.max)) ?? (isFinite(hi) ? hi : 1);
    return { lo, hi: hi > lo ? hi : lo + 1 };
  });
  const thresholds = computed((): number[] | null => {
    const b = read(props.bins);
    if (Array.isArray(b)) return b.length ? [...(b as number[])].sort((x, y) => x - y) : null;
    const n = Math.round(num(b) ?? 0), { lo, hi } = domain();
    return n >= 2 ? Array.from({ length: n - 1 }, (_, i) => lo + ((hi - lo) * (i + 1)) / n) : null;
  });
  const classOf = (v: number): number => { const th = thresholds(); return th ? th.filter((x) => v >= x).length : 0; };
  const shareOf = (v: number): number => {
    const th = thresholds();
    if (th) return th.length ? classOf(v) / th.length : 1;
    const { lo, hi } = domain();
    return clamp((v - lo) / (hi - lo), 0, 1);
  };
  // colour at a share: the `colors` list as stops, else the shared colour scale (OKLab color-mix)
  const ramp = computed(() => {
    const cs = read(props.colors);
    if (cs && cs.length >= 2) { const stops = cs.map(cssColor); return (s: number): string => { const g = clamp(s, 0, 1) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(g)); return mixOf(stops[i] as string, stops[i + 1] as string, g - i); }; }
    const m = num(read(props.mid)), { lo, hi } = domain();
    const cs0 = read(props.colorScale), seq = cs0 == null || cs0 === "sequential";
    // sequential: a faint tint → the accent → the accent deepened toward the text colour (more steps to tell apart)
    const sc = colorScale(seq ? DEEP : cs0, 0, 1, seq ? 0.55 : m == null ? undefined : clamp((m - lo) / (hi - lo), 0, 1));
    return (s: number): string => sc(clamp(s, 0, 1));
  });
  const noFill = (): string => { const c = read(props.noData); return c ? cssColor(c) : `url(#${pid}-hatch)`; };

  // view: the full box, the focused regions, or what the user zoomed to; drawn through a tweened box
  const focusView = computed((): View | null => {
    const f = read(props.focus), m = byKey();
    if (!f?.length) return null;
    let b: Box4 = [Infinity, Infinity, -Infinity, -Infinity];
    for (const id of f) { const s = m.get(find(id) ?? ""); if (s) b = [Math.min(b[0], s.box[0]), Math.min(b[1], s.box[1]), Math.max(b[2], s.box[2]), Math.max(b[3], s.box[3])]; }
    if (!isFinite(b[0])) return null;
    const w = b[2] - b[0], hh = b[3] - b[1], p = Math.max(w, hh) * 0.08 + 4;
    return [b[0] - p, b[1] - p, w + 2 * p, hh + 2 * p];
  });
  const baseView = (): View => focusView() ?? geo().vb;
  const targetView = computed((): View => userView() ?? baseView(), { equals: (a, b) => !!a && !!b && a.every((v, i) => v === b[i]) });
  const shown = tween(() => ({ v: targetView() }), ["v"], () => (instant ? false : glideOf(animateOf(props.animate))));
  const height = computed(() => { const vb = geo().vb; return num(read(props.height)) ?? Math.round(size.width() * (vb[3] / vb[2])); });
  const fitOf = (v: View): { k: number; ox: number; oy: number } => {
    const W = size.width(), H = height(), k = Math.min(W / v[2], H / v[3]);
    return { k, ox: (W - v[2] * k) / 2 - v[0] * k, oy: (H - v[3] * k) / 2 - v[1] * k };
  };
  const fit = computed(() => fitOf(shown().v as View));
  const toScreen = (x: number, y: number): [number, number] => { const f = fit(); return [f.ox + x * f.k, f.oy + y * f.k]; };
  effect(() => { focusView(); untrack(() => { instant = false; userView.set(null); }); });

  const zoomOn = (): boolean => read(props.zoom) !== false;
  const setView = (v: View | null, jump: boolean): void => {
    instant = jump;
    if (!v) { userView.set(null); return; }
    const full = geo().vb;
    if (v[2] >= full[2] - 1e-6 && !focusView()) { userView.set(null); return; }
    const cx = clamp(v[0] + v[2] / 2, full[0], full[0] + full[2]), cy = clamp(v[1] + v[3] / 2, full[1], full[1] + full[3]);
    userView.set([cx - v[2] / 2, cy - v[3] / 2, v[2], v[3]]);
  };
  /** Zoom by `f` (> 1 in) around a point in svg units (default the centre). */
  const zoomBy = (f: number, at?: [number, number], jump = false): void => {
    if (!zoomOn()) return;
    const cur = targetView.peek(), full = geo.peek().vb, ft = untrack(() => fitOf(cur));
    const [sx, sy] = at ?? [size.width.peek() / 2, height.peek() / 2];
    const mx = (sx - ft.ox) / ft.k, my = (sy - ft.oy) / ft.k;
    const nw = clamp(cur[2] / f, full[2] / 12, Math.max(full[2], cur[2])), r = nw / cur[2];
    setView([mx - (mx - cur[0]) * r, my - (my - cur[1]) * r, nw, cur[3] * r], jump);
  };
  const panBy = (dx: number, dy: number): void => { const cur = targetView.peek(), k = untrack(() => fitOf(cur)).k; setView([cur[0] - dx / k, cur[1] - dy / k, cur[2], cur[3]], true); };
  const reset = (): void => setView(null, false);

  // regions (presence: shapes that leave fade out before they go)
  const pres = presence(() => geo().shapes, (s) => s.key, () => animateOf(props.animate));
  const fills = new Map<string, () => string>();
  const valueOf = (k: string): number | null => cells().get(k)?.value ?? null;
  const dimmed = (k: string): boolean => { const p = picked(); if (!p.size || !thresholds()) return false; const v = valueOf(k); return v == null || !p.has(classOf(v)); };

  const pointOf = (k: string): MapPoint<D> | undefined => {
    const s = byKey().get(k);
    if (!s) return undefined;
    const c = cells().get(k), v = c?.value ?? null;
    return { index: geo().shapes.indexOf(s), id: s.id, name: s.name, value: v, label: v == null ? "—" : String(fmt()(v)), bin: v == null ? -1 : classOf(v), datum: c?.datum, shape: s.src };
  };
  const tipCard = (p: MapPoint<D>, fill: string | undefined): Element => h("div", { class: "m-chart-tip m-choropleth-tip" },
    h("div", { class: "m-chart-tip-title" }, p.name),
    h("div", { class: "m-chart-tip-row", style: fill ? { "--m-c": fill } : {} },
      h("span", { class: "m-chart-swatch", "aria-hidden": "true" }),
      h("span", { class: "m-chart-tip-label" }, String(read(props.yLabel) ?? t`Value`)),
      h("span", { class: "m-chart-tip-value" }, p.value == null ? t`No data` : p.label)));
  const show = (k: string | null): void => {
    active.set(k);
    const opt = read(props.tooltip), s = k ? byKey().get(k) : undefined, p = k ? pointOf(k) : undefined;
    if (!s || !p || opt === false) return void tip.at.set(null);
    const [x, y] = toScreen(s.cx, s.cy);
    showTip(tip, svg, size.width(), x, y, typeof opt === "function" ? () => opt(p) : () => tipCard(p, fills.get(s.key)?.()));
  };
  const hide = (): void => { active.set(null); tip.at.set(null); };
  const select = (k: string | null = active.peek()): void => { const p = k ? pointOf(k) : undefined; if (!p) return; selected.set(k); props.onSelect?.(p); };

  // keyboard: arrows go to the nearest region in that direction (by label point)
  const DIRS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const nearest = (from: Shape | undefined, key: string): Shape | undefined => {
    const list = geo().shapes;
    if (!from) { const v = targetView.peek(), mx = v[0] + v[2] / 2, my = v[1] + v[3] / 2; return list.reduce<Shape | undefined>((b, s) => (!b || Math.hypot(s.cx - mx, s.cy - my) < Math.hypot(b.cx - mx, b.cy - my) ? s : b), undefined); }
    const [ux, uy] = DIRS[key] as [number, number];
    let best: Shape | undefined, score = Infinity;
    for (const s of list) {
      const dx = s.cx - from.cx, dy = s.cy - from.cy, along = dx * ux + dy * uy;
      if (s === from || along <= 0) continue;
      const sc = along + 2 * Math.abs(dx * uy - dy * ux);
      if (sc < score) { score = sc; best = s; }
    }
    return best;
  };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") { hide(); selected.set(null); return; }
    if (zoomOn() && (e.key === "+" || e.key === "=")) { e.preventDefault(); return zoomBy(1.6); }
    if (zoomOn() && e.key === "-") { e.preventDefault(); return zoomBy(1 / 1.6); }
    if (zoomOn() && e.key === "0") { e.preventDefault(); return reset(); }
    if (!(e.key in DIRS)) return;
    const a = active.peek(), next = nearest(a ? byKey().get(a) : undefined, e.key);
    e.preventDefault();
    if (next) show(next.key);
  };

  // pointer: drag pans, two pointers pinch, Ctrl/⌘ + wheel (and trackpad pinch) zooms
  const pts = new Map<number, [number, number]>();
  let dragged = false, last: [number, number] | null = null, spread = 0;
  const at = (e: PointerEvent | WheelEvent): [number, number] => localPoint(svg, e, size.width());
  const mid = (): [number, number] => { const v = [...pts.values()]; return [((v[0]?.[0] ?? 0) + (v[1]?.[0] ?? 0)) / 2, ((v[0]?.[1] ?? 0) + (v[1]?.[1] ?? 0)) / 2]; };
  const gap = (): number => { const v = [...pts.values()]; return v.length < 2 ? 0 : Math.hypot((v[0] as number[])[0]! - (v[1] as number[])[0]!, (v[0] as number[])[1]! - (v[1] as number[])[1]!); };
  const onPointerDown = (e: PointerEvent): void => {
    if (!zoomOn() || (e.button ?? 0) !== 0) return;
    pts.set(e.pointerId, at(e)); dragged = false;
    last = pts.size === 2 ? mid() : at(e); spread = gap();
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, at(e));
    const p = pts.size === 2 ? mid() : at(e);
    if (pts.size === 2) { const g = gap(); if (spread && g) zoomBy(g / spread, p, true); spread = g; }
    if (last && (dragged || Math.hypot(p[0] - last[0], p[1] - last[1]) > 3)) {
      if (!dragged && pts.size === 1 && !userView.peek()) { last = p; return; } // at full size a drag does nothing
      if (!dragged) { dragged = true; (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId); tip.at.set(null); }
      panBy(p[0] - last[0], p[1] - last[1]);
      last = p;
    }
  };
  const onPointerUp = (e: PointerEvent): void => { pts.delete(e.pointerId); last = pts.size ? [...pts.values()][0] as [number, number] : null; spread = gap(); };
  const onWheel = (e: WheelEvent): void => {
    if (!zoomOn() || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.0025), at(e), true);
  };

  // labels in screen units (they keep their size while the map zooms); hidden where the region is too small
  const labelList = computed(() => {
    const mode = read(props.labels);
    if (!mode) return [];
    const f = fit(), out: { key: string; x: number; y: number; text: string }[] = [];
    for (const s of geo().shapes) {
      const p = pointOf(s.key) as MapPoint<D>;
      const text = typeof mode === "function" ? mode(p) : mode === "value" ? (p.value == null ? null : p.label) : p.name;
      if (text == null || text === "") continue;
      const w = (s.box[2] - s.box[0]) * f.k, hh = (s.box[3] - s.box[1]) * f.k;
      if (w < textWidth(text, 5.4) + 2 || hh < 10) continue;
      out.push({ key: s.key, x: f2(f.ox + s.cx * f.k), y: f2(f.oy + s.cy * f.k), text: String(text) });
    }
    return out;
  });

  const region = (s: () => Present<Shape>): Element => {
    const key = untrack(s).key;
    const vb = (): View => geo().vb;
    const xs = (): number => clamp((s().cx - vb()[0]) / vb()[2], 0, 1);
    const target = (): { s: number; o: number } => { const v = valueOf(key); return { s: v == null ? -1 : shareOf(v), o: s().leaving ? 0 : 1 }; };
    const a = tween(target, ["s", "o"], () => waveOf(animateOf(props.animate), xs()), (to) => ({ s: to.s < 0 ? to.s : 0, o: 0 }),
      { index: () => Math.round(xs() * 20), key, leaving: () => !!s().leaving, onSettle: () => { if (untrack(s).leaving) pres.done(key); } });
    const fill = computed(() => (target().s < 0 ? noFill() : ramp()(Math.max(0, a().s))));
    fills.set(key, fill);
    onCleanup(() => { if (fills.get(key) === fill) fills.delete(key); });
    return h("path", {
      class: "m-choropleth-region", "data-id": key, d: attr(() => s().d),
      "class:m-choropleth-none": () => target().s < 0, "class:m-choropleth-dim": () => dimmed(key),
      "class:m-chart-active": () => active() === key, "class:m-choropleth-selected": () => selected() === key,
      opacity: attr(() => { const o = a().o; return o >= 0.999 ? null : f2(Math.max(0, o)); }),
      style: () => ({ fill: fill() }),
      onPointerEnter: () => { if (!dragged) show(key); },
      onClick: () => { if (!dragged) select(key); },
    });
  };
  // the hovered / keyboard region is drawn again on top, raised (stroke, slight scale)
  const raised = (): Element | null => {
    const k = active(), s = k ? byKey().get(k) : undefined;
    return s ? h("path", { class: "m-choropleth-raised", d: s.d, "aria-hidden": "true", style: () => ({ fill: fills.get(s.key)?.() ?? null }) }) : null;
  };

  const body = [
    h("defs", {}, h("pattern", { id: `${pid}-hatch`, patternUnits: "userSpaceOnUse", width: 5, height: 5, patternTransform: "rotate(45)" },
      h("rect", { class: "m-choropleth-hatch-bg", width: 5, height: 5 }), h("line", { class: "m-choropleth-hatch", x1: 0, y1: 0, x2: 0, y2: 5 }))),
    h("g", { class: () => `m-chart-plot m-choropleth-plot${zoomOn() ? " m-choropleth-zoomable" : ""}${userView() ? " m-choropleth-zoomed" : ""}`,
      onPointerLeave: () => { if (!pts.size) hide(); }, onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
    h("rect", { class: "m-choropleth-bg", width: () => size.width(), height: () => height() }),
    () => (geo().ready ? null : h("rect", { class: "m-choropleth-skeleton", x: 8, y: 8, rx: 12, width: () => Math.max(0, size.width() - 16), height: () => Math.max(0, height() - 16) })),
    h("g", { class: "m-choropleth-regions", transform: attr(() => { const f = fit(); return `translate(${f2(f.ox)},${f2(f.oy)}) scale(${Math.round(f.k * 1e4) / 1e4})`; }) },
      each<Present<Shape>>({ each: pres.items, key: (s) => s.key, children: (s) => region(s) }),
      raised),
    h("g", { class: "m-choropleth-labels", "aria-hidden": "true" },
      each<{ key: string; x: number; y: number; text: string }>({ each: labelList, key: (l) => l.key, children: (l) => h("text", {
        class: "m-choropleth-label", x: attr(() => l().x), y: attr(() => l().y), "text-anchor": "middle", "dominant-baseline": "central",
      }, attr(() => l().text)) }))),
  ];

  // colour legend: a gradient bar with min / max ticks (and the hovered value), or class swatches that filter
  const legendOn = (): boolean => read(props.legend) !== false;
  const hasNoData = computed(() => geo().shapes.some((s) => valueOf(s.key) == null));
  const classes = computed(() => {
    const th = thresholds(), f = fmt();
    if (!th) return [];
    const { lo, hi } = domain(), listed = Array.isArray(read(props.bins)), n = th.length + 1;
    return Array.from({ length: n }, (_, i) => {
      const a = i ? (th[i - 1] as number) : lo, b = i < n - 1 ? (th[i] as number) : hi;
      const label = listed ? (i === 0 ? `< ${String(f(b))}` : i === n - 1 ? `≥ ${String(f(a))}` : `${String(f(a))}–${String(f(b))}`) : `${String(f(a))}–${String(f(b))}`;
      return { key: String(i), i, label, color: ramp()(n > 1 ? i / (n - 1) : 1) };
    });
  });
  const pickClass = (i: number): void => { const next = new Set(picked.peek()); next.has(i) ? next.delete(i) : next.add(i); picked.set(next); };
  const marker = computed(() => { const k = active(), v = k ? valueOf(k) : null; return v == null || thresholds() ? null : shareOf(v); });
  const legend = h("div", { class: "m-choropleth-legend", hidden: () => !legendOn() || !geo().ready },
    () => (thresholds()
      ? h("div", { class: "m-choropleth-classes", role: "group", "aria-label": t`Legend` },
        each<{ key: string; i: number; label: string; color: string }>({ each: classes, key: (c) => c.key, children: (c) => h("button", {
          type: "button", class: "m-choropleth-class", "class:m-chart-off": () => picked().size > 0 && !picked().has(c().i), "aria-pressed": () => String(picked().has(c().i)),
          onClick: () => pickClass(c().i),
        }, h("span", { class: "m-choropleth-swatch", "aria-hidden": "true", style: () => ({ background: c().color }) }), h("span", {}, () => c().label)) }))
      : h("div", { class: "m-choropleth-scale" },
        h("div", { class: "m-choropleth-ramp", "aria-hidden": "true", style: () => { const r = ramp(); return { "background-image": `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map((s) => r(s)).join(", ")})` }; } },
          () => (marker() == null ? null : h("span", { class: "m-choropleth-marker", style: () => ({ "inset-inline-start": `${Math.round((marker() ?? 0) * 1000) / 10}%` }) }))),
        h("div", { class: "m-choropleth-ticks" },
          h("span", {}, () => String(fmt()(domain().lo))),
          () => (read(props.colorScale) === "diverging" || (Array.isArray(read(props.colorScale)) && read(props.colorScale)?.length === 3)
            ? h("span", {}, () => String(fmt()(num(read(props.mid)) ?? (domain().lo + domain().hi) / 2))) : null),
          h("span", {}, () => String(fmt()(domain().hi)))))),
    () => (hasNoData() ? h("span", { class: "m-choropleth-nodata-key" }, h("span", { class: "m-choropleth-swatch m-choropleth-swatch-none", "aria-hidden": "true", style: () => { const c = read(props.noData); return { background: c ? cssColor(c) : null }; } }), t`No data`) : null));

  const zoomBar = h("div", { class: "m-choropleth-zoom", role: "group", "aria-label": t`Zoom`, hidden: () => !zoomOn() || !geo().ready },
    h("button", { type: "button", class: "m-choropleth-zoom-in", "aria-label": t`Zoom in`, onClick: () => { instant = false; zoomBy(1.6); } }, "+"),
    h("button", { type: "button", class: "m-choropleth-zoom-out", "aria-label": t`Zoom out`, disabled: () => !userView() && !focusView(), onClick: () => { instant = false; zoomBy(1 / 1.6); } }, "−"),
    h("button", { type: "button", class: "m-choropleth-zoom-reset", "aria-label": t`Reset zoom`, hidden: () => !userView(), onClick: reset }, "⟲"));

  const frameProps = Object.create(props, {
    class: { value: computed(() => [read(props.class), read(props.legend) === "right" ? "m-choropleth-at-right" : null].filter(Boolean).join(" ") || null) },
    empty: { value: computed(() => read(props.empty) ?? t`No data`) },
  }) as ChoroplethMapProps<D>;
  return Frame<Shape>(frameProps, {
    kind: "choropleth", size: { ...size, height }, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => rowsOf(props.data).length === 0 || (geo().ready && (geo().shapes.length === 0 || cells().size === 0)), tip,
    extra: [zoomBar, legend],
    table: {
      caption: () => read(props.title), rows: () => geo().shapes,
      columns: () => [{ label: read(props.xLabel) ?? t`Region`, value: (s: Shape) => s.name },
        { label: read(props.yLabel) ?? t`Value`, value: (s: Shape) => { const v = valueOf(s.key); return v == null ? "" : fmt()(v); } }],
    },
  });
}
