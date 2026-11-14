// FlowCanvas (hadi-march/ui): a node editor on an endless canvas. Pan (drag the background with the hand tool, the
// middle button, Space or one finger; wheel), zoom (Ctrl/⌘ + wheel, pinch, + / −), snap to the grid, nodes with
// ports and form fields, bezier edges drawn in on the motion engine, values flowing along the edges as moving dots,
// box and multi selection, copy / paste (ClipboardManager), undo (UndoManager), minimap, layered auto layout,
// groups, a context menu and full keyboard use. Model and JSON schema: ./model.ts. Logical coordinates: x grows
// toward the inline end, so the whole drawing mirrors in RTL.
import "./flow-canvas.css";
import { signal, computed, effect, untrack, batch, onCleanup, getOwner, runWithOwner } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/for.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, uid, icon, glyph, clamp, lerp, listen, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { IconButton } from "../../../ui/button.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { TextInput, NumberInput, Select, Toggle } from "../../../forms/inputs.ts";
import { Field } from "../../../forms/field.ts";
import { ContextMenu } from "../../overlays/context-menu/index.ts";
import type { MenuItem } from "../../../ui/menu.ts";
// ClipboardManager and UndoManager load when first used (the component barrel stays free of side effects)
const clipboardManager = () => import("../../../managers/clipboard/index.ts");
const undoManager = () => import("../../../managers/undo/index.ts");
import { animate } from "../../../motion/animate.ts";
import { animateValue, onFrame, nextFrame } from "../../../motion/engine/index.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { minus } from "../../../icons/glyphs/minus.ts";
import { target as fitIcon } from "../../../icons/glyphs/target.ts";
import { layers as layoutIcon } from "../../../icons/glyphs/layers.ts";
import { alertCircle } from "../../../icons/glyphs/alertCircle.ts";
import { check } from "../../../icons/glyphs/check.ts";
import {
  NODE_W, NODE_HEAD, PORT_ROW, endOf, portPoint, edgePath, layeredLayout, boundsOf,
  type FlowStore, type NodeState, type FlowEdge, type FlowGroup, type FlowField, type FlowView,
} from "./model.ts";
import { Minimap } from "./minimap.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { isRtl } from "../../../core/util.ts";
export * from "./model.ts";
export { Minimap } from "./minimap.ts";

export interface FlowCanvasProps {
  flow: FlowStore;
  /** Grid step in world units for snapping and the dotted background; 0 turns snapping off. Default 16. */
  snap?: MaybeFn<number | undefined>;
  /** Show the minimap. Default true. */
  minimap?: MaybeFn<boolean | undefined>;
  /** Drag on the empty canvas: "select" draws a selection box (pan with Space / middle button), "pan" moves the view. Default "select". */
  tool?: MaybeFn<"select" | "pan" | undefined>;
  /** Show the field controls inside nodes. Default true. */
  fields?: MaybeFn<boolean | undefined>;
  /** Accessible name. */
  label?: MaybeFn<string | undefined>;
  /** The zoom bar: true (default), false, or the parts to keep: "zoom" (− % +), "fit", "layout". */
  controls?: MaybeFn<boolean | readonly ("zoom" | "fit" | "layout")[] | undefined>;
  /** The context menu: true (default), false, or a function that gets the built-in items and returns the ones to show. */
  menu?: boolean | ((items: MenuItem[], target: Element) => readonly MenuItem[]) | undefined;
  /** Draw-in of edges, moving dots, glow / shake / pop of nodes, the view and layout tweens (default true). */
  motion?: MaybeFn<boolean | undefined>;
  /**
   * Own texts; each falls back to the built-in one. Names: `editor` and `node` (role descriptions), `menu`, `minimap`,
   * the zoom bar (`zoomIn`, `zoomOut`, `fit`, `layout`), the menu items (`copy`, `cut`, `duplicate`, `group`,
   * `ungroup`, `delete`, `paste`, `selectAll`, `add(type)`), ports and edges (`input(port)`, `output(port)`,
   * `connection(from, to)`, `values(count)`) and what is announced (`connected`, `cannotConnect`, `choosePort`,
   * `arranged(n)`, `copied(n)`, `pasted(n)`, `deleted(n)`, `selected(n)`).
   */
  labels?: {
    editor?: string; node?: string; menu?: string; minimap?: string;
    zoomIn?: string; zoomOut?: string; fit?: string; layout?: string;
    copy?: string; cut?: string; duplicate?: string; group?: string; ungroup?: string; delete?: string; paste?: string; selectAll?: string;
    add?: ((type: string) => string) | undefined;
    input?: ((port: string) => string) | undefined; output?: ((port: string) => string) | undefined;
    connection?: ((from: string, to: string) => string) | undefined; values?: ((count: number) => string) | undefined;
    connected?: string; cannotConnect?: string; choosePort?: string;
    arranged?: ((count: number) => string) | undefined; copied?: ((count: number) => string) | undefined; pasted?: ((count: number) => string) | undefined;
    deleted?: ((count: number) => string) | undefined; selected?: ((count: number) => string) | undefined;
  } | undefined;
  class?: ClassProp;
}

const ZOOM_MIN = 0.25, ZOOM_MAX = 2.5;
const editable = (el: EventTarget | null): boolean => !!(el as Element | null)?.closest?.("input, select, textarea, [contenteditable=true], .hm-flow-fields");
const isMod = (e: KeyboardEvent | MouseEvent): boolean => e.ctrlKey || e.metaKey;

/** `<FlowCanvas flow={createFlow({ types, doc })} snap={16} minimap />` */
export function FlowCanvas(props: FlowCanvasProps): Element {
  const flow = props.flow;
  const vp = flow.viewport;
  const grid = (): number => val(props.snap) ?? 16;
  const sel = flow.selection;
  const draft = signal<{ from: { x: number; y: number }; to: { x: number; y: number }; ref: string; side: "in" | "out" } | null>(null);
  const marquee = signal<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const live = signal("");
  const say = (msg: string): void => { live.set(""); queueMicrotask(() => live.set(msg)); };
  const L = (): NonNullable<FlowCanvasProps["labels"]> => props.labels ?? {};
  const still = (): boolean => val(props.motion) === false || reducedMotion();
  const part = (k: "zoom" | "fit" | "layout"): boolean => { const c = val(props.controls); return c == null || c === true || (c !== false && c.includes(k)); };
  let root!: HTMLElement;
  let space = false;
  /** The user moved the view (no more automatic framing). */
  let touched = false;
  const paths = new Map<string, SVGPathElement>();

  // ---------------------------------------------------------------- coordinates
  const rtl = (): boolean => isRtl(root);
  /** Client point → logical screen point inside the canvas (x from the inline start). */
  const local = (cx0: number, cy0: number): { x: number; y: number; r: DOMRect } => {
    const r = root.getBoundingClientRect();
    return { x: rtl() ? r.right - cx0 : cx0 - r.left, y: cy0 - r.top, r };
  };
  const toWorld = (cx0: number, cy0: number): { x: number; y: number } => {
    const p = local(cx0, cy0), v = vp.peek();
    return { x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom };
  };
  const snapTo = (v: number): number => { const g = grid(); return g > 0 ? Math.round(v / g) * g : v; };
  const zoomAround = (lx: number, ly: number, z: number): void => {
    const v = vp.peek(), nz = clamp(z, ZOOM_MIN, ZOOM_MAX);
    vp.set({ zoom: nz, x: lx - ((lx - v.x) * nz) / v.zoom, y: ly - ((ly - v.y) * nz) / v.zoom });
  };
  const tweenView = (to: { x: number; y: number; zoom: number }): void => {
    const from = vp.peek();
    if (still()) { vp.set(to); return; }
    animateValue([from.x, from.y, from.zoom], [to.x, to.y, to.zoom], { duration: 420, easing: "out", onUpdate: ((v: number[]) => { vp.set({ x: v[0]!, y: v[1]!, zoom: v[2]! }); }) as never });
  };
  const size = (): { w: number; h: number } => ({ w: root?.clientWidth || 800, h: root?.clientHeight || 480 });

  const view: FlowView = {
    toWorld: (x, y) => {
      const r = root.getBoundingClientRect();
      return x < r.left || x > r.right || y < r.top || y > r.bottom ? null : toWorld(x, y);
    },
    center: () => { const s = size(), v = vp.peek(); return { x: (s.w / 2 - v.x) / v.zoom, y: (s.h / 2 - v.y) / v.zoom }; },
    zoomBy: (f) => { const s = size(); const v = vp.peek(); const nz = clamp(v.zoom * f, ZOOM_MIN, ZOOM_MAX); tweenView({ zoom: nz, x: s.w / 2 - ((s.w / 2 - v.x) * nz) / v.zoom, y: s.h / 2 - ((s.h / 2 - v.y) * nz) / v.zoom }); },
    fit: (anim = true) => {
      const b = untrack(() => boundsOf(flow));
      if (!b) return;
      const s = size(), pad = 48;
      const z = clamp(Math.min((s.w - pad * 2) / b.w, (s.h - pad * 2) / b.h), ZOOM_MIN, 1.25);
      const to = { zoom: z, x: (s.w - b.w * z) / 2 - b.x * z, y: (s.h - b.h * z) / 2 - b.y * z };
      if (anim) tweenView(to); else vp.set(to);
    },
    focusNode: (id) => {
      const n = flow.node(id);
      if (!n) return;
      const s = size(), v = vp.peek();
      tweenView({ zoom: v.zoom, x: s.w / 2 - (n.x.peek() + NODE_W / 2) * v.zoom, y: s.h / 2 - (n.y.peek() + n.h.peek() / 2) * v.zoom });
      root.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    },
    layout: () => {
      const b = untrack(() => boundsOf(flow));
      const to = layeredLayout(flow, { origin: { x: snapTo(b?.x ?? 0), y: snapTo(b?.y ?? 0) } });
      const from = new Map(untrack(flow.nodes).map((n) => [n.id, { x: n.x.peek(), y: n.y.peek() }]));
      const commit = (): void => {
        batch(() => { for (const [id, p] of from) { const n = flow.node(id); n?.x.set(p.x); n?.y.set(p.y); } });
        flow.change(t`Auto layout`, () => { for (const [id, p] of to) { const n = flow.node(id); n?.x.set(p.x); n?.y.set(p.y); } });
        view.fit();
        say(L().arranged?.(to.size) ?? t`Arranged ${to.size} nodes`);
      };
      if (still()) { commit(); return; }
      animateValue(0, 1, {
        duration: 620, easing: "inOut",
        onUpdate: (k: number) => batch(() => { for (const [id, p] of to) { const a = from.get(id)!, n = flow.node(id); n?.x.set(lerp(a.x, p.x, k)); n?.y.set(lerp(a.y, p.y, k)); } }),
      }).finished.then(commit);
    },
  };
  flow.view.set(view);
  onCleanup(() => { if (flow.view.peek() === view) flow.view.set(null); });

  // ---------------------------------------------------------------- actions
  const selected = (): string[] => [...sel.peek()];
  const selectedNodes = (): string[] => {
    const s = sel.peek(), out = new Set<string>();
    for (const id of s) if (flow.node(id)) out.add(id);
    for (const g of flow.groups.peek()) if (s.has(g.id)) for (const n of g.nodes) out.add(n);
    return [...out];
  };
  const copy = (): void => {
    if (!sel.peek().size) return;
    const text = flow.copy();
    buffer = text;
    void clipboardManager().then((m) => m.clipboard().copy(text));
    say(L().copied?.(selectedNodes().length) ?? t`Copied ${selectedNodes().length} nodes`);
  };
  let buffer = "";
  const paste = (text = buffer, at?: { x: number; y: number }): void => {
    const ids = flow.paste(text, at);
    if (ids.length) say(L().pasted?.(ids.length) ?? t`Pasted ${ids.length} nodes`);
  };
  const remove = (): void => {
    const n = sel.peek().size;
    if (!n) return;
    flow.remove(sel.peek());
    say(L().deleted?.(n) ?? t`Deleted ${n} items`);
  };
  const duplicate = (): void => { if (sel.peek().size) paste(flow.copy()); };
  const selectAll = (): void => { sel.set(new Set(flow.nodes.peek().map((n) => n.id))); };
  const toggleSel = (id: string, additive: boolean): void => {
    const s = new Set(additive ? sel.peek() : []);
    if (additive && s.has(id)) s.delete(id); else s.add(id);
    sel.set(s);
  };

  // ---------------------------------------------------------------- dragging nodes / groups
  function dragNodes(e: PointerEvent, ids: string[]): void {
    const start = toWorld(e.clientX, e.clientY);
    const lead = flow.node(ids[0]!);
    const origin = new Map(ids.map((id) => { const n = flow.node(id)!; return [id, { x: n.x.peek(), y: n.y.peek() }]; }));
    const restore = (): void => batch(() => { for (const [id, p] of origin) { const n = flow.node(id)!; n.x.set(p.x); n.y.set(p.y); } });
    pointerDrag(e, {
      threshold: 3,
      onMove: (q) => {
        const p = toWorld(q.clientX, q.clientY);
        let dx = p.x - start.x, dy = p.y - start.y;
        // snap the lead node; the others keep their offsets
        if (lead) { const o = origin.get(lead.id)!; dx = snapTo(o.x + dx) - o.x; dy = snapTo(o.y + dy) - o.y; }
        batch(() => { for (const [id, o] of origin) { const n = flow.node(id)!; n.x.set(o.x + dx); n.y.set(o.y + dy); } });
      },
      onEnd: (_q, cancelled) => {
        if (!lead) return;
        const o = origin.get(lead.id)!, dx = lead.x.peek() - o.x, dy = lead.y.peek() - o.y;
        restore();
        if (!cancelled) flow.moveBy(ids, dx, dy); // one undo step; Escape puts the nodes back
      },
    });
  }

  // ---------------------------------------------------------------- pan, marquee, pinch
  // (two pointers at once for pinch: the one multi-pointer gesture, so it keeps its own pointer map)
  const pointers = new Map<number, { x: number; y: number }>();
  function onBackgroundDown(e: PointerEvent): void {
    if (e.button === 2) return;
    root.focus({ preventScroll: true });
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    root.setPointerCapture?.(e.pointerId);
    const pan = e.button === 1 || space || e.pointerType === "touch" || val(props.tool) === "pan";
    const v0 = vp.peek();
    const p0 = local(e.clientX, e.clientY);
    let pinch0: { d: number; zoom: number } | null = null;
    let moved = false;
    const off = listen(root, {
      pointermove: (ev: PointerEvent) => {
        if (!pointers.has(ev.pointerId)) return;
        pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          pinch0 ??= { d, zoom: vp.peek().zoom };
          const m = local((a.x + b.x) / 2, (a.y + b.y) / 2);
          zoomAround(m.x, m.y, (pinch0.zoom * d) / pinch0.d);
          return;
        }
        const p = local(ev.clientX, ev.clientY);
        if (!moved && Math.hypot(p.x - p0.x, p.y - p0.y) < 3) return;
        moved = true;
        if (pan) vp.set({ ...v0, x: v0.x + p.x - p0.x, y: v0.y + p.y - p0.y });
        else marquee.set({ x0: p0.x, y0: p0.y, x1: p.x, y1: p.y });
      },
      pointerup: (ev: PointerEvent) => {
        pointers.delete(ev.pointerId);
        if (pointers.size) return;
        off();
        const m = marquee.peek();
        if (m) {
          const v = vp.peek();
          const x0 = (Math.min(m.x0, m.x1) - v.x) / v.zoom, x1 = (Math.max(m.x0, m.x1) - v.x) / v.zoom;
          const y0 = (Math.min(m.y0, m.y1) - v.y) / v.zoom, y1 = (Math.max(m.y0, m.y1) - v.y) / v.zoom;
          const hit = flow.nodes.peek().filter((n) => n.x.peek() < x1 && n.x.peek() + NODE_W > x0 && n.y.peek() < y1 && n.y.peek() + n.h.peek() > y0).map((n) => n.id);
          sel.set(new Set([...(ev.shiftKey || isMod(ev) ? sel.peek() : []), ...hit]));
          marquee.set(null);
          if (hit.length) say(L().selected?.(hit.length) ?? t`${hit.length} selected`);
        } else if (!moved && !ev.shiftKey) sel.set(new Set());
      },
      pointercancel: (ev: PointerEvent) => { pointers.delete(ev.pointerId); off(); marquee.set(null); },
    });
  }

  // ---------------------------------------------------------------- connecting
  function startConnect(e: PointerEvent, ref: string, side: "in" | "out"): void {
    e.stopPropagation();
    const a = untrack(() => portPoint(flow, ref, side));
    if (!a) return;
    draft.set({ from: a, to: a, ref, side });
    const drop = (x: number, y: number): void => {
      draft.set(null);
      const hit = globalThis.document.elementFromPoint?.(x, y)?.closest?.<HTMLElement>(".hm-flow-port");
      if (hit?.dataset.ref === ref) portActivate(ref, side); // a click: connect by choosing the other port next
      else if (hit && hit.dataset.side !== side) { pending.set(null); finishConnect(ref, side, hit.dataset.ref!); }
    };
    pointerDrag(e, {
      threshold: 0,
      onMove: (q) => draft.set({ from: a, to: toWorld(q.clientX, q.clientY), ref, side }),
      onEnd: (q, cancelled) => (cancelled ? draft.set(null) : drop(q.clientX, q.clientY)),
      onClick: (u) => drop(u.clientX, u.clientY),
    });
  }
  const pending = signal<{ ref: string; side: "in" | "out" } | null>(null);
  function finishConnect(ref: string, side: "in" | "out", other: string): void {
    const [from, to] = side === "out" ? [ref, other] : [other, ref];
    const id = flow.connect(from, to);
    say(id ? L().connected ?? t`Connected` : L().cannotConnect ?? t`These ports cannot be connected`);
  }
  /** Keyboard / click connecting: Enter on one port, then Enter on another. */
  function portActivate(ref: string, side: "in" | "out"): void {
    const p = pending.peek();
    if (!p) { pending.set({ ref, side }); say(L().choosePort ?? t`Choose a port to connect to, Escape to cancel`); return; }
    pending.set(null);
    if (p.side !== side) finishConnect(p.ref, p.side, ref);
  }

  // ---------------------------------------------------------------- keyboard
  function onKey(e: KeyboardEvent): void {
    if (editable(e.target)) return;
    const k = e.key.toLowerCase();
    if (e.key === " ") { space = true; root.classList.add("is-panning"); if (e.target === root) e.preventDefault(); return; }
    if (e.key === "Escape") { if (pending.peek()) pending.set(null); else sel.set(new Set()); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); remove(); return; }
    if (isMod(e)) {
      if (k === "a") { e.preventDefault(); selectAll(); }
      else if (k === "c") { e.preventDefault(); copy(); }
      else if (k === "x") { e.preventDefault(); copy(); remove(); }
      else if (k === "d") { e.preventDefault(); duplicate(); }
      else if (k === "z") { e.preventDefault(); void undoManager().then((m) => (e.shiftKey ? m.undoStack().redo() : m.undoStack().undo())); }
      else if (k === "y") { e.preventDefault(); void undoManager().then((m) => m.undoStack().redo()); }
      else if (k === "g") { e.preventDefault(); if (e.shiftKey) flow.ungroup(sel.peek()); else flow.group(selectedNodes()); }
      return;
    }
    if (e.key === "+" || e.key === "=") { view.zoomBy(1.2); return; }
    if (e.key === "-") { view.zoomBy(1 / 1.2); return; }
    if (e.key === "0") { view.fit(); return; }
    if (k === "l" && e.shiftKey) { view.layout(); return; }
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = arrows[e.key];
    if (!d) return;
    e.preventDefault();
    const dir = rtl() && d[0] ? -1 : 1;
    const ids = selectedNodes();
    if (ids.length) { const g = (grid() || 8) * (e.shiftKey ? 4 : 1); flow.moveBy(ids, d[0] * g * dir, d[1] * g); }
    else { const v = vp.peek(); vp.set({ ...v, x: v.x - d[0] * 48 * dir, y: v.y - d[1] * 48 }); }
  }

  // ---------------------------------------------------------------- pulses: dots travel along the edge
  const dotsLayer = new Map<string, SVGGElement>();
  onCleanup(flow.onPulse((edgeId, ms) => {
    const path = paths.get(edgeId), g = dotsLayer.get(edgeId);
    const pill = root?.querySelector<HTMLElement>(`[data-edge-pill="${CSS.escape(edgeId)}"]`);
    if (pill && !still()) animate(pill, [{ scale: "1" }, { scale: "1.4" }, { scale: "1" }], { duration: 360, easing: "out" });
    if (!path || !g || still() || typeof path.getTotalLength !== "function") return;
    const len = path.getTotalLength();
    const doc = globalThis.document;
    // a comet: a bright head and two fading followers
    const dots = [0, 1, 2].map((i) => {
      const c = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("r", String(5 - i * 1.4));
      c.setAttribute("class", `hm-flow-dot hm-flow-dot-${i}`);
      g.appendChild(c);
      return c;
    });
    let tt = 0;
    const stop = onFrame((_, dt) => {
      tt += dt;
      const k = Math.min(1, tt / Math.max(120, ms));
      dots.forEach((c, i) => {
        const at = Math.max(0, k - i * 0.05);
        const e = at < 0.5 ? 2 * at * at : 1 - (-2 * at + 2) ** 2 / 2;
        const p = path.getPointAtLength(e * len);
        c.setAttribute("cx", String(p.x));
        c.setAttribute("cy", String(p.y));
      });
      if (k >= 1) { stop(); dots.forEach((c) => c.remove()); }
    }, { phase: "write" });
  }));

  // ---------------------------------------------------------------- pieces
  const statusOf = (id: string) => (): string => flow.status().get(id) ?? "idle";

  function Port(n: NodeState, port: { id: string; label?: MaybeFn<string> }, side: "in" | "out"): Element {
    const ref = `${n.id}.${port.id}`;
    const connected = (): boolean => flow.edges().some((e) => (side === "in" ? e.to : e.from) === ref);
    return h("span", { class: cx("hm-flow-portrow", `is-${side}`) },
      h("button", {
        type: "button", class: () => cx("hm-flow-port", connected() && "is-connected", pending()?.ref === ref && "is-pending"),
        "data-ref": ref, "data-side": side,
        "aria-label": () => { const name = val(port.label) ?? port.id; return side === "in" ? L().input?.(name) ?? t`Input ${name}` : L().output?.(name) ?? t`Output ${name}`; },
        "aria-pressed": () => String(pending()?.ref === ref),
        onPointerdown: (e: PointerEvent) => startConnect(e, ref, side),
        onKeydown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); portActivate(ref, side); } },
      }),
      port.label != null && h("span", { class: "hm-flow-portlabel" }, () => val(port.label)));
  }

  function control(n: NodeState, f: FlowField, id: string): unknown {
    const get = (): unknown => n.data()[f.key];
    const set = (v: unknown): void => {
      if (untrack(() => n.data()[f.key]) === v) return;
      flow.change(t`Edit ${val(f.label)}`, () => n.data.set({ ...n.data.peek(), [f.key]: v }));
    };
    const common = { id, get value() { return get(); }, onChange: set };
    if (f.kind === "number") return h(NumberInput, { ...common, min: f.min ?? null, max: f.max ?? null } as never);
    if (f.kind === "select") return h(Select, { ...common, options: f.options } as never);
    if (f.kind === "toggle") return h(Toggle, common as never);
    return h(TextInput, common as never);
  }

  function NodeView(n: NodeState): Element {
    const ty = flow.typeOf(n.type);
    const ins = ty?.inputs ?? [], outs = ty?.outputs ?? [];
    const rows = Math.max(ins.length, outs.length);
    const status = statusOf(n.id);
    const isSel = (): boolean => sel().has(n.id);
    const title = (): string => n.label() || val(ty?.label) || n.type;
    let el!: HTMLElement, glow!: HTMLElement;
    const node = h("div", {
      ref: (x: HTMLElement) => { el = x; },
      class: () => cx("hm-flow-node", isSel() && "is-selected", `is-${status()}`),
      "data-node": n.id, "data-hm-color": colorAttr(ty?.color), tabindex: "0", role: "group",
      "aria-roledescription": () => L().node ?? t`node`,
      "aria-label": () => `${title()}${status() !== "idle" ? ` · ${statusText(status())}` : ""}`,
      "aria-selected": () => String(isSel()),
      style: () => ({ "inset-inline-start": `${n.x()}px`, "inset-block-start": `${n.y()}px` }),
      onPointerdown: (e: PointerEvent) => {
        if (e.button !== 0 || editable(e.target) || (e.target as Element).closest(".hm-flow-port")) return;
        e.stopPropagation();
        if (e.shiftKey || isMod(e)) { toggleSel(n.id, true); return; }
        if (!sel.peek().has(n.id)) sel.set(new Set([n.id]));
        dragNodes(e, selectedNodes());
      },
      onKeydown: (e: KeyboardEvent) => { if (e.target === el && e.key === "Enter") { e.preventDefault(); toggleSel(n.id, e.shiftKey); } },
    },
      h("span", { class: "hm-flow-glow", "aria-hidden": "true", ref: (x: HTMLElement) => { glow = x; } }),
      h("div", { class: "hm-flow-head" },
        h("span", { class: "hm-flow-icon", "aria-hidden": "true" }, icon(ty?.icon)),
        h(OverflowText, { class: "hm-flow-title" }, title),
        h("span", { class: "hm-flow-state", "aria-hidden": "true" }, () => (status() === "done" ? glyph(check) : status() === "error" ? glyph(alertCircle) : null))),
      rows > 0 && h("div", { class: "hm-flow-ports" }, Array.from({ length: rows }, (_, i) => h("div", { class: "hm-flow-portline" },
        ins[i] ? Port(n, ins[i]!, "in") : h("span"), outs[i] ? Port(n, outs[i]!, "out") : h("span")))),
      () => (val(props.fields) ?? true) && ty?.fields?.length ? h("div", { class: "hm-flow-fields" }, ty.fields.map((f) => { const id = uid("hm-flow-f"); return h(Field, { id, label: () => val(f.label), compact: true }, control(n, f, id)); })) : null,
      () => { const err = flow.errors().get(n.id); return err ? h("div", { class: "hm-flow-error", role: "status" }, err) : null; },
    ) as HTMLElement;
    // measured height feeds layout, minimap and the box selection
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => n.h.set(el.offsetHeight || n.h.peek())) : null;
    ro?.observe(el);
    onCleanup(() => ro?.disconnect());
    // run state: glow while running, a shake on error, a pop when done (all on the motion engine)
    let pulse: { cancel(): void } | null = null;
    effect(() => {
      const s = status();
      untrack(() => {
        pulse?.cancel(); pulse = null;
        if (still()) return;
        if (s === "running") pulse = animate(glow, [{ opacity: 0.35, transform: "scale(1)" }, { opacity: 1, transform: "scale(1.035)" }, { opacity: 0.35, transform: "scale(1)" }], { duration: 900, iterations: Infinity, easing: "inOut" });
        else if (s === "error") animate(el, [{ translate: "0" }, { translate: "-7px" }, { translate: "6px" }, { translate: "-4px" }, { translate: "3px" }, { translate: "0" }], { duration: 420, easing: "out" });
        else if (s === "done") animate(el, [{ scale: "1" }, { scale: "1.03" }, { scale: "1" }], { duration: 280, easing: "out" });
      });
    });
    onCleanup(() => pulse?.cancel());
    return node;
  }

  function EdgeView(e: FlowEdge): Element {
    const d = computed(() => {
      const a = portPoint(flow, e.from, "out"), b = portPoint(flow, e.to, "in");
      return a && b ? edgePath(a, b) : "";
    });
    const isSel = (): boolean => sel().has(e.id);
    const count = (): number => flow.counts().get(e.id) ?? 0;
    const src = statusOf(endOf(e.from)[0]);
    const liveFlow = (): boolean => count() > 0 || src() === "running";
    let path!: SVGPathElement, flowPath!: SVGPathElement;
    const g = h("g", { class: () => cx("hm-flow-edge", isSel() && "is-selected", liveFlow() && "is-live", flow.status().get(endOf(e.to)[0]) === "skipped" && "is-skipped") },
      h("path", { class: "hm-flow-edge-hit", d, onPointerdown: (ev: PointerEvent) => { ev.stopPropagation(); toggleSel(e.id, ev.shiftKey || isMod(ev)); } }),
      h("path", { class: "hm-flow-edge-line", d, ref: (x: SVGPathElement) => { path = x; } }),
      h("path", { class: "hm-flow-edge-flow", d, ref: (x: SVGPathElement) => { flowPath = x; } }),
      h("g", { ref: (x: SVGGElement) => dotsLayer.set(e.id, x) }),
    ) as SVGGElement;
    paths.set(e.id, path);
    onCleanup(() => { paths.delete(e.id); dotsLayer.delete(e.id); });
    // drawn in once it is in the document (SVG length needs layout)
    queueMicrotask(() => {
      if (still() || typeof path.getTotalLength !== "function" || !path.isConnected) return;
      const len = path.getTotalLength();
      animate(path, [{ strokeDasharray: `${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len}`, strokeDashoffset: "0" }], { duration: 520, easing: "out" });
    });
    // marching dashes while values flow
    let march: { cancel(): void } | null = null;
    effect(() => {
      const on = liveFlow();
      untrack(() => {
        march?.cancel(); march = null;
        if (on && !still()) march = animate(flowPath, [{ strokeDashoffset: "24" }, { strokeDashoffset: "0" }], { duration: 640, iterations: Infinity, easing: "linear" });
      });
    });
    onCleanup(() => march?.cancel());
    return g;
  }

  function Pill(e: FlowEdge): Element {
    const mid = computed(() => {
      const a = portPoint(flow, e.from, "out"), b = portPoint(flow, e.to, "in");
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { x: 0, y: 0 };
    });
    const count = (): number => flow.counts().get(e.id) ?? 0;
    const name = (): string => {
      const [a] = endOf(e.from), [b] = endOf(e.to);
      const ta = flow.node(a), tb = flow.node(b);
      const nm = (n: NodeState | undefined): string => (n ? n.label() || val(flow.typeOf(n.type)?.label) || n.id : "?");
      return L().connection?.(nm(ta), nm(tb)) ?? t`Connection ${nm(ta)} → ${nm(tb)}`;
    };
    return h("button", {
      type: "button", class: () => cx("hm-flow-pill", count() > 0 && "is-counting", sel().has(e.id) && "is-selected"),
      "data-edge-pill": e.id,
      "aria-label": () => (count() ? `${name()} · ${L().values?.(count()) ?? t`${count()} values`}` : name()),
      "aria-pressed": () => String(sel().has(e.id)),
      style: () => ({ "inset-inline-start": `${mid().x}px`, "inset-block-start": `${mid().y}px` }),
      onPointerdown: (ev: PointerEvent) => ev.stopPropagation(),
      onClick: (ev: MouseEvent) => toggleSel(e.id, ev.shiftKey || isMod(ev)),
    }, () => (count() > 0 ? String(count()) : null));
  }

  function GroupView(group: () => FlowGroup): Element {
    const g = untrack(group); // the id is the key; members and label are read live
    const box = computed(() => boundsOf(flow, group().nodes) ?? { x: 0, y: 0, w: 0, h: 0 });
    const isSel = (): boolean => sel().has(g.id);
    return h("div", {
      class: () => cx("hm-flow-group", isSel() && "is-selected"), "data-hm-color": colorAttr(g.color ?? "brand-purple"),
      style: () => { const b = box(); return { "inset-inline-start": `${b.x - 20}px`, "inset-block-start": `${b.y - 44}px`, width: `${b.w + 40}px`, height: `${b.h + 64}px` }; },
    }, h("button", {
      type: "button", class: "hm-flow-group-label", "aria-pressed": () => String(isSel()),
      onPointerdown: (e: PointerEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (e.shiftKey || isMod(e)) { toggleSel(g.id, true); return; }
        sel.set(new Set([g.id]));
        dragNodes(e, untrack(group).nodes);
      },
      onKeydown: (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); sel.set(new Set([g.id])); } },
    }, h(OverflowText, {}, () => group().label)));
  }

  // ---------------------------------------------------------------- context menu
  function menuFor(target: Element, point: { x: number; y: number }): MenuItem[] {
    const nodeEl = target.closest?.<HTMLElement>("[data-node]");
    const pillEl = target.closest?.<HTMLElement>("[data-edge-pill]");
    const groupEl = target.closest?.(".hm-flow-group");
    if (nodeEl && !sel.peek().has(nodeEl.dataset.node!)) sel.set(new Set([nodeEl.dataset.node!]));
    if (pillEl && !sel.peek().has(pillEl.dataset.edgePill!)) sel.set(new Set([pillEl.dataset.edgePill!]));
    const has = sel.peek().size > 0 && !!(nodeEl || pillEl || groupEl);
    const inGroup = flow.groups.peek().some((g) => sel.peek().has(g.id) || g.nodes.some((n) => sel.peek().has(n)));
    const at = toWorld(point.x, point.y), l = L();
    if (has) return [
      { label: l.copy ?? t`Copy`, shortcut: "mod+c", onSelect: copy, hidden: !!pillEl },
      { label: l.cut ?? t`Cut`, shortcut: "mod+x", onSelect: () => { copy(); remove(); }, hidden: !!pillEl },
      { label: l.duplicate ?? t`Duplicate`, shortcut: "mod+d", onSelect: duplicate, hidden: !!pillEl },
      { label: l.group ?? t`Group selection`, shortcut: "mod+g", onSelect: () => flow.group(selectedNodes()), hidden: !!pillEl },
      { label: l.ungroup ?? t`Ungroup`, shortcut: "mod+shift+g", onSelect: () => flow.ungroup(sel.peek()), hidden: !inGroup },
      "-",
      { label: l.delete ?? t`Delete`, shortcut: "Delete", danger: true, onSelect: remove },
    ];
    return [
      { label: l.paste ?? t`Paste`, shortcut: "mod+v", disabled: !buffer, onSelect: () => paste(buffer, { x: snapTo(at.x), y: snapTo(at.y) }) },
      { label: l.selectAll ?? t`Select all`, shortcut: "mod+a", onSelect: selectAll },
      "-",
      ...flow.types.slice(0, 8).map((ty) => ({ label: l.add?.(val(ty.label)) ?? t`Add ${val(ty.label)}`, icon: ty.icon, onSelect: () => { flow.addNode(ty.type, snapTo(at.x), snapTo(at.y)); } })),
      "-",
      { label: l.layout ?? t`Auto layout`, shortcut: "shift+l", onSelect: () => view.layout() },
      { label: l.fit ?? t`Fit to view`, shortcut: "0", onSelect: () => view.fit() },
    ];
  }

  // ---------------------------------------------------------------- frame
  // the direction is read once per render pass (the world's translate mirrors in RTL)
  const dirTick = signal(0);
  const rtl0 = (): boolean => { dirTick(); return root ? rtl() : false; };
  const world = h("div", {
    class: "hm-flow-world",
    style: () => { const v = vp(); return { transform: `translate(${rtl0() ? -v.x : v.x}px, ${v.y}px) scale(${v.zoom})` }; },
  },
    h("div", { class: "hm-flow-groups" }, h(For, { each: flow.groups, key: "id", children: (g: () => FlowGroup) => GroupView(g) })),
    h("svg", { class: "hm-flow-edges", width: "1", height: "1", "aria-hidden": "true" },
      h(For, { each: flow.edges, key: "id", children: (e: () => FlowEdge) => EdgeView(untrack(e)) }),
      () => { const dr = draft(); return dr ? h("path", { class: "hm-flow-draft", d: dr.side === "out" ? edgePath(dr.from, dr.to) : edgePath(dr.to, dr.from) }) : null; }),
    h("div", { class: "hm-flow-pills" }, h(For, { each: flow.edges, key: "id", children: (e: () => FlowEdge) => Pill(untrack(e)) })),
    h("div", { class: "hm-flow-nodes" }, h(For, { each: flow.nodes, key: "id", children: (n: () => NodeState) => NodeView(untrack(n)) })),
  );

  const canvas = h("div", {
    ref: (x: HTMLElement) => { root = x; },
    class: () => cx("hm-flow", val(props.tool) === "pan" && "is-hand", pending() && "is-connecting", grid() <= 0 && "is-free", val(props.class)),
    tabindex: "0", role: "application",
    "aria-roledescription": () => L().editor ?? t`flow editor`,
    "aria-label": () => val(props.label) ?? t`Flow editor`,
    style: () => { const v = vp(), g = Math.max(4, (grid() || 16) * v.zoom); return { "--hm-flow-gs": `${g}px`, "--hm-flow-gx": `${v.x % g}px`, "--hm-flow-gy": `${v.y % g}px` }; },
    onPointerdown: (e: PointerEvent) => onBackgroundDown(e),
    onWheel: (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { const p = local(e.clientX, e.clientY); zoomAround(p.x, p.y, vp.peek().zoom * Math.exp(-e.deltaY * 0.0022)); return; }
      const v = vp.peek(), s = rtl() ? -1 : 1;
      vp.set({ ...v, x: v.x - e.deltaX * s, y: v.y - e.deltaY });
    },
    onKeydown: onKey,
    onKeyup: (e: KeyboardEvent) => { if (e.key === " ") { space = false; root.classList.remove("is-panning"); } },
  },
    world,
    () => { const m = marquee(); return m ? h("div", { class: "hm-flow-marquee", style: { "inset-inline-start": `${Math.min(m.x0, m.x1)}px`, "inset-block-start": `${Math.min(m.y0, m.y1)}px`, width: `${Math.abs(m.x1 - m.x0)}px`, height: `${Math.abs(m.y1 - m.y0)}px` } }) : null; },
    () => (val(props.controls) === false ? null : h("div", { class: "hm-flow-zoom", onPointerdown: (e: PointerEvent) => e.stopPropagation() },
      part("zoom") && [
        h(IconButton, { icon: glyph(minus), label: () => L().zoomOut ?? t`Zoom out`, size: "sm", onClick: () => view.zoomBy(1 / 1.2) }),
        h("span", { class: "hm-flow-zoomval", "aria-live": "off" }, () => `${Math.round(vp().zoom * 100)}%`),
        h(IconButton, { icon: glyph(plus), label: () => L().zoomIn ?? t`Zoom in`, size: "sm", onClick: () => view.zoomBy(1.2) })],
      part("fit") && h(IconButton, { icon: glyph(fitIcon), label: () => L().fit ?? t`Fit to view`, size: "sm", onClick: () => view.fit() }),
      part("layout") && h(IconButton, { icon: glyph(layoutIcon), label: () => L().layout ?? t`Auto layout`, size: "sm", onClick: () => view.layout() }))),
    () => ((val(props.minimap) ?? true) ? h(Minimap, { flow, size, label: () => L().minimap }) : null),
    h("div", { class: "hm-sr-only", "aria-live": "polite" }, live),
  ) as HTMLElement;

  const owner = getOwner();
  void clipboardManager().then((m) => runWithOwner(owner, () => m.clipboard().onPaste(canvas, (p) => { if (editable(globalThis.document.activeElement)) return false; paste(p.text || buffer); return true; })));
  listen(globalThis.window, { resize: () => dirTick.set(dirTick.peek() + 1) });
  // re-read the direction when the document flips (showcase RTL switch)
  const mo = typeof MutationObserver === "function" ? new MutationObserver(() => dirTick.set(dirTick.peek() + 1)) : null;
  mo?.observe(globalThis.document.documentElement, { attributes: true, attributeFilter: ["dir"] });
  onCleanup(() => mo?.disconnect());
  // first frame: the direction is known and nodes are measured; frame the drawing. Until the user moves the view, the
  // drawing is framed again whenever the canvas gets its real size (a lazy page or a tab lays it out later).
  nextFrame(() => { dirTick.set(1); if (root?.isConnected) view.fit(false); }, "write");
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => { if (!touched && root.clientWidth > 0) nextFrame(() => { if (!touched) view.fit(false); }, "write"); }) : null;
  ro?.observe(canvas);
  onCleanup(() => ro?.disconnect());
  const stopAuto = (): void => { touched = true; };
  listen(canvas, { wheel: stopAuto, keydown: stopAuto, pointerdown: stopAuto }, { capture: true, passive: true });

  const menu = props.menu;
  if (menu === false) return canvas;
  return h(ContextMenu, { items: typeof menu === "function" ? (target, point) => menu(menuFor(target, point), target) : menuFor, label: () => L().menu ?? t`Flow actions`, children: canvas }) as Element;
}

/** Localised label of a node run state ("running", "failed" …), as the canvas and FlowControls show it. */
const statusText = (s: string): string => ({ queued: t`queued`, running: t`running`, done: t`done`, error: t`failed`, skipped: t`skipped` } as Record<string, string>)[s] ?? s;
export { statusText as flowStatusText };
/** Node geometry in px (width, header height, port row height) for custom layouts. */
export const FLOW_NODE = { width: NODE_W, head: NODE_HEAD, row: PORT_ROW };
