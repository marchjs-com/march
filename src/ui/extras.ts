// More components: Chip, AvatarGroup, Progress, Rating, Accordion, Steps, Pagination, Carousel, Tree, Kanban, Splitter.
// Accessible (ARIA roles + keyboard), themable (tokens only), no inline styles except CSSOM custom properties.
import { signal, computed, untrack, effect } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Avatar } from "./display.ts";
import { val, cx, uid, icon, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { x as xIcon, star, starFilled, chevronDown, chevronLeft, chevronRight, check, more } from "../icons/set.ts";

const setVar = (el: Element, name: string, value: string): void => { (el as HTMLElement).style?.setProperty(name, value); };

// ---------------------------------------------------------------- Chip
export interface ChipProps {
  tone?: MaybeFn<"neutral" | "primary" | "success" | "warn" | "danger" | "info" | undefined>;
  icon?: unknown;
  /** Toggle chip (filters): pressed state. */
  selected?: MaybeFn<boolean | undefined>;
  onClick?: (e: MouseEvent) => void;
  onRemove?: () => void;
  size?: "sm" | "md";
  class?: ClassProp;
  children?: unknown;
}
/** `<Chip icon={tag}>Design</Chip>`, filter chips `<Chip selected={$on} onClick={…}>`, removable `<Chip onRemove={…}>`. */
export function Chip(props: ChipProps): Element {
  const toggle = props.selected !== undefined || props.onClick != null;
  const cls = (): string => cx("hm-chip2", `hm-chip2-${val(props.tone) ?? "neutral"}`, props.size === "sm" && "hm-chip2-sm", toggle && "hm-chip2-btn", val(props.selected) && "is-selected", val(props.class));
  const body = [
    () => (toggle && val(props.selected) ? h("span", { class: "hm-chip2-icon" }, glyph(check)) : icon(props.icon, "hm-chip2-icon")),
    h("span", { class: "hm-chip2-label" }, props.children),
  ];
  const remove = props.onRemove && h("button", { type: "button", class: "hm-chip2-x", "aria-label": () => t`Remove`, onClick: (e: Event) => { e.stopPropagation(); props.onRemove?.(); } }, glyph(xIcon));
  if (toggle) return h("span", { class: cls }, h("button", { type: "button", class: "hm-chip2-hit", "aria-pressed": () => (props.selected !== undefined ? String(!!val(props.selected)) : null), onClick: (e: MouseEvent) => props.onClick?.(e) }, body), remove);
  return h("span", { class: cls }, body, remove);
}

// ---------------------------------------------------------------- AvatarGroup
export interface AvatarGroupProps { names: MaybeFn<readonly (string | { name: string; src?: string })[]>; max?: number; size?: "sm" | "md" | "lg"; class?: ClassProp }
/** Overlapping avatars with "+N": `<AvatarGroup names={["Ada", "Linus", …]} max={4} />` */
export function AvatarGroup(props: AvatarGroupProps): Element {
  return h("span", { class: () => cx("hm-avatars", val(props.class)), role: "group", "aria-label": () => t`${val(props.names).length} people` }, () => {
    const list = val(props.names), max = props.max ?? 4, shown = list.slice(0, max), rest = list.length - shown.length;
    return untrack(() => [
      ...shown.map((n) => (typeof n === "string" ? h(Avatar, { name: n, size: props.size ?? "sm" }) : h(Avatar, { name: n.name, src: n.src, size: props.size ?? "sm" }))),
      rest > 0 && h("span", { class: cx("hm-avatar", `hm-avatar-${props.size ?? "sm"}`, "hm-avatar-more") }, `+${rest}`),
    ]);
  });
}

// ---------------------------------------------------------------- Progress
export interface ProgressProps {
  /** 0..max; omit (or null) for an indeterminate bar. */
  value?: MaybeFn<number | null | undefined>;
  max?: number;
  tone?: MaybeFn<"primary" | "success" | "warn" | "danger" | "info" | undefined>;
  label?: MaybeFn<string | undefined>;
  /** Show the percentage next to the label. */
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  class?: ClassProp;
}
/** `<Progress value={$p} label="Uploading" showValue />`, `<Progress />` (indeterminate). */
export function Progress(props: ProgressProps): Element {
  const max = props.max ?? 100;
  const pct = computed(() => { const v = val(props.value); return v == null ? null : Math.max(0, Math.min(100, (v / max) * 100)); });
  const fill = h("span", { class: "hm-progress2-fill" });
  const bar = h("span", {
    class: "hm-progress2-track", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(max),
    "aria-valuenow": () => { const v = val(props.value); return v == null ? null : String(v); }, "aria-label": () => val(props.label) ?? t`Progress`,
  }, fill);
  const sync = (): void => { const p = pct(); setVar(fill, "--hm-progress", p == null ? "0" : String(p / 100)); };
  const root = h("div", { class: () => cx("hm-progress2", `hm-progress2-${props.size ?? "md"}`, `hm-progress2-${val(props.tone) ?? "primary"}`, pct() == null && "is-indeterminate", val(props.class)) },
    (props.label != null || props.showValue) && h("div", { class: "hm-progress2-head" },
      h("span", { class: "hm-progress2-label" }, () => val(props.label) ?? ""),
      props.showValue && h("span", { class: "hm-progress2-value" }, () => (pct() == null ? "" : `${Math.round(pct() as number)}%`))),
    bar);
  effect(sync);
  return root;
}

// ---------------------------------------------------------------- Rating
export interface RatingProps {
  value?: MaybeFn<number | null | undefined>;
  setValue?: (v: number) => void;
  onChange?: (v: number) => void;
  max?: number;
  readonly?: boolean;
  label?: MaybeFn<string | undefined>;
  size?: "sm" | "md" | "lg";
  class?: ClassProp;
}
/** Star rating (radio group; ← → change): `<Rating bind:value={$stars} />`, `<Rating value={4.5} readonly />` */
export function Rating(props: RatingProps): Element {
  const max = props.max ?? 5;
  const hover = signal<number | null>(null);
  const shown = (): number => hover() ?? Number(val(props.value) ?? 0);
  const set = (v: number): void => { if (props.readonly) return; props.setValue?.(v); props.onChange?.(v); };
  const stars = Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const filled = (): boolean => shown() >= n - 0.25;
    return h("button", {
      type: "button", role: "radio", class: () => cx("hm-rating-star", filled() && "is-on", !filled() && shown() > n - 1 && "is-half"),
      "aria-checked": () => String(Math.round(Number(val(props.value) ?? 0)) === n), "aria-label": () => t`${n} of ${max}`,
      tabindex: () => (Math.max(1, Math.round(Number(val(props.value) ?? 0))) === n ? "0" : "-1"), disabled: props.readonly,
      onClick: () => set(n), onMouseenter: () => !props.readonly && hover.set(n),
      onKeydown: (e: KeyboardEvent) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const next = Math.max(1, Math.min(max, n + d));
        set(next);
        ((e.currentTarget as HTMLElement).parentElement?.children[next - 1] as HTMLElement | undefined)?.focus();
      },
    }, h("span", { class: "hm-rating-off" }, glyph(star)), h("span", { class: "hm-rating-on" }, glyph(starFilled)));
  });
  return h("span", {
    class: () => cx("hm-rating", `hm-rating-${props.size ?? "md"}`, props.readonly && "is-readonly", val(props.class)), role: "radiogroup",
    "aria-label": () => val(props.label) ?? t`Rating`, onMouseleave: () => hover.set(null),
  }, stars);
}

// ---------------------------------------------------------------- Accordion
export interface AccordionItem { id?: string; title: unknown; subtitle?: unknown; icon?: unknown; content: unknown; disabled?: boolean }
export interface AccordionProps { items: readonly AccordionItem[]; multiple?: boolean; open?: readonly (string | number)[]; variant?: "separated" | "contained"; class?: ClassProp }
/** `<Accordion items={[{ title: "Shipping", content: … }]} multiple />` — animated height, ↑ ↓ Home End between headers. */
export function Accordion(props: AccordionProps): Element {
  const keyOf = (it: AccordionItem, i: number): string | number => it.id ?? i;
  const open = signal(new Set<string | number>(props.open ?? []));
  const base = uid("hm-acc");
  const toggle = (k: string | number): void => { open.update((s) => { const n = props.multiple ? new Set(s) : new Set<string | number>(); if (s.has(k)) n.delete(k); else n.add(k); return n; }); };
  const nav = (e: KeyboardEvent): void => {
    const btns = [...((e.currentTarget as HTMLElement).closest(".hm-accordion")?.querySelectorAll<HTMLButtonElement>(".hm-acc-btn:not(:disabled)") ?? [])];
    const i = btns.indexOf(e.target as HTMLButtonElement);
    const j = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : null;
    if (j == null || i < 0) return;
    e.preventDefault(); btns[(j + btns.length) % btns.length]?.focus();
  };
  return h("div", { class: () => cx("hm-accordion", `hm-accordion-${props.variant ?? "separated"}`, val(props.class)), onKeydown: nav },
    props.items.map((it, i) => {
      const k = keyOf(it, i), isOpen = (): boolean => open().has(k), id = `${base}-${i}`;
      return h("div", { class: () => cx("hm-acc-item", isOpen() && "is-open") },
        h("h3", { class: "hm-acc-head" },
          h("button", { type: "button", class: "hm-acc-btn", id: `${id}-b`, "aria-expanded": () => String(isOpen()), "aria-controls": `${id}-p`, disabled: it.disabled, onClick: () => toggle(k) },
            icon(it.icon, "hm-acc-icon"),
            h("span", { class: "hm-acc-titles" }, h("span", { class: "hm-acc-title" }, it.title), it.subtitle != null && h("span", { class: "hm-acc-sub" }, it.subtitle)),
            h("span", { class: "hm-acc-chev", "aria-hidden": "true" }, glyph(chevronDown)))),
        h("div", { class: "hm-acc-panel", id: `${id}-p`, role: "region", "aria-labelledby": `${id}-b`, inert: () => !isOpen() },
          h("div", { class: "hm-acc-inner" }, h("div", { class: "hm-acc-body" }, it.content))));
    }));
}

// ---------------------------------------------------------------- Steps
export interface StepItem { title: unknown; description?: unknown; icon?: unknown }
export interface StepsProps { steps: readonly StepItem[]; current: MaybeFn<number>; onSelect?: (i: number) => void; vertical?: boolean; class?: ClassProp }
/** Progress through stages: `<Steps steps={[{ title: "Account" }, …]} current={$step} onSelect={(i) => $step = i} />` */
export function Steps(props: StepsProps): Element {
  return h("ol", { class: () => cx("hm-steps2", props.vertical && "hm-steps2-v", val(props.class)) }, props.steps.map((s, i) => {
    const state = (): string => { const c = val(props.current); return i < c ? "done" : i === c ? "current" : "todo"; };
    const inner = [
      h("span", { class: "hm-step2-dot" }, () => (state() === "done" ? glyph(check) : s.icon != null ? icon(s.icon) : String(i + 1))),
      h("span", { class: "hm-step2-text" }, h("span", { class: "hm-step2-title" }, s.title), s.description != null && h("span", { class: "hm-step2-desc" }, s.description)),
    ];
    return h("li", { class: () => cx("hm-step2", `is-${state()}`), "aria-current": () => (state() === "current" ? "step" : null) },
      props.onSelect ? h("button", { type: "button", class: "hm-step2-hit", onClick: () => props.onSelect?.(i) }, inner) : h("span", { class: "hm-step2-hit" }, inner));
  }));
}

// ---------------------------------------------------------------- Pagination
export interface PaginationProps { page: MaybeFn<number>; pages: MaybeFn<number>; onPage?: (p: number) => void; setPage?: (p: number) => void; siblings?: number; class?: ClassProp }
/** Numbered pages with ellipses: `<Pagination bind:page={$page} pages={20} />` (1-based). */
export function Pagination(props: PaginationProps): Element {
  const go = (p: number): void => { props.onPage?.(p); props.setPage?.(p); };
  const items = computed((): (number | "…")[] => {
    const p = val(props.page), n = Math.max(1, val(props.pages)), s = props.siblings ?? 1;
    const out: (number | "…")[] = [];
    for (let i = 1; i <= n; i++) {
      if (i === 1 || i === n || Math.abs(i - p) <= s || (p <= 3 + s && i <= 3 + 2 * s) || (p >= n - 2 - s && i >= n - 2 - 2 * s)) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  });
  return h("nav", { class: () => cx("hm-pagination", val(props.class)), "aria-label": () => t`Pagination` },
    h("button", { type: "button", class: "hm-page-btn hm-page-nav", "aria-label": () => t`Previous`, disabled: () => val(props.page) <= 1, onClick: () => go(val(props.page) - 1) }, glyph(chevronLeft)),
    () => items().map((it) => untrack(() => (it === "…"
      ? h("span", { class: "hm-page-gap", "aria-hidden": "true" }, glyph(more))
      : h("button", { type: "button", class: () => cx("hm-page-btn", val(props.page) === it && "is-active"), "aria-current": () => (val(props.page) === it ? "page" : null), onClick: () => go(it) }, String(it))))),
    h("button", { type: "button", class: "hm-page-btn hm-page-nav", "aria-label": () => t`Next`, disabled: () => val(props.page) >= val(props.pages), onClick: () => go(val(props.page) + 1) }, glyph(chevronRight)));
}

// ---------------------------------------------------------------- Carousel
export interface CarouselProps { label?: MaybeFn<string | undefined>; /** Slides per view on wide screens. */ perView?: 1 | 2 | 3 | 4; class?: ClassProp; children?: unknown }
/** Scroll-snap carousel with buttons and dots (swipe on touch): `<Carousel perView={3}>{slides}</Carousel>` */
export function Carousel(props: CarouselProps): Element {
  let track: HTMLElement | undefined;
  const index = signal(0), count = signal(0);
  const update = (): void => {
    if (!track) return;
    const slides = [...track.children] as HTMLElement[];
    count.set(slides.length);
    const left = track.scrollLeft, w = slides[0]?.offsetWidth || 1;
    index.set(Math.round(left / (w + 16)));
  };
  const goTo = (i: number): void => { const s = track?.children[i] as HTMLElement | undefined; if (s && track) track.scrollTo({ left: s.offsetLeft - track.offsetLeft, behavior: "smooth" }); };
  queueMicrotask(update);
  return h("section", { class: () => cx("hm-carousel", `hm-carousel-${props.perView ?? 1}`, val(props.class)), "aria-roledescription": "carousel", "aria-label": () => val(props.label) ?? t`Carousel` },
    h("div", { class: "hm-carousel-track", ref: (el: HTMLElement) => { track = el; }, onScroll: update, tabindex: "0" }, props.children),
    h("button", { type: "button", class: "hm-carousel-btn hm-carousel-prev", "aria-label": () => t`Previous`, disabled: () => index() <= 0, onClick: () => goTo(index() - 1) }, glyph(chevronLeft)),
    h("button", { type: "button", class: "hm-carousel-btn hm-carousel-next", "aria-label": () => t`Next`, disabled: () => index() >= count() - (props.perView ?? 1), onClick: () => goTo(index() + 1) }, glyph(chevronRight)),
    h("div", { class: "hm-carousel-dots" }, () => Array.from({ length: Math.max(0, count() - (props.perView ?? 1) + 1) }, (_, i) =>
      h("button", { type: "button", class: () => cx("hm-carousel-dot", index() === i && "is-active"), "aria-label": () => t`Slide ${i + 1}`, onClick: () => goTo(i) }))));
}

// ---------------------------------------------------------------- Tree
export interface TreeNode { id: string; label: unknown; icon?: unknown; meta?: unknown; children?: readonly TreeNode[] }
export interface TreeProps { nodes: readonly TreeNode[]; selected?: MaybeFn<string | null | undefined>; onSelect?: (node: TreeNode) => void; expanded?: readonly string[]; label?: string; class?: ClassProp }
/** Expandable tree (role=tree; ↑ ↓ move, → opens, ← closes, Enter selects): `<Tree nodes={files} onSelect={…} />` */
export function Tree(props: TreeProps): Element {
  const open = signal(new Set(props.expanded ?? []));
  const toggle = (id: string, to?: boolean): void => { open.update((s) => { const n = new Set(s); if (to ?? !n.has(id)) n.add(id); else n.delete(id); return n; }); };
  const row = (node: TreeNode, level: number): Element => {
    const has = !!node.children?.length;
    const isOpen = (): boolean => open().has(node.id);
    return h("li", { role: "treeitem", class: "hm-tree-li", "aria-expanded": () => (has ? String(isOpen()) : null), "aria-selected": () => String(val(props.selected) === node.id), "aria-level": String(level) },
      h("div", {
        class: () => cx("hm-tree-row", val(props.selected) === node.id && "is-selected"), tabindex: "-1", "data-level": String(level),
        onClick: () => { if (has) toggle(node.id); props.onSelect?.(node); },
        onKeydown: (e: KeyboardEvent) => {
          const rows = [...((e.currentTarget as HTMLElement).closest(".hm-tree")?.querySelectorAll<HTMLElement>(".hm-tree-row") ?? [])].filter((r) => r.offsetParent !== null || !r.closest("[hidden]"));
          const i = rows.indexOf(e.currentTarget as HTMLElement);
          if (e.key === "ArrowDown") { e.preventDefault(); rows[i + 1]?.focus(); }
          else if (e.key === "ArrowUp") { e.preventDefault(); rows[i - 1]?.focus(); }
          else if (e.key === "ArrowRight" && has) { e.preventDefault(); toggle(node.id, true); }
          else if (e.key === "ArrowLeft" && has) { e.preventDefault(); toggle(node.id, false); }
          else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (has) toggle(node.id); props.onSelect?.(node); }
        },
      },
      h("span", { class: () => cx("hm-tree-chev", !has && "is-leaf", isOpen() && "is-open"), "aria-hidden": "true" }, has ? glyph(chevronRight) : null),
      icon(node.icon, "hm-tree-icon"), h("span", { class: "hm-tree-label" }, node.label), node.meta != null && h("span", { class: "hm-tree-meta" }, node.meta)),
      has && h("ul", { role: "group", class: "hm-tree-group", hidden: () => !isOpen() }, node.children?.map((c) => row(c, level + 1))));
  };
  const root = h("ul", { role: "tree", class: () => cx("hm-tree", val(props.class)), "aria-label": props.label ?? t`Tree` }, props.nodes.map((n) => row(n, 1)));
  queueMicrotask(() => { const first = (root as HTMLElement).querySelector<HTMLElement>(".hm-tree-row"); if (first) first.tabIndex = 0; });
  return root;
}

// ---------------------------------------------------------------- Kanban
export interface KanbanColumn<T> { id: string; title: unknown; tone?: string; items: readonly T[] }
export interface KanbanProps<T> {
  columns: MaybeFn<readonly KanbanColumn<T>[]>;
  /** Card content for an item. */
  card: (item: T) => unknown;
  itemKey: (item: T) => string;
  /** Called when a card is dropped on another column (drag and drop; keyboard: Alt+← / Alt+→ on a focused card). */
  onMove?: (item: T, from: string, to: string) => void;
  class?: ClassProp;
}
/** Board with columns and draggable cards. */
export function Kanban<T>(props: KanbanProps<T>): Element {
  const over = signal<string | null>(null);
  let dragging: { item: T; from: string } | null = null;
  return h("div", { class: () => cx("hm-kanban", val(props.class)) }, () => {
    const cols = val(props.columns);
    return untrack(() => cols.map((col, ci) => h("section", {
      class: () => cx("hm-kanban-col", over() === col.id && "is-over"), "aria-label": typeof col.title === "string" ? col.title : null,
      onDragover: (e: DragEvent) => { if (dragging) { e.preventDefault(); over.set(col.id); } },
      onDragleave: () => over.set(null),
      onDrop: (e: DragEvent) => { e.preventDefault(); over.set(null); if (dragging && dragging.from !== col.id) props.onMove?.(dragging.item, dragging.from, col.id); dragging = null; },
    },
    h("header", { class: "hm-kanban-head" }, h("span", { class: cx("hm-kanban-dot", col.tone && `hm-kanban-dot-${col.tone}`) }), h("span", { class: "hm-kanban-title" }, col.title), h("span", { class: "hm-kanban-count" }, String(col.items.length))),
    h("div", { class: "hm-kanban-list" }, col.items.map((it) => h("article", {
      class: "hm-kanban-card", draggable: "true", tabindex: "0", "data-key": props.itemKey(it),
      onDragstart: (e: DragEvent) => { dragging = { item: it, from: col.id }; e.dataTransfer?.setData("text/plain", props.itemKey(it)); (e.currentTarget as HTMLElement).classList.add("is-dragging"); },
      onDragend: (e: DragEvent) => { (e.currentTarget as HTMLElement).classList.remove("is-dragging"); over.set(null); },
      onKeydown: (e: KeyboardEvent) => {
        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
        const to = cols[ci + (e.key === "ArrowRight" ? 1 : -1)];
        if (to) { e.preventDefault(); props.onMove?.(it, col.id, to.id); }
      },
    }, props.card(it)))))));
  });
}

// ---------------------------------------------------------------- Splitter
export interface SplitterProps { start: unknown; end: unknown; /** Initial share of the first pane, 0..1. */ initial?: number; min?: number; label?: string; class?: ClassProp }
/** Two resizable panes (drag the handle, or ← → on it). */
export function Splitter(props: SplitterProps): Element {
  const share = signal(props.initial ?? 0.5), min = props.min ?? 0.15;
  let root: HTMLElement | undefined;
  const apply = (): void => { if (root) setVar(root, "--hm-split", `${(share.peek() * 100).toFixed(2)}%`); };
  const setShare = (v: number): void => { share.set(Math.max(min, Math.min(1 - min, v))); apply(); };
  const onDown = (e: PointerEvent): void => {
    const handle = e.currentTarget as HTMLElement; handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent): void => { if (!root) return; const r = root.getBoundingClientRect(); setShare((ev.clientX - r.left) / r.width); };
    const up = (): void => { handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up);
  };
  const el = h("div", { class: () => cx("hm-splitter", val(props.class)), ref: (x: HTMLElement) => { root = x; queueMicrotask(apply); } },
    h("div", { class: "hm-split-pane" }, props.start),
    h("div", {
      class: "hm-split-handle", role: "separator", tabindex: "0", "aria-orientation": "vertical", "aria-label": props.label ?? t`Resize`,
      "aria-valuenow": () => String(Math.round(share() * 100)), "aria-valuemin": "0", "aria-valuemax": "100",
      onPointerdown: onDown, onKeydown: (e: KeyboardEvent) => { const d = e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0; if (d) { e.preventDefault(); setShare(share.peek() + d); } },
    }),
    h("div", { class: "hm-split-pane" }, props.end));
  return el;
}
