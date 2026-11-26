// NetworkGraph: nodes and links laid out by a force simulation, a circle or a grid (march/charts). Folder:
// src/components/data/network-graph/; the simulation is sim.ts; shared chart parts (frame, legend, tooltip, data table,
// motion) are in src/charts/.
// The simulation steps on the engine clock (onFrame: global speed, pause and reduced motion reach it) and stops when it
// cools. New nodes pop in from the middle, kept nodes keep their place and the layout warms up again, leaving nodes
// shrink away. Drag a node to move and pin it, drag the background to pan, wheel / pinch to zoom.
import "./network-graph.css";
import { signal, computed, read, untrack, effect, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { rowsOf, accessor, formatter, num, seriesClass, colorStyle, useSize, attr, localPoint, each, f1, nextId, tween, presence, animateOf, motionOf,
  type AnimateProp, type MaybeReactive, type DataProp, type Field, type FormatSpec, type ChartBaseProps, type TooltipProp } from "../../../charts/util.ts";
import { Frame, tooltipState, showTip, tipBody, type LegendItem } from "../../../charts/parts.ts";
import { clamp, type Handler } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";
import { simulation, placeTargets, type Sim, type SimNode, type SimLink } from "./sim.ts";

type Opt<T> = MaybeReactive<T | null | undefined> | undefined;

/** A node as passed to `tooltip(node)` and `onSelect(node)`. */
export interface NetworkPoint<N> { id: string; label: string; group: string; value: number; degree: number; neighbors: string[]; datum: N | undefined; index: number }

export interface NetworkGraphProps<N = unknown, L = unknown> extends ChartBaseProps {
  /** Nodes: an array (or signal / function returning one); without it the nodes come from the links. @tr Düğümler: bir dizi (ya da onu döndüren sinyal / fonksiyon); verilmezse bağlantılardan çıkarılır. */
  nodes?: DataProp<N>;
  /** Links between nodes: rows with a source and a target id. @tr Düğümler arası bağlantılar: kaynak ve hedef kimliği olan satırlar. */
  links?: DataProp<L>;
  /** Node id: a key or getter (default "id"). @tr Düğüm kimliği: anahtar ya da getter (varsayılan "id"). */
  id?: Field<N> | undefined;
  /** Node label: a key or getter (default "label", else the id). @tr Düğüm etiketi: anahtar ya da getter (varsayılan "label", yoksa kimlik). */
  label?: Field<N> | undefined;
  /** Node group (color and legend): a key or getter (default "group"). @tr Düğüm grubu (renk ve gösterge): anahtar ya da getter (varsayılan "group"). */
  group?: Field<N> | undefined;
  /** Node value (its size): a key or getter (default "value"; without values the number of links). @tr Düğüm değeri (boyutu): anahtar ya da getter (varsayılan "value"; değer yoksa bağlantı sayısı). */
  value?: Field<N> | undefined;
  /** Link source id: a key or getter (default "source"). @tr Bağlantının kaynak kimliği: anahtar ya da getter (varsayılan "source"). */
  source?: Field<L> | undefined;
  /** Link target id: a key or getter (default "target"). @tr Bağlantının hedef kimliği: anahtar ya da getter (varsayılan "target"). */
  target?: Field<L> | undefined;
  /** Link weight (thickness and pull): a key or getter (default "value"). @tr Bağlantı ağırlığı (kalınlık ve çekim): anahtar ya da getter (varsayılan "value"). */
  weight?: Field<L> | undefined;
  /** "force" (default, simulated), "circle" or "grid"; nodes glide between layouts. @tr "force" (varsayılan, benzetim), "circle" ya da "grid"; düğümler yerleşimler arasında kayar. */
  layout?: Opt<"force" | "circle" | "grid">;
  /** Repulsion between nodes (negative pushes apart; default -160). @tr Düğümler arası itme (negatif iter; varsayılan -160). */
  charge?: Opt<number>;
  /** Rest length of a link in px (default 60). @tr Bir bağlantının durağan uzunluğu, px (varsayılan 60). */
  linkDistance?: Opt<number>;
  /** Stiffness of the links, 0..2 (default 1). @tr Bağlantıların sertliği, 0..2 (varsayılan 1). */
  linkStrength?: Opt<number>;
  /** Pull towards the middle, 0..1 (default 0.06). @tr Ortaya çekim, 0..1 (varsayılan 0.06). */
  center?: Opt<number>;
  /** Nodes do not overlap: `true` (default, 3 px apart), `false`, or the gap in px. @tr Düğümler üst üste binmez: `true` (varsayılan, 3 px ara), `false` ya da px cinsinden boşluk. */
  collide?: Opt<boolean | number>;
  /** Smallest and largest node radius in px (default [5, 16]). @tr En küçük ve en büyük düğüm yarıçapı, px (varsayılan [5, 16]). */
  nodeSize?: Opt<readonly [number, number]>;
  /** Node labels: `true` (default up to 60 nodes), `false`, or "hover" (the hovered node and its neighbours). @tr Düğüm etiketleri: `true` (60 düğüme kadar varsayılan), `false` ya da "hover" (üzerindeki düğüm ve komşuları). */
  labels?: Opt<boolean | "hover">;
  /** Arrows at the target end of links. @tr Bağlantıların hedef ucunda oklar. */
  directed?: Opt<boolean>;
  /** Wheel / pinch zoom and background drag to pan (default true); double click or "Reset view" fits the graph again. @tr Tekerlek / iki parmakla yakınlaşma ve arka planı sürükleyerek kaydırma (varsayılan true); çift tıklama ya da "Reset view" grafiği yeniden sığdırır. */
  zoom?: Opt<boolean>;
  /** Nodes can be dragged; a dragged node stays pinned (double click it to release). Default true. @tr Düğümler sürüklenebilir; sürüklenen düğüm sabitlenir (bırakmak için çift tıklayın). Varsayılan true. */
  draggable?: Opt<boolean>;
  /** Legend names of the groups: `{ group: "Name" }`. @tr Grupların göstergedeki adları: `{ group: "Ad" }`. */
  groupLabels?: Opt<Readonly<Record<string, string>>>;
  /** Value format for tooltip and table: a pipe name, `[pipe, ...args]` or a function (default "number"). @tr Araç ipucu ve tablo için değer biçimi: pipe adı, `[pipe, ...args]` ya da fonksiyon (varsayılan "number"). */
  format?: Opt<FormatSpec>;
  /** `true` (default), `false`, or `(node) => content` for custom tooltip content. @tr `true` (varsayılan), `false` ya da özel araç ipucu içeriği için `(node) => content`. */
  tooltip?: TooltipProp<NetworkPoint<N>>;
  /** Called with the node on click, or Enter / Space on the focused one. @tr Tıklanınca ya da odaktaki düğümde Enter / Space'e basılınca düğümle çağrılır. */
  onSelect?: Handler<[p: NetworkPoint<N>]> | undefined;
  /** Change animation: `true` (spring, default), `false` (the layout is computed at once), an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. @tr Değişim animasyonu: `true` (yay, varsayılan), `false` (yerleşim hemen hesaplanır), easing adı, `{ duration, easing, stagger, delay, enter, update, exit }` ya da `(ctx) => …`. */
  animate?: AnimateProp | (() => AnimateProp);
}

interface GNode<N> { key: string; id: string; label: string; group: string; gi: number; value: number; degree: number; r: number; datum: N | undefined; index: number; leaving?: boolean }
interface GLink { key: string; s: string; t: string; w: number; leaving?: boolean }
interface View { x: number; y: number; k: number }

/** Force-directed (or circle / grid) network graph with zoom, pan, node drag, keyboard and legend groups. */
export function NetworkGraph<N, L = unknown>(props: NetworkGraphProps<N, L>): Element {
  const size = useSize(props, 640, 360);
  const hidden = signal(new Set<string>()), active = signal<string | null>(null), hover = signal<string | null>(null);
  const view = signal<View>({ x: 0, y: 0, k: 1 }), version = signal(0), pinned = signal(new Set<string>());
  const tip = tooltipState(), uidv = nextId("m-net");
  const how = (): AnimateProp => animateOf(props.animate);
  const moving = (): boolean => !!untrack(() => motionOf(how(), { index: 0, key: "layout", phase: "update" })) && !reducedMotion();
  let svg: Element | null = null, mounted = false, touched = false;

  // ---- data
  const linkRows = computed(() => rowsOf(props.links));
  const rawLinks = computed(() => {
    const S = accessor<L>(props.source ?? "source"), T = accessor<L>(props.target ?? "target"), W = accessor<L>(props.weight ?? "value");
    const seen = new Map<string, number>();
    return linkRows().flatMap((d, i) => {
      const s = S(d, i), tt = T(d, i);
      if (s == null || tt == null) return [];
      const a = String(typeof s === "object" ? (s as { id?: unknown }).id : s), b = String(typeof tt === "object" ? (tt as { id?: unknown }).id : tt);
      const k = `${a}→${b}`, n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      return [{ key: n ? `${k}#${n}` : k, s: a, t: b, w: num(W(d, i)) ?? 1 }];
    });
  });
  const groups = computed(() => {
    const list: string[] = [];
    for (const n of baseNodes()) if (!list.includes(n.group)) list.push(n.group);
    return list;
  });
  const baseNodes = computed((): Omit<GNode<N>, "gi" | "r" | "degree">[] => {
    const given = props.nodes != null ? rowsOf(props.nodes) : null;
    const I = accessor<N>(props.id ?? "id"), Lb = accessor<N>(props.label ?? "label"), G = accessor<N>(props.group ?? "group"), V = accessor<N>(props.value ?? "value");
    if (!given) {
      const ids: string[] = [];
      for (const l of rawLinks()) { if (!ids.includes(l.s)) ids.push(l.s); if (!ids.includes(l.t)) ids.push(l.t); }
      return ids.map((id, index) => ({ key: id, id, label: id, group: "", value: NaN, datum: undefined, index }));
    }
    return given.map((d, index) => {
      const id = String(I(d, index) ?? index), g = G(d, index), v = num(V(d, index));
      return { key: id, id, label: String(Lb(d, index) ?? id), group: g == null ? "" : String(g), value: v ?? NaN, datum: d, index };
    });
  });
  const nodes = computed((): GNode<N>[] => {
    const hid = hidden(), list = baseNodes().filter((n) => !hid.has(n.group)), ids = new Set(list.map((n) => n.id)), deg = new Map<string, number>();
    for (const l of rawLinks()) if (ids.has(l.s) && ids.has(l.t)) { deg.set(l.s, (deg.get(l.s) ?? 0) + 1); deg.set(l.t, (deg.get(l.t) ?? 0) + 1); }
    const val = (n: { id: string; value: number }): number => (isNaN(n.value) ? deg.get(n.id) ?? 0 : n.value);
    let lo = Infinity, hi = -Infinity;
    for (const n of list) { const v = val(n); if (v < lo) lo = v; if (v > hi) hi = v; }
    const [r0, r1] = read(props.nodeSize) ?? [5, 16], gs = groups();
    return list.map((n) => {
      const v = val(n), f = hi > lo ? Math.sqrt((v - lo) / (hi - lo)) : 0.4;
      return { ...n, value: v, degree: deg.get(n.id) ?? 0, gi: gs.indexOf(n.group), r: r0 + (r1 - r0) * f };
    });
  });
  const byId = computed(() => new Map(nodes().map((n) => [n.id, n])));
  const links = computed((): GLink[] => { const m = byId(); return rawLinks().filter((l) => m.has(l.s) && m.has(l.t)); });
  const neighbors = computed(() => {
    const m = new Map<string, Set<string>>();
    for (const l of links()) { (m.get(l.s) ?? m.set(l.s, new Set()).get(l.s)!).add(l.t); (m.get(l.t) ?? m.set(l.t, new Set()).get(l.t)!).add(l.s); }
    return m;
  });
  const fmt = computed(() => formatter(read<FormatSpec | null | undefined>(props.format)));

  // ---- simulation: positions live in `pos` (kept across data changes); `version` ticks the drawing
  const pos = new Map<string, SimNode>();
  let sim: Sim | null = null, stop: (() => void) | null = null, acc = 0, spawned = 0;
  const layout = computed(() => read(props.layout) ?? "force");
  const run = (): void => {
    if (!sim) return;
    if (!moving()) {
      stop?.(); stop = null;
      sim.settle();
      version.set(version.peek() + 1);
      fit(false);
      return;
    }
    if (stop) return;
    acc = 0;
    stop = onFrame((_t, dt) => {
      acc += dt;
      let live = true;
      for (let i = 0; i < 3 && acc >= 14; i++, acc -= 16) live = sim!.tick();
      acc = Math.min(acc, 32);
      version.set(version.peek() + 1);
      if (!live) { stop?.(); stop = null; fit(true); }
    });
  };
  effect(() => {
    const list = nodes(), ls = links(), mode = layout();
    const p = { mode, charge: num(read(props.charge)) ?? -160, distance: num(read(props.linkDistance)) ?? 60, strength: num(read(props.linkStrength)),
      center: num(read(props.center)) ?? 0.06, collide: ((c) => (c === false ? null : typeof c === "number" ? c : 3))(read(props.collide)) };
    const w = size.width(), hh = size.height();
    untrack(() => {
      const fresh = !sim;
      const simNodes = list.map((n) => {
        let s = pos.get(n.id);
        if (!s) {
          // new nodes start near the middle (a small spiral, so they burst outwards)
          const k = spawned++, a = k * 2.399963, r = 3 * Math.sqrt(k + 0.5);
          pos.set(n.id, (s = { id: n.id, x: r * Math.cos(a), y: r * Math.sin(a), vx: 0, vy: 0, r: n.r }));
        }
        s.r = n.r;
        return s;
      });
      const simLinks: SimLink[] = ls.map((l) => ({ s: pos.get(l.s)!, t: pos.get(l.t)!, w: l.w }));
      if (mode !== "force") placeTargets(simNodes, mode, w / view.peek().k, hh / view.peek().k);
      const prev = sim?.alpha ?? 1;
      sim = simulation(simNodes, simLinks, p);
      sim.alpha = fresh ? 1 : Math.max(prev, 0.6);
      run();
    });
  });
  onCleanup(() => { stop?.(); stop = null; });
  const at = (id: string): SimNode | undefined => { version(); return pos.get(id); };

  // ---- view: (w/2 + x, h/2 + y) + k · p; fitted when the layout comes to rest, unless the user moved it
  let glide: { cancel(): void } | null = null;
  const setView = (to: View, animated: boolean): void => {
    glide?.cancel(); glide = null;
    const m = animated && moving() ? untrack(() => motionOf(how(), { index: 0, key: "view", phase: "update" })) : null;
    if (!m) return void view.set(to);
    const from = view.peek();
    glide = animateValue(0, 1, { easing: m.easing === "spring" ? "out" : m.easing, duration: m.duration ?? 520, onUpdate: (q: number) =>
      view.set({ x: from.x + (to.x - from.x) * q, y: from.y + (to.y - from.y) * q, k: from.k + (to.k - from.k) * q }) });
  };
  onCleanup(() => glide?.cancel());
  const fitView = (): View => {
    const list = sim?.nodes ?? [];
    if (!list.length) return { x: 0, y: 0, k: 1 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const d of list) { x0 = Math.min(x0, d.x - d.r); y0 = Math.min(y0, d.y - d.r); x1 = Math.max(x1, d.x + d.r); y1 = Math.max(y1, d.y + d.r + 14); }
    const w = size.width(), hh = size.height(), pad = 24;
    const k = clamp(Math.min((w - pad * 2) / Math.max(1, x1 - x0), (hh - pad * 2) / Math.max(1, y1 - y0)), 0.15, 1);
    return { x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k, k };
  };
  function fit(animated: boolean): void { if (!touched) setView(fitView(), animated); }
  const resetView = (): void => { touched = false; setView(fitView(), true); };

  const toScreen = (d: SimNode): [number, number] => { const v = view(); return [size.width() / 2 + v.x + v.k * d.x, size.height() / 2 + v.y + v.k * d.y]; };
  const toGraph = (sx: number, sy: number): [number, number] => { const v = view.peek(); return [(sx - size.width() / 2 - v.x) / v.k, (sy - size.height() / 2 - v.y) / v.k]; };

  // ---- presence: leaving nodes and links shrink / fade before they go
  const npres = presence(nodes, (n) => n.key, how);
  const lpres = presence(links, (l) => l.key, how);
  const near = computed((): Set<string> | null => {
    const f = hover() ?? active();
    if (!f) return null;
    return new Set([f, ...(neighbors().get(f) ?? [])]);
  });
  const labelMode = computed(() => { const l = read(props.labels); return l ?? (nodes().length <= 60 ? true : "hover"); });

  // ---- interaction
  const pointOf = (id: string): NetworkPoint<N> | undefined => {
    const n = byId().get(id);
    return n && { id: n.id, label: n.label, group: n.group, value: n.value, degree: n.degree, neighbors: [...(neighbors().get(n.id) ?? [])], datum: n.datum, index: n.index };
  };
  const showTipFor = (id: string | null): void => {
    const opt = read(props.tooltip), p = id ? pointOf(id) : undefined, d = id ? pos.get(id) : undefined;
    if (!p || !d || opt === false) return void tip.at.set(null);
    const g = p.group ? String(read(props.groupLabels)?.[p.group] ?? p.group) : null, n = byId().get(id!)!;
    const content = typeof opt === "function" ? () => (opt as (p: NetworkPoint<N>) => unknown)(p)
      : () => tipBody(p.label, [...(g ? [{ label: t`Group`, value: g, index: n.gi }] : []), { label: t`Value`, value: fmt()(p.value), index: n.gi }, { label: t`Links`, value: p.degree, index: n.gi }], props.colors);
    const [x, y] = untrack(() => toScreen(d));
    showTip(tip, svg, size.width(), x, y - n.r * view.peek().k, content);
  };
  const focus = (id: string | null): void => { active.set(id); showTipFor(id); };
  const select = (id: string | null): void => { const p = id ? pointOf(id) : undefined; if (p) props.onSelect?.(p); };
  const zoomOn = (): boolean => read(props.zoom) ?? true;
  const pt = (e: { clientX?: number; clientY?: number }): [number, number] => localPoint(svg, e, size.width());

  // pointers: one on the background pans, two pinch; one on a node drags it
  const ptrs = new Map<number, [number, number]>();
  let pan: { x: number; y: number; v: View } | null = null, pinch: { d: number; v: View; c: [number, number] } | null = null;
  let dragNode: { id: string; moved: boolean; x: number; y: number; fixed: boolean } | null = null, panned = false;
  const zoomAt = (sx: number, sy: number, k: number): void => {
    const v = view.peek(), nk = clamp(k, 0.15, 6), cx = sx - size.width() / 2, cy = sy - size.height() / 2;
    touched = true;
    glide?.cancel();
    view.set({ k: nk, x: cx - (cx - v.x) * (nk / v.k), y: cy - (cy - v.y) * (nk / v.k) });
  };
  const bg = {
    onPointerDown: (e: PointerEvent) => {
      if (!zoomOn()) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      ptrs.set(e.pointerId, pt(e));
      panned = false;
      const ps = [...ptrs.values()];
      if (ps.length === 2) {
        const [a, b] = ps as [[number, number], [number, number]];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, v: view.peek(), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; pan = null;
      } else { const p = ps[0] as [number, number]; pan = { x: p[0], y: p[1], v: view.peek() }; }
    },
    onPointerMove: (e: PointerEvent) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, pt(e));
      const ps = [...ptrs.values()];
      if (pinch && ps.length >= 2) {
        const [a, b] = ps as [[number, number], [number, number]], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        view.set(pinch.v); zoomAt(pinch.c[0], pinch.c[1], pinch.v.k * (d / pinch.d));
      } else if (pan) {
        const p = ps[0] as [number, number];
        if (Math.abs(p[0] - pan.x) + Math.abs(p[1] - pan.y) > 2) touched = panned = true;
        view.set({ ...pan.v, x: pan.v.x + p[0] - pan.x, y: pan.v.y + p[1] - pan.y });
      }
    },
    onPointerUp: (e: PointerEvent) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) pan = null; },
    onPointerCancel: (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch = null; pan = null; },
    onDblClick: resetView,
    onClick: () => { if (!panned) focus(null); },
  };
  const onWheel = (e: WheelEvent): void => {
    if (!zoomOn()) return;
    e.preventDefault();
    const [x, y] = pt(e);
    zoomAt(x, y, view.peek().k * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)));
  };
  const nodeDown = (id: string) => (e: PointerEvent): void => {
    e.stopPropagation();
    const fixed = read(props.draggable) === false;
    if (!fixed) (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = pt(e);
    dragNode = { id, moved: false, x, y, fixed };
  };
  const nodeMove = (e: PointerEvent): void => {
    const d = dragNode;
    if (!d || d.fixed) return;
    const [x, y] = pt(e);
    if (!d.moved && Math.abs(x - d.x) + Math.abs(y - d.y) < 3) return;
    const s = pos.get(d.id);
    if (!s || !sim) return;
    if (!d.moved) { d.moved = true; sim.target = 0.25; sim.alpha = Math.max(sim.alpha, 0.3); if (!pinned.peek().has(d.id)) pinned.set(new Set([...pinned.peek(), d.id])); }
    const [gx, gy] = toGraph(x, y);
    s.fx = gx; s.fy = gy;
    if (layout.peek() !== "force") { s.x = gx; s.y = gy; }
    hover.set(d.id);
    if (moving()) run(); else { s.x = gx; s.y = gy; version.set(version.peek() + 1); }
  };
  const nodeUp = (): void => {
    const d = dragNode;
    dragNode = null;
    if (!d) return;
    if (sim) sim.target = 0;
    if (!d.moved) { focus(d.id); select(d.id); }
  };
  const unpin = (id: string) => (e: Event): void => {
    e.stopPropagation();
    const s = pos.get(id);
    if (!s || s.fx == null) return;
    s.fx = s.fy = null;
    const next = new Set(pinned.peek()); next.delete(id); pinned.set(next);
    if (sim) { sim.alpha = Math.max(sim.alpha, 0.4); run(); }
  };

  // keyboard: arrows go to the nearest node in that direction
  const DIRS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
  const onKeyDown = (e: KeyboardEvent): void => {
    if (isActivateKey(e)) { e.preventDefault(); return select(active.peek()); }
    if (e.key === "Escape") { if (active.peek()) return focus(null); return resetView(); }
    if (zoomOn() && (e.key === "+" || e.key === "=" || e.key === "-")) { e.preventDefault(); return zoomAt(size.width() / 2, size.height() / 2, view.peek().k * (e.key === "-" ? 1 / 1.25 : 1.25)); }
    if (e.key === "0") { e.preventDefault(); return resetView(); }
    const dir = DIRS[e.key], list = nodes();
    if (!list.length) return;
    if (e.key === "Home" || e.key === "End") { e.preventDefault(); return focus((e.key === "Home" ? list[0] : list[list.length - 1])!.id); }
    if (!dir) return;
    e.preventDefault();
    const cur = active.peek(), from = cur ? pos.get(cur) : undefined;
    if (!from) {
      let best = list[0]!.id, bd = Infinity;
      for (const n of list) { const s = pos.get(n.id); const d = s ? Math.hypot(s.x, s.y) : Infinity; if (d < bd) { bd = d; best = n.id; } }
      return focus(best);
    }
    let best: string | null = null, score = Infinity;
    for (const n of list) {
      if (n.id === cur) continue;
      const s = pos.get(n.id);
      if (!s) continue;
      const dx = s.x - from.x, dy = s.y - from.y, along = dx * dir[0] + dy * dir[1], across = Math.abs(dx * dir[1] - dy * dir[0]);
      if (along <= 0.5) continue;
      const sc = along + across * 2;
      if (sc < score) { score = sc; best = n.id; }
    }
    if (best) focus(best);
  };
  effect(() => { version(); view(); if (untrack(active)) untrack(() => showTipFor(active.peek())); });

  // ---- drawing
  const nodeEl = (n: () => GNode<N>, i: () => number): Element => {
    const key = n().key, late = mounted;
    const pop = tween(() => (n().leaving ? { s: 0 } : { s: 1 }), ["s"], how, () => ({ s: 0 }),
      { index: () => (late ? 0 : i()), key, leaving: () => !!n().leaving, onSettle: () => { if (untrack(n).leaving) { npres.done(key); if (!byId.peek().has(key)) pos.delete(key); } } });
    const r = tween(() => ({ r: n().r }), ["r"], how);
    const isNear = (): boolean => near()?.has(key) ?? false;
    const showLabel = (): boolean => { const m = labelMode(); return m === true || (m === "hover" && isNear()); };
    return h("g", {
      class: () => `m-network-node ${seriesClass(n().gi)}`, "class:m-network-near": isNear, "class:m-chart-active": () => active() === key,
      "class:m-network-pinned": () => pinned().has(key), "class:m-network-leaving": () => !!n().leaving, "data-id": key,
      style: () => colorStyle(props.colors, n().gi),
      transform: attr(() => { const d = at(key), s = pop().s; return d ? `translate(${f1(d.x)},${f1(d.y)}) scale(${Math.round(s * 1000) / 1000})` : "scale(0)"; }),
      opacity: attr(() => Math.round(Math.min(1, pop().s * 1.4) * 100) / 100),
      onPointerDown: nodeDown(key), onPointerMove: nodeMove, onPointerUp: nodeUp, onPointerCancel: nodeUp,
      onPointerEnter: () => { if (!dragNode) hover.set(key); }, onPointerLeave: () => { if (!dragNode && hover.peek() === key) hover.set(null); },
      onDblClick: unpin(key),
    },
    h("circle", { class: "m-network-ring", r: attr(() => f1(r().r + 4)) }),
    h("circle", { class: "m-network-dot", r: attr(() => f1(r().r)) }),
    () => (showLabel() ? h("text", { class: "m-network-label", y: attr(() => f1(r().r + 12)), "text-anchor": "middle" }, () => n().label) : null));
  };
  const linkEl = (l: () => GLink, i: () => number): Element => {
    const key = l().key, late = mounted;
    const fade = tween(() => (l().leaving ? { o: 0 } : { o: 1 }), ["o"], how, () => ({ o: 0 }),
      { index: () => (late ? 0 : i()), key, leaving: () => !!l().leaving, onSettle: () => { if (untrack(l).leaving) lpres.done(key); } });
    const ends = attr(() => {
      const a = at(l().s), b = at(l().t);
      if (!a || !b) return null;
      let x2 = b.x, y2 = b.y;
      if (read(props.directed)) { const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, cut = Math.min(d / 2, b.r + 3); x2 -= (dx / d) * cut; y2 -= (dy / d) * cut; }
      return [f1(a.x), f1(a.y), f1(x2), f1(y2)];
    });
    const w = l().w;
    return h("line", {
      class: "m-network-link", "class:m-network-near": () => { const f = hover() ?? active(); return !!f && (l().s === f || l().t === f); },
      "data-key": key, x1: attr(() => ends()?.[0] ?? 0), y1: attr(() => ends()?.[1] ?? 0), x2: attr(() => ends()?.[2] ?? 0), y2: attr(() => ends()?.[3] ?? 0),
      "stroke-width": f1(Math.max(1, Math.min(5, 0.8 + Math.sqrt(Math.max(0, w)) * 0.7))), opacity: attr(() => Math.round(fade().o * 100) / 100),
      "marker-end": () => (read(props.directed) ? `url(#${uidv}-arrow)` : null),
    });
  };

  const body = [
    h("defs", {}, h("marker", { id: `${uidv}-arrow`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse", class: "m-network-arrow" },
      h("path", { d: "M0,0L10,5L0,10Z" }))),
    h("g", { class: "m-network-stage", onWheel },
    h("rect", { class: "m-network-bg", x: 0, y: 0, width: () => size.width(), height: () => size.height(), ...bg }),
    h("g", { class: "m-chart-plot m-network-plot", "class:m-network-focus": () => !!near(),
      transform: attr(() => { const v = view(); return `translate(${f1(size.width() / 2 + v.x)},${f1(size.height() / 2 + v.y)}) scale(${Math.round(v.k * 1000) / 1000})`; }) },
    h("g", { class: "m-network-links" }, each<GLink>({ each: lpres.items, key: (l) => l.key, children: linkEl })),
    h("g", { class: "m-network-nodes" }, each<GNode<N>>({ each: npres.items, key: (n) => n.key, children: nodeEl })))),
  ];
  const legendItems = (): readonly LegendItem[] => {
    const l = read(props.legend), gs = groups(), names = read(props.groupLabels);
    if (l === false || (l == null && gs.length < 2)) return [];
    return gs.map((g, index) => ({ key: g, label: names?.[g] ?? (g || t`Other`), index }));
  };
  const el = Frame<GNode<N>>(props, {
    kind: "network", size, body, onKeyDown, svgRef: (e) => { svg = e; },
    empty: () => baseNodes().length === 0, tip,
    legend: { items: legendItems, hidden },
    table: {
      caption: () => read(props.title), rows: nodes,
      columns: () => [{ label: t`Node`, value: (d: GNode<N>) => d.label }, { label: t`Group`, value: (d: GNode<N>) => (d.group ? read(props.groupLabels)?.[d.group] ?? d.group : "") },
        { label: t`Value`, value: (d: GNode<N>) => untrack(fmt)(d.value) }, { label: t`Links`, value: (d: GNode<N>) => d.degree }],
    },
    extra: [h("button", { type: "button", class: "m-chart-reset m-network-reset", hidden: () => { view(); return !touched; }, onClick: resetView }, () => t`Reset view`)],
  });
  mounted = true;
  return el;
}
