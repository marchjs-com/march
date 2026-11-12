// FlowPalette (hadi-march/ui): the node types of a flow, by category, with a search box. Drag one onto a FlowCanvas
// to place it where you drop it (snapped to the grid), or press Enter / click to add it in the middle of the view.
// The dragged card floats in the "drag" layer and settles into place on the motion engine.
import "./flow-palette.css";
import { signal, computed } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { openLayer } from "../../../dom/portal.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, uid, icon, listen, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr } from "../../../theme/colors.ts";
import { SearchBox } from "../../../ui/layout.ts";
import { OverflowText } from "../../../ui/marquee.ts";
import { score } from "../../../ui/fold.ts";
import { animate } from "../../../motion/animate.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { NODE_W, type FlowStore, type FlowNodeType } from "../flow-canvas/model.ts";
export interface FlowPaletteProps {
  flow: FlowStore;
  /** Types to offer. Default: every type of the flow. */
  types?: readonly FlowNodeType[];
  /** Grid step used when dropping (match the canvas `snap`). Default 16. */
  snap?: number;
  /** Show the search box. Default true. */
  search?: MaybeFn<boolean | undefined>;
  /** Called after a node is added. */
  onAdd?: (id: string, type: FlowNodeType) => void;
  class?: ClassProp;
}

/** `<FlowPalette flow={flow} />` next to `<FlowCanvas flow={flow} />`. */
export function FlowPalette(props: FlowPaletteProps): Element {
  const flow = props.flow;
  const q = signal("");
  const hint = uid("hm-flowpal-hint");
  const types = (): readonly FlowNodeType[] => props.types ?? flow.types;
  const shown = computed(() => {
    const query = q().trim();
    const list = types().filter((ty) => !query || score(query, val(ty.label), `${val(ty.description) ?? ""} ${val(ty.category) ?? ""}`) > 0);
    const cats = new Map<string, FlowNodeType[]>();
    for (const ty of list) { const c = val(ty.category) ?? ""; cats.set(c, [...(cats.get(c) ?? []), ty]); }
    return [...cats];
  });
  const snap = (v: number): number => { const g = props.snap ?? 16; return g > 0 ? Math.round(v / g) * g : v; };
  let added = 0;
  const add = (ty: FlowNodeType, at?: { x: number; y: number }): void => {
    const view = flow.view.peek();
    const c = at ?? view?.center() ?? { x: 0, y: 0 };
    // keyboard adds fan out a little so repeated adds do not stack exactly
    const off = at ? 0 : (added++ % 5) * 24;
    const id = flow.addNode(ty.type, snap(c.x - (at ? 0 : NODE_W / 2) + off), snap(c.y - (at ? 0 : 40) + off));
    props.onAdd?.(id, ty);
  };

  function drag(e: PointerEvent, ty: FlowNodeType, card: HTMLElement): void {
    if (e.button !== 0) return;
    const r = card.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    let ghost: HTMLElement | null = null, close: (() => void) | null = null;
    const x0 = e.clientX, y0 = e.clientY;
    card.setPointerCapture?.(e.pointerId);
    const place = (x: number, y: number): void => setStyle(ghost, { left: `${x - dx}px`, top: `${y - dy}px` });
    const off = listen(card, {
      pointermove: (ev: PointerEvent) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
          ghost = card.cloneNode(true) as HTMLElement;
          ghost.classList.add("hm-flowpal-ghost");
          ghost.removeAttribute("id");
          setStyle(ghost, { width: `${r.width}px` });
          close = openLayer("drag", ghost);
          if (!reducedMotion()) animate(ghost, [{ transform: "scale(1) rotate(0deg)" }, { transform: "scale(1.04) rotate(-2deg)" }], { duration: 160, easing: "out", fill: "forwards" });
          card.classList.add("is-dragging");
        }
        place(ev.clientX, ev.clientY);
        const over = !!flow.view.peek()?.toWorld(ev.clientX, ev.clientY);
        ghost.classList.toggle("is-over", over);
      },
      pointerup: (ev: PointerEvent) => {
        off();
        card.classList.remove("is-dragging");
        if (!ghost) { add(ty); return; } // a click
        const p = flow.view.peek()?.toWorld(ev.clientX - dx, ev.clientY - dy);
        const inside = !!flow.view.peek()?.toWorld(ev.clientX, ev.clientY);
        const g = ghost, done = close;
        if (inside && p) add(ty, { x: p.x, y: p.y });
        if (reducedMotion()) { done?.(); return; }
        // dropped: melt into the canvas; missed: fly back to the palette
        const back = inside ? [{ opacity: 1, transform: "scale(1.04)" }, { opacity: 0, transform: "scale(.9)" }] : [{ opacity: 1, translate: "0 0" }, { opacity: .2, translate: `${x0 - ev.clientX}px ${y0 - ev.clientY}px` }];
        animate(g, back, { duration: inside ? 180 : 280, easing: "out", fill: "forwards" }).finished.then(() => done?.());
      },
      pointercancel: () => { off(); card.classList.remove("is-dragging"); close?.(); },
    });
  }

  const card = (ty: FlowNodeType): Element => {
    let el!: HTMLElement;
    return h("li", { class: "hm-flowpal-item" }, h("button", {
      type: "button", class: "hm-flowpal-card", "data-hm-color": colorAttr(ty.color), ref: (x: HTMLElement) => { el = x; },
      "aria-label": () => `${val(ty.label)}${ty.description ? `. ${val(ty.description)}` : ""}`,
      "aria-describedby": hint,
      onPointerdown: (e: PointerEvent) => { e.preventDefault(); el.focus(); drag(e, ty, el); },
      onKeydown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); add(ty); } },
    },
      h("span", { class: "hm-flowpal-icon", "aria-hidden": "true" }, icon(ty.icon)),
      h("span", { class: "hm-flowpal-text" },
        h(OverflowText, { class: "hm-flowpal-name" }, () => val(ty.label)),
        ty.description != null && h(OverflowText, { class: "hm-flowpal-desc" }, () => val(ty.description))),
      h("span", { class: "hm-flowpal-grip", "aria-hidden": "true" })));
  };

  return h("div", { class: () => cx("hm-flowpal", val(props.class)), role: "region", "aria-label": () => t`Node types` },
    () => ((val(props.search) ?? true) ? h(SearchBox, { value: q, debounce: 0, placeholder: () => t`Search nodes`, label: () => t`Search nodes` }) : null),
    h("p", { class: "hm-sr-only", id: hint }, () => t`Drag onto the canvas, or press Enter to add it in the middle.`),
    () => {
      const groups = shown();
      if (!groups.length) return h("p", { class: "hm-flowpal-empty" }, t`No node type matches.`);
      return groups.map(([cat, list]) => h("section", { class: "hm-flowpal-cat" },
        cat && h("h3", { class: "hm-flowpal-cattitle" }, cat),
        h("ul", { class: "hm-flowpal-list" }, list.map(card))));
    });
}
