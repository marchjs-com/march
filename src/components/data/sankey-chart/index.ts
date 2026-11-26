// SankeyChart: flows between nodes laid out in columns (march/charts). Folder: src/components/data/sankey-chart/.
// Columns by longest path, a few relaxation passes to reduce crossings, ribbons as cubic curves whose width is the
// value. Hover a node or a ribbon to light up its flow. Ribbons draw in from their source, nodes slide in, values morph.
import "./sankey-chart.css";
import { signal, computed, read, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, navIndex, each, tween, presence, animateOf, nextId, f1,
  type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp, type AnimateProp } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody } from "../../../charts/parts.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import type { Handler } from "../../../core/util.ts";

messages("tr", { "Source": "Kaynak", "Target": "Hedef", "Value": "Değer", "In": "Giren", "Out": "Çıkan", "{0} of {1}": "{1} içinden {0}" });

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** Point passed to `tooltip(point)` and `onSelect(point)`: a node or a link. */
export interface SankeyPoint<N, L> {
  /** What was hit: a node or a link. */
  kind: "node" | "link";
  /** The node id, or "source→target" for a link. */
  key: string;
  /** Node label, or "source → target" for a link. */
  label: string;
  /** A node's size (the larger of its incoming and outgoing totals) or a link's value. */
  value: number;
  /** A node's incoming total (a link: its value). */
  incoming: number;
  /** A node's outgoing total (a link: its value). */
  outgoing: number;
  /** A link's source label. */
  source?: string | undefined;
  /** A link's target label. */
  target?: string | undefined;
  /** The node row (`nodes`) or the link row. */
  datum: N | L | undefined;
}
export interface SankeyChartProps<L = unknown, N = unknown> extends ChartBaseProps {
  /** Links: rows like `{ source, target, value }` (an array, signal or function returning one). @tr Bağlantılar: `{ source, target, value }` gibi satırlar (dizi, sinyal ya da onu döndüren fonksiyon). */
  links?: DataProp<L>;
  /** Nodes (optional): rows with an id and a label; nodes only named in links are added. @tr Düğümler (isteğe bağlı): kimlik ve etiket taşıyan satırlar; yalnız bağlantılarda geçen düğümler de eklenir. */
  nodes?: DataProp<N>;
  /** A link's source node id: a key or getter (default "source"). @tr Bağlantının kaynak düğüm kimliği: anahtar ya da getter (varsayılan "source"). */
  source?: Field<L> | undefined;
  /** A link's target node id: a key or getter (default "target"). @tr Bağlantının hedef düğüm kimliği: anahtar ya da getter (varsayılan "target"). */
  target?: Field<L> | undefined;
  /** A link's value: a key or getter (default "value"). @tr Bağlantının değeri: anahtar ya da getter (varsayılan "value"). */
  value?: Field<L> | undefined;
  /** A node row's id: a key or getter (default "id"). @tr Düğüm satırının kimliği: anahtar ya da getter (varsayılan "id"). */
  nodeId?: Field<N> | undefined;
  /** A node row's label: a key or getter (default `label`, then `name`, then the id). @tr Düğüm satırının etiketi: anahtar ya da getter (varsayılan `label`, sonra `name`, sonra kimlik). */
  nodeLabel?: Field<N> | undefined;
  /** Column of the nodes: "justify" (default: sinks in the last column), "left", "right" or "center". @tr Düğümlerin sütunu: "justify" (varsayılan: son düğümler son sütunda), "left", "right" ya da "center". */
  align?: Opt<"justify" | "left" | "right" | "center">;
  /** Node width in px (default 14). @tr Düğüm genişliği, px (varsayılan 14). */
  nodeWidth?: Opt<number>;
  /** Vertical gap between the nodes of a column in px (default 14). @tr Bir sütundaki düğümler arası dikey boşluk, px (varsayılan 14). */
  nodePadding?: Opt<number>;
  /** Relaxation passes that move nodes toward their neighbours to reduce crossings (default 6; 0 keeps the input order). @tr Kesişmeleri azaltmak için düğümleri komşularına yaklaştıran geçiş sayısı (varsayılan 6; 0 giriş sırasını korur). */
  iterations?: Opt<number>;
  /** Link color: "gradient" (default, source to target), "source", "target" or "neutral". @tr Bağlantı rengi: "gradient" (varsayılan, kaynaktan hedefe), "source", "target" ya da "neutral". */
  linkColor?: Opt<"gradient" | "source" | "target" | "neutral">;
  /** Node names beside the nodes (default true): right of the nodes in the left half, left of the others. @tr Düğümlerin yanında adları (varsayılan true): sol yarıda sağında, diğerlerinde solunda. */
  labels?: Opt<boolean>;
  /** The node's formatted value after its name (default true). @tr Düğümün biçimlenmiş değeri adından sonra (varsayılan true). */
  valueLabels?: Opt<boolean>;
  /** Value format for labels, tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Etiket, araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** Headers of the data table: `{ source, target, value }` (defaults "Source", "Target", "Value", translated). @tr Veri tablosu başlıkları: `{ source, target, value }` (varsayılanlar "Source", "Target", "Value", çevrilir). */
  tableLabels?: Opt<{ source?: string; target?: string; value?: string }>;
  /** `true` (default), `false`, or `(point) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(point) => content`. */
  tooltip?: TooltipProp<SankeyPoint<N, L>>;
  /** Called with a node or link on click, or Enter / Space on the focused one. @tr Bir düğüme ya da bağlantıya tıklanınca veya odaktakinde Enter / Space'e basılınca çağrılır. */
  onSelect?: Handler<[p: SankeyPoint<N, L>]> | undefined;
  /** Change animation: `true` (default, a spring), `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or a function per mark. @tr Değişim animasyonu: `true` (varsayılan, yay), `false`, easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da işaret başına fonksiyon. */
  animate?: MaybeReactive<AnimateProp> | undefined;
}

interface SNode<N> { key: string; label: string; index: number; datum: N | undefined; col: number; x: number; y: number; h: number; value: number; vin: number; vout: number; ins: SLink<N>[]; outs: SLink<N>[]; order: number }
interface SLink<N> { key: string; s: SNode<N>; t: SNode<N>; value: number; datum: unknown; w: number; y0: number; y1: number; order: number }
interface NodeMark { key: string; label: string; index: number; x: number; y: number; h: number; o: number; value: number; order: number; right: boolean }
interface LinkMark { key: string; si: number; ti: number; x0: number; y0: number; x1: number; y1: number; w: number; t: number; order: number; value: number }

/** Sankey layout: columns, sizes and positions of nodes and links inside w × h (written onto them). */
function sankeyLayout<N>(nodes: SNode<N>[], links: SLink<N>[], o: { w: number; h: number; nodeWidth: number; pad: number; align: string; iterations: number }): void {
  const n = nodes.length;
  if (!n) return;
  // depth (longest path from a source) and height (to a sink); capped passes keep cycles finite
  const depth = new Map<SNode<N>, number>(nodes.map((x) => [x, 0])), height = new Map<SNode<N>, number>(nodes.map((x) => [x, 0]));
  for (let pass = 0; pass < n; pass++) {
    let moved = false;
    for (const l of links) {
      if (depth.get(l.t)! < depth.get(l.s)! + 1) { depth.set(l.t, depth.get(l.s)! + 1); moved = true; }
      if (height.get(l.s)! < height.get(l.t)! + 1) { height.set(l.s, height.get(l.t)! + 1); moved = true; }
    }
    if (!moved) break;
  }
  const maxD = Math.max(0, ...depth.values());
  for (const x of nodes) {
    const d = depth.get(x)!;
    x.col = o.align === "left" ? d : o.align === "right" ? maxD - height.get(x)! : o.align === "center"
      ? (x.ins.length ? d : x.outs.length ? Math.max(0, Math.min(...x.outs.map((l) => depth.get(l.t)!)) - 1) : 0)
      : (x.outs.length ? d : maxD);
    x.vin = x.ins.reduce((a, l) => a + l.value, 0); x.vout = x.outs.reduce((a, l) => a + l.value, 0);
    x.value = Math.max(x.vin, x.vout);
  }
  const cols: SNode<N>[][] = [];
  for (const x of nodes) (cols[x.col] ??= []).push(x);
  const columns = cols.filter(Boolean);
  const last = Math.max(1, columns.length - 1), step = (o.w - o.nodeWidth) / last;
  const ky = Math.min(...columns.map((c) => (o.h - (c.length - 1) * o.pad) / (c.reduce((a, x) => a + x.value, 0) || 1)));
  columns.forEach((c, i) => {
    let y = 0;
    for (const x of c) { x.x = columns.length === 1 ? (o.w - o.nodeWidth) / 2 : i * step; x.h = Math.max(1, x.value * ky); x.y = y; y += x.h + o.pad; }
    const free = o.h - (y - o.pad); for (const x of c) x.y += free / 2; // centered before the passes
  });
  for (const l of links) l.w = l.value * ky;
  const center = (x: SNode<N>): number => x.y + x.h / 2;
  const settle = (c: SNode<N>[]): void => {
    c.sort((a, b) => a.y - b.y);
    let y = 0;
    for (const x of c) { if (x.y < y) x.y = y; y = x.y + x.h + o.pad; }
    y = o.h;
    for (let i = c.length - 1; i >= 0; i--) { const x = c[i]!; if (x.y + x.h > y) x.y = y - x.h; y = x.y - o.pad; }
    if (c[0] && c[0].y < 0) { let yy = 0; for (const x of c) { x.y = Math.max(x.y, yy); yy = x.y + x.h + o.pad; } }
  };
  const toward = (c: SNode<N>[], ends: (x: SNode<N>) => SLink<N>[], other: (l: SLink<N>) => SNode<N>, alpha: number): void => {
    for (const x of c) {
      const ls = ends(x), sum = ls.reduce((a, l) => a + l.value, 0);
      if (!sum) continue;
      const want = ls.reduce((a, l) => a + center(other(l)) * l.value, 0) / sum;
      x.y += (want - center(x)) * alpha;
    }
    settle(c);
  };
  for (let it = 0; it < o.iterations; it++) {
    const alpha = Math.pow(0.99, it);
    for (let i = 1; i < columns.length; i++) toward(columns[i]!, (x) => x.ins, (l) => l.s, alpha);
    for (let i = columns.length - 2; i >= 0; i--) toward(columns[i]!, (x) => x.outs, (l) => l.t, alpha);
  }
  for (const c of columns) settle(c);
  // ribbons leave and enter each node in the order of their other end (fewer crossings at the node)
  for (const x of nodes) {
    x.outs.sort((a, b) => center(a.t) - center(b.t));
    x.ins.sort((a, b) => center(a.s) - center(b.s));
    let y = x.y + (x.h - x.outs.reduce((a, l) => a + l.w, 0)) / 2;
    for (const l of x.outs) { l.y0 = y + l.w / 2; y += l.w; }
    y = x.y + (x.h - x.ins.reduce((a, l) => a + l.w, 0)) / 2;
    for (const l of x.ins) { l.y1 = y + l.w / 2; y += l.w; }
  }
}

const ribbon = (m: LinkMark): string => {
  const xm = (m.x0 + m.x1) / 2;
  return `M${f1(m.x0)},${f1(m.y0)}C${f1(xm)},${f1(m.y0)} ${f1(xm)},${f1(m.y1)} ${f1(m.x1)},${f1(m.y1)}`;
};

/** Sankey diagram: nodes in columns, links as ribbons whose width is the value. See docs.md for props. */
export function SankeyChart<L, N = unknown>(props: SankeyChartProps<L, N>): Element {
  const size = useSize(props, 640, 320);
  const hidden = signal(new Set<string>()), active = signal(-1), lit = signal<{ nodes: Set<string>; links: Set<string> } | null>(null);
  const tip = tooltipState();
  const how = (): AnimateProp => animateOf(props.animate as AnimateProp);
  const uid = nextId("m-sankey");
  let seq = 0;
  let svg: Element | null = null;

  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));
  const nodeRows = computed(() => rowsOf(props.nodes));
  const linkRows = computed(() => rowsOf(props.links));
  // every node (rows first, then ids only named by links), in input order; labels and colors by that order
  const allNodes = computed(() => {
    const id = accessor<N>(props.nodeId ?? "id"), lab = props.nodeLabel != null ? accessor<N>(props.nodeLabel) : null;
    const out = new Map<string, { key: string; label: string; index: number; datum: N | undefined }>();
    nodeRows().forEach((d, i) => {
      const k = String(id(d, i) ?? i), r = d as { label?: unknown; name?: unknown } | null;
      if (!out.has(k)) out.set(k, { key: k, label: String((lab ? lab(d, i) : r?.label ?? r?.name) ?? k), index: out.size, datum: d });
    });
    const s = accessor<L>(props.source ?? "source"), tg = accessor<L>(props.target ?? "target");
    linkRows().forEach((d, i) => { for (const v of [s(d, i), tg(d, i)]) { const k = String(v ?? ""); if (k && !out.has(k)) out.set(k, { key: k, label: k, index: out.size, datum: undefined }); } });
    return [...out.values()];
  });
  const graph = computed(() => {
    const w = size.width(), hh = size.height(), off = hidden();
    const nw = Math.max(1, num(read(props.nodeWidth)) ?? 14), pad = Math.max(0, num(read(props.nodePadding)) ?? 14);
    const nodes = new Map<string, SNode<N>>();
    for (const x of allNodes()) if (!off.has(x.key)) nodes.set(x.key, { ...x, col: 0, x: 0, y: 0, h: 0, value: 0, vin: 0, vout: 0, ins: [], outs: [], order: 0 });
    const s = accessor<L>(props.source ?? "source"), tg = accessor<L>(props.target ?? "target"), v = accessor<L>(props.value ?? "value");
    const links: SLink<N>[] = [], seen = new Map<string, number>();
    linkRows().forEach((d, i) => {
      const a = nodes.get(String(s(d, i) ?? "")), b = nodes.get(String(tg(d, i) ?? "")), val = num(v(d, i)) ?? 0;
      if (!a || !b || a === b || val <= 0) return;
      let key = `${a.key}→${b.key}`;
      const n = seen.get(key) ?? 0; seen.set(key, n + 1); if (n) key += `#${n}`;
      const l: SLink<N> = { key, s: a, t: b, value: val, datum: d, w: 0, y0: 0, y1: 0, order: 0 };
      links.push(l); a.outs.push(l); b.ins.push(l);
    });
    const used = [...nodes.values()].filter((x) => x.ins.length || x.outs.length);
    sankeyLayout(used, links, { w, h: hh, nodeWidth: nw, pad, align: read(props.align) ?? "justify", iterations: Math.max(0, Math.round(num(read(props.iterations)) ?? 6)) });
    used.sort((a, b) => a.col - b.col || a.y - b.y).forEach((x, i) => { x.order = i; });
    links.sort((a, b) => a.s.order - b.s.order || a.y0 - b.y0).forEach((l, i) => { l.order = i; });
    return { nodes: used, links, nw, w };
  });

  const nodeMarks = computed((): NodeMark[] => { const g = graph(); return g.nodes.map((x) => ({ key: x.key, label: x.label, index: x.index, x: x.x, y: x.y, h: x.h, o: 1, value: x.value, order: x.order, right: x.x + g.nw / 2 < g.w / 2 })); });
  const linkMarks = computed((): LinkMark[] => { const g = graph(); return g.links.map((l) => ({ key: l.key, si: l.s.index, ti: l.t.index, x0: l.s.x + g.nw, y0: l.y0, x1: l.t.x, y1: l.y1, w: l.w, t: 1, order: l.order, value: l.value })); });
  const nodePres = presence(nodeMarks, (m) => m.key, how), linkPres = presence(linkMarks, (m) => m.key, how);

  // keyboard order: nodes (column by column, top down), then links
  const count = (): number => graph().nodes.length + graph().links.length;
  const flowOf = (k: number): { nodes: Set<string>; links: Set<string> } | null => {
    const g = graph(), nodes = new Set<string>(), links = new Set<string>();
    if (k < g.nodes.length) {
      const start = g.nodes[k]!;
      const walk = (x: SNode<N>, dir: "ins" | "outs"): void => {
        for (const l of x[dir]) { if (links.has(l.key)) continue; links.add(l.key); const y = dir === "outs" ? l.t : l.s; nodes.add(y.key); walk(y, dir); }
      };
      nodes.add(start.key); walk(start, "outs"); walk(start, "ins");
    } else {
      const l = g.links[k - g.nodes.length];
      if (!l) return null;
      links.add(l.key); nodes.add(l.s.key); nodes.add(l.t.key);
    }
    return { nodes, links };
  };
  const pointAt = (k: number): SankeyPoint<N, L> | undefined => {
    const g = graph();
    if (k < g.nodes.length) { const x = g.nodes[k]; return x && { kind: "node", key: x.key, label: x.label, value: x.value, incoming: x.vin, outgoing: x.vout, datum: x.datum }; }
    const l = g.links[k - g.nodes.length];
    return l && { kind: "link", key: l.key, label: `${l.s.label} → ${l.t.label}`, value: l.value, incoming: l.value, outgoing: l.value, source: l.s.label, target: l.t.label, datum: l.datum as L };
  };
  const show = (k: number): void => {
    active.set(k); lit.set(flowOf(k));
    const opt = read(props.tooltip), p = pointAt(k), g = graph();
    if (!p || opt === false) return void tip.at.set(null);
    let x: number, y: number, rows;
    if (p.kind === "node") {
      const n = g.nodes[k]!; x = n.x + g.nw / 2; y = n.y + n.h / 2;
      rows = [n.vin ? { label: t`In`, value: fmt()(n.vin), index: n.index } : null, n.vout ? { label: t`Out`, value: fmt()(n.vout), index: n.index } : null].filter((r) => r != null);
    } else {
      const l = g.links[k - g.nodes.length]!; x = (l.s.x + g.nw + l.t.x) / 2; y = (l.y0 + l.y1) / 2;
      rows = [{ label: applyPipe("percent", l.s.vout ? l.value / l.s.vout : 0, 1), value: fmt()(l.value), index: l.s.index }];
    }
    const content = typeof opt === "function" ? () => opt(p) : () => tipBody(p.label, rows, props.colors);
    showTip(tip, svg, size.width(), x, y, content);
  };
  const hide = (): void => { active.set(-1); lit.set(null); tip.at.set(null); };
  const select = (k = active.peek()): void => { const p = pointAt(k); if (p) props.onSelect?.(p); };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(); }
    if (e.key === "Escape") return hide();
    const k = navIndex(e.key, active.peek(), 0, count() - 1);
    if (k == null || !count()) return;
    e.preventDefault();
    show(k);
  };
  const nodeAt = (key: string): number => graph().nodes.findIndex((x) => x.key === key);
  const linkAt = (key: string): number => { const i = graph().links.findIndex((l) => l.key === key); return i < 0 ? -1 : graph().nodes.length + i; };
  const activeKey = (): string | undefined => { const k = active(), g = graph(); return k < 0 ? undefined : k < g.nodes.length ? g.nodes[k]?.key : g.links[k - g.nodes.length]?.key; };
  const mode = (): string => read(props.linkColor) ?? "gradient";
  const style = (i: number): Record<string, string> | undefined => colorStyle(props.colors, i);

  const linkLayer = h("g", { class: "m-sankey-links" },
    each<LinkMark & { leaving?: boolean }>({ each: linkPres.items, key: (m) => m.key, children: (m) => {
      const key = untrack(m).key, gid = `${uid}-${++seq}`;
      const a = tween(() => { const v = m(); return v.leaving ? { ...v, w: 0 } : v; }, ["x0", "y0", "x1", "y1", "w", "t"], how, (to) => ({ ...to, t: 0 }), {
        index: () => m().order, key, leaving: () => !!m().leaving, onSettle: () => { if (untrack(m).leaving) linkPres.done(key); },
      });
      const end = (): number => (mode() === "target" ? m().ti : m().si);
      return h("g", {
        class: () => `m-sankey-flow ${mode() === "neutral" ? "" : seriesClass(end())}`,
        "class:m-sankey-on": () => !!lit()?.links.has(key), "class:m-chart-active": () => activeKey() === key,
        style: () => (mode() === "neutral" ? undefined : style(end())),
      },
      () => (mode() === "gradient" ? h("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: attr(() => f1(a().x0)), x2: attr(() => f1(a().x1)), y1: 0, y2: 0 },
        h("stop", { offset: "0", class: () => `m-sankey-stop ${seriesClass(m().si)}`, style: () => style(m().si) }),
        h("stop", { offset: "1", class: () => `m-sankey-stop ${seriesClass(m().ti)}`, style: () => style(m().ti) })) : null),
      h("path", {
        class: () => ["m-sankey-link", mode() === "gradient" && "m-sankey-gradient", mode() === "neutral" && "m-sankey-neutral"].filter(Boolean).join(" "),
        d: attr(() => ribbon(a())), "stroke-width": attr(() => f1(Math.max(0.5, a().w))), stroke: () => (mode() === "gradient" ? `url(#${gid})` : null),
        pathLength: 1, "stroke-dasharray": attr(() => { const p = a().t; return p >= 0.999 ? null : `${Math.max(0, p).toFixed(3)} 2`; }),
        onPointerEnter: () => { const k = linkAt(key); if (k >= 0) show(k); },
        onClick: () => select(linkAt(key)),
      }));
    } }));

  const nodeLayer = h("g", { class: "m-sankey-nodes" },
    each<NodeMark & { leaving?: boolean }>({ each: nodePres.items, key: (m) => m.key, children: (m) => {
      const key = untrack(m).key;
      const a = tween(() => { const v = m(); return v.leaving ? { ...v, y: v.y + v.h / 2, h: 0, o: 0 } : v; }, ["x", "y", "h", "o"], how,
        (to) => ({ ...to, x: to.x + (to.right ? -16 : 16), o: 0 }), { index: () => m().order, key, leaving: () => !!m().leaving, onSettle: () => { if (untrack(m).leaving) nodePres.done(key); } });
      const nw = (): number => graph().nw;
      return h("g", {
        class: () => `m-sankey-node ${seriesClass(m().index)}`, style: () => style(m().index),
        "class:m-sankey-on": () => !!lit()?.nodes.has(key), "class:m-chart-active": () => activeKey() === key,
        opacity: attr(() => Math.round(Math.max(0, Math.min(1, a().o)) * 100) / 100),
        onPointerEnter: () => { const k = nodeAt(key); if (k >= 0) show(k); },
        onClick: () => select(nodeAt(key)),
      },
      h("rect", { x: attr(() => f1(a().x)), y: attr(() => f1(a().y)), width: nw, height: attr(() => f1(Math.max(0, a().h))), rx: 2 }),
      () => (read(props.labels) === false ? null : h("text", {
        class: "m-sankey-label", "dominant-baseline": "middle",
        x: attr(() => f1(m().right ? a().x + nw() + 6 : a().x - 6)), y: attr(() => f1(a().y + a().h / 2)), "text-anchor": () => (m().right ? "start" : "end"),
      }, () => m().label, () => (read(props.valueLabels) === false ? null : h("tspan", { class: "m-sankey-value", dx: 6 }, () => String(fmt()(m().value)))))));
    } }));

  const body = [h("g", { class: () => `m-chart-plot m-sankey-plot${lit() ? " m-sankey-focus" : ""}`, onPointerLeave: hide }, linkLayer, nodeLayer)];

  return Frame<SLink<N>>(props, {
    kind: "sankey", size, body, onKeyDown, svgRef: (el) => { svg = el; },
    empty: () => !linkRows().length, tip,
    legend: { items: () => (read(props.legend) ? allNodes().map((x) => ({ key: x.key, label: x.label, index: x.index })) : []), hidden },
    table: {
      caption: () => read(props.title), rows: () => graph().links,
      columns: () => { const l = read(props.tableLabels); return [
        { label: l?.source ?? t`Source`, value: (r: SLink<N>) => r.s.label },
        { label: l?.target ?? t`Target`, value: (r: SLink<N>) => r.t.label },
        { label: l?.value ?? t`Value`, value: (r: SLink<N>) => fmt()(r.value) }]; },
    },
  });
}
