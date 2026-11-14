// FlowPalette (hadi-march/ui): the node types of a flow, by category, with a search box. Drag one onto a FlowCanvas
// to place it where you drop it (snapped to the grid), or press Enter / click to add it in the middle of the view.
// The dragged card floats in the "drag" layer (dragGhost) and settles into place on the motion engine.
import "./flow-palette.css";
import { signal, computed } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, uid, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { snap } from "../../../ui/format.ts";
import { score } from "../../../ui/fold.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import { OverflowText } from "../../typography/overflow-text/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { IconTile } from "../../data/icon-tile/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { dragGhost, type DragGhost } from "../../../behaviors/drag/ghost.ts";
import { NODE_W, type FlowStore, type FlowNodeType } from "../flow-canvas/model.ts";
export interface FlowPaletteProps {
  flow: FlowStore;
  /** Types to offer. Default: every type of the flow. */
  types?: readonly FlowNodeType[];
  /** Grid step used when dropping (match the canvas `snap`). Default 16. */
  snap?: number;
  /** Show the search box. Default true. */
  search?: MaybeFn<boolean | undefined>;
  /** The category titles (default true). */
  categories?: MaybeFn<boolean | undefined>;
  /** The description line of a card (default true). */
  descriptions?: MaybeFn<boolean | undefined>;
  /** The grip dots at the end of a card (default true). */
  grip?: MaybeFn<boolean | undefined>;
  /** Own card content: `(type) => node`. The card stays a button: drag, click and Enter work as before. */
  renderCard?: ((type: FlowNodeType) => unknown) | undefined;
  /** What a search without a match shows: true (default text), false (nothing) or your own node. */
  empty?: boolean | Node | undefined;
  /** The tilt of a dragged card, its melt into the canvas and its fly-back (default true). */
  motion?: boolean | undefined;
  /** Own texts: the region name, the search box, the screen reader hint of a card, the "no match" text. */
  labels?: { region?: string; search?: string; hint?: string; empty?: string } | undefined;
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
  const grid = (v: number): number => snap(v, props.snap ?? 16);
  let added = 0;
  const add = (ty: FlowNodeType, at?: { x: number; y: number }): void => {
    const view = flow.view.peek();
    const c = at ?? view?.center() ?? { x: 0, y: 0 };
    // keyboard adds fan out a little so repeated adds do not stack exactly
    const off = at ? 0 : (added++ % 5) * 24;
    const id = flow.addNode(ty.type, grid(c.x - (at ? 0 : NODE_W / 2) + off), grid(c.y - (at ? 0 : 40) + off));
    props.onAdd?.(id, ty);
  };

  function drag(e: PointerEvent, ty: FlowNodeType, card: HTMLElement): void {
    if (e.button !== 0) return;
    const r = card.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const x0 = e.clientX, y0 = e.clientY;
    let ghost: DragGhost | null = null;
    pointerDrag(e, {
      threshold: 5,
      onClick: () => add(ty),
      onMove: (q) => {
        if (!ghost) {
          const copy = card.cloneNode(true) as HTMLElement;
          copy.classList.add("hm-flowpal-ghost");
          setStyle(copy, { width: `${r.width}px` });
          ghost = dragGhost(copy, { offset: { x: -dx, y: -dy }, motion: () => props.motion,
            enter: [{ transform: "scale(1) rotate(0deg)" }, { transform: "scale(1.04) rotate(-2deg)" }], timing: { duration: 160, easing: "out", fill: "forwards" } });
          card.classList.add("is-dragging");
        }
        ghost.move(q.clientX, q.clientY);
        ghost.el.classList.toggle("is-over", !!flow.view.peek()?.toWorld(q.clientX, q.clientY));
      },
      onEnd: (q, cancelled) => {
        card.classList.remove("is-dragging");
        if (cancelled || !ghost) { ghost?.close(); return; }
        const p = flow.view.peek()?.toWorld(q.clientX - dx, q.clientY - dy);
        const inside = !!flow.view.peek()?.toWorld(q.clientX, q.clientY);
        if (inside && p) add(ty, { x: p.x, y: p.y });
        // dropped: melt into the canvas; missed: fly back to the palette
        void ghost.leave(inside ? [{ opacity: 1, transform: "scale(1.04)" }, { opacity: 0, transform: "scale(.9)" }] : [{ opacity: 1, translate: "0 0" }, { opacity: .2, translate: `${x0 - q.clientX}px ${y0 - q.clientY}px` }],
          { duration: inside ? 180 : 280 });
      },
    });
  }

  // the card is a ListRow that is a button: type icon, name + description, grip
  const card = (ty: FlowNodeType): Element => {
    let el!: HTMLElement;
    return h("li", { class: "hm-flowpal-item" }, h(ListRow, {
      as: "button", class: "hm-flowpal-card", color: ty.color, ref: (x: HTMLElement) => { el = x; },
      "aria-label": () => `${val(ty.label)}${ty.description ? `. ${val(ty.description)}` : ""}`,
      "aria-describedby": hint,
      onPointerdown: (e: PointerEvent) => { e.preventDefault(); el.focus(); drag(e, ty, el); },
      onKeydown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); add(ty); } },
      ...(props.renderCard ? { title: h("span", { class: "hm-flowpal-own" }, props.renderCard(ty)) } : {
        lead: h(IconTile, { class: "hm-flowpal-icon", icon: ty.icon, color: ty.color }),
        title: h(OverflowText, { class: "hm-flowpal-name" }, () => val(ty.label)),
        sub: ty.description != null && val(props.descriptions) !== false ? h(OverflowText, { class: "hm-flowpal-desc" }, () => val(ty.description)) : undefined,
      }),
      trail: val(props.grip) === false ? undefined : h("span", { class: "hm-flowpal-grip", "aria-hidden": "true" }),
    }));
  };

  return h("div", { class: () => cx("hm-flowpal", val(props.class)), role: "region", "aria-label": () => props.labels?.region ?? t`Node types` },
    () => ((val(props.search) ?? true) ? h(SearchBox, { value: q, debounce: 0, placeholder: () => props.labels?.search ?? t`Search nodes`, label: () => props.labels?.search ?? t`Search nodes` }) : null),
    h("p", { class: "hm-sr-only", id: hint }, () => props.labels?.hint ?? t`Drag onto the canvas, or press Enter to add it in the middle.`),
    () => {
      const groups = shown();
      if (!groups.length) {
        if (props.empty === false) return null;
        const own = props.empty && props.empty !== true ? props.empty : null;
        return h(Empty, { size: "sm", class: "hm-flowpal-empty", title: own ? false : props.labels?.empty ?? t`No node type matches.` }, own);
      }
      return groups.map(([cat, list]) => h("section", { class: "hm-flowpal-cat" },
        cat && val(props.categories) !== false && h(SectionLabel, { as: "h3", size: "md", class: "hm-flowpal-cattitle" }, cat),
        h("ul", { class: "hm-flowpal-list" }, list.map(card))));
    });
}
