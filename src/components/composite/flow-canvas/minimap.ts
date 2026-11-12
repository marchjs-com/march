// Minimap of a FlowCanvas: every node as a small block in its type colour and the visible area as a frame. Click or
// drag on it to move the view; arrow keys pan when it has focus. Mirrors in RTL with the canvas.
import { computed, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { For } from "../../../dom/flow.ts";
import { t } from "../../../core/i18n.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { NODE_W, boundsOf, type FlowStore, type NodeState } from "./model.ts";
import { isRtl } from "../../../core/util.ts";

export interface MinimapProps {
  flow: FlowStore;
  /** Canvas size in pixels. */
  size: () => { w: number; h: number };
}

const MW = 168, MH = 112;

/** `<Minimap flow={flow} size={() => ({ w, h })} />` (FlowCanvas shows one unless minimap={false}). */
export function Minimap(props: MinimapProps): Element {
  const flow = props.flow;
  // world box that holds the drawing and the visible area
  const box = computed(() => {
    const v = flow.viewport(), s = props.size();
    const vis = { x: -v.x / v.zoom, y: -v.y / v.zoom, w: s.w / v.zoom, h: s.h / v.zoom };
    const b = boundsOf(flow) ?? vis;
    const x0 = Math.min(b.x, vis.x) - 40, y0 = Math.min(b.y, vis.y) - 40;
    const x1 = Math.max(b.x + b.w, vis.x + vis.w) + 40, y1 = Math.max(b.y + b.h, vis.y + vis.h) + 40;
    const k = Math.min(MW / (x1 - x0), MH / (y1 - y0));
    return { x0, y0, k, vis };
  });
  const moveTo = (svg: SVGSVGElement, cx: number, cy: number): void => {
    const r = svg.getBoundingClientRect();
    const rtl = isRtl(svg);
    const { x0, y0, k, vis } = box.peek();
    const wx = x0 + (rtl ? r.right - cx : cx - r.left) / k, wy = y0 + (cy - r.top) / k;
    const v = flow.viewport.peek();
    flow.viewport.set({ ...v, x: -(wx - vis.w / 2) * v.zoom, y: -(wy - vis.h / 2) * v.zoom });
  };
  const rect = (n: NodeState): Element => h("rect", {
    class: () => `hm-flow-mm-node is-${flow.status().get(n.id) ?? "idle"}`, "data-hm-color": colorAttr(flow.typeOf(n.type)?.color), rx: "3",
    x: () => (n.x() - box().x0) * box().k, y: () => (n.y() - box().y0) * box().k,
    width: () => NODE_W * box().k, height: () => n.h() * box().k,
  });
  return h("svg", {
    class: "hm-flow-minimap", width: String(MW), height: String(MH), viewBox: `0 0 ${MW} ${MH}`, role: "img", tabindex: "0",
    "aria-label": () => t`Minimap: click to move the view`,
    onPointerdown: (e: PointerEvent) => {
      e.stopPropagation();
      const svg = e.currentTarget as SVGSVGElement;
      moveTo(svg, e.clientX, e.clientY);
      pointerDrag(e, { threshold: 0, onMove: (q) => moveTo(svg, q.clientX, q.clientY) });
    },
    onWheel: (e: WheelEvent) => e.stopPropagation(),
  },
    h("g", { class: "hm-flow-mm-world" }, h(For, { each: flow.nodes, key: "id", children: (n: () => NodeState) => rect(untrack(n)) })),
    h("rect", {
      class: "hm-flow-mm-view", rx: "4",
      x: () => (box().vis.x - box().x0) * box().k, y: () => (box().vis.y - box().y0) * box().k,
      width: () => box().vis.w * box().k, height: () => box().vis.h * box().k,
    }));
}
