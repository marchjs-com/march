// ProjectGrid (march/landing): portfolio work as cover cards with filter chips. Choosing a filter fades out what no
// longer matches and glides the rest into their new places (FLIP on the motion engine); new matches scale in. Opening
// a card hands its cover to `onOpen` (for a shared element transition into ProjectDetail) or, without it, shows the
// cover in the Lightbox. Covers keep their size reserved (no layout shift) and load lazily.
import "./project-grid.css";
import { h } from "../../../dom/h.ts";
import { signal } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { owned } from "../../../ui/observe.ts";
import { Card } from "../../../ui/card.ts";
import { Chip } from "../../actions/chip/index.ts";
import { openMedia } from "../../../ui/media.ts";
import { Picture, isPicture, type PictureSource } from "../../media/picture/index.ts";
import { CornerMark } from "../../media/corner-mark/index.ts";
import { arrowUpRight } from "../../../icons/glyphs/arrowUpRight.ts";
import { flip } from "../../../motion/flip.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { still } from "../../../motion/engine/parts.ts";
import { revealOnScroll, type RevealOptions } from "../reveal/index.ts"; // Reveal: the cards enter one after another
import { type ColorToken } from "../../../theme/colors.ts";

export interface ProjectCover extends PictureSource { alt: string; width: number; height: number }
export interface Project {
  id: string;
  title: unknown;
  /** Filter group ("Brand", "Web", "App"). */
  category?: string | undefined;
  year?: unknown;
  summary?: unknown;
  /** An image (size reserved) or any node (an illustration). */
  cover: ProjectCover | Node;
  href?: string | undefined;
}
export interface ProjectGridProps {
  /** The projects: `{ id, title, category?, year?, summary?, cover, href? }`; `cover` is an image or a node. @tr Projeler: `{ id, title, category?, year?, summary?, cover, href? }`; `cover` bir görsel ya da düğümdür. */
  projects: readonly Project[];
  /** Filter chips from the categories (default true when there are two or more). @tr Kategorilerden süzgeç çipleri (iki ya da daha fazla kategori varsa varsayılan true). */
  filters?: boolean | undefined;
  /** Columns on wide screens (default 3). @tr Geniş ekranlarda sütun sayısı (varsayılan 3). */
  cols?: 2 | 3 | undefined;
  /** Open a project: receives the cover element (start of a shared element transition). @tr Bir projeyi açar: kapak öğesini alır (paylaşılan öğe geçişinin başlangıcı). */
  onOpen?: ((p: Project, cover: Element) => void) | undefined;
  /** Without onOpen: show the cover in the Lightbox (default true). @tr onOpen yoksa kapağı Lightbox içinde gösterir (varsayılan true). */
  lightbox?: boolean | undefined;
  /** Text of the "all" chip (default "All"). @tr "Tümü" çipinin metni (varsayılan "All"). */
  allLabel?: MaybeFn<string> | undefined;
  /** Accessible name of the filter group (default "Filter projects"). @tr Süzgeç grubunun erişilebilir adı (varsayılan "Filter projects"). */
  filtersLabel?: string | undefined;
  /** The arrow badge on a cover: true (default), false, or `(project) => node`. @tr Kapaktaki ok rozeti: true (varsayılan), false ya da `(project) => node`. */
  arrow?: boolean | ((p: Project) => unknown) | undefined;
  /** Animate the filter change (fade out, glide, default true); false swaps the cards at once. @tr Süzgeç değişimini canlandırır (solma, kayma; varsayılan true); false kartları hemen değiştirir. */
  motion?: boolean | undefined;
  /** Entrance of the cards: Reveal options, or false for none (default: up, one after another). @tr Kartların girişi: Reveal seçenekleri ya da hiç giriş olmaması için false (varsayılan: up, art arda). */
  reveal?: RevealOptions | false | undefined;
  /** Extra CSS class on the root. @tr Köke eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

/** `<ProjectGrid projects={work} onOpen={(p, cover) => sharedTransition(`project-${p.id}`, cover, () => $open = p)} />` */
export function ProjectGrid(props: ProjectGridProps): Element {
  const projects = props.projects ?? []; // the raw component (no projects yet) draws an empty grid
  const cats = [...new Set(projects.map((p) => p.category).filter((c): c is string => !!c))];
  const filter = signal<string | null>(null);
  const cards = projects.map((p) => {
    const cover = h("div", { class: "m-pg-cover", "data-project": p.id, "data-m-shared": `project-${p.id}` },
      h(Picture, { source: p.cover }),
      props.arrow === false ? null : typeof props.arrow === "function"
        ? h(CornerMark, { class: "m-pg-go is-own", size: "lg", variant: "surface", show: "hover" }, props.arrow(p))
        : h(CornerMark, { class: "m-pg-go", size: "lg", variant: "surface", show: "hover", icon: arrowUpRight })) as HTMLElement;
    const open = (e: Event): void => {
      if (props.onOpen) { e.preventDefault(); props.onOpen(p, cover); return; }
      if (props.lightbox !== false && isPicture(p.cover) && !p.href) { e.preventDefault(); void openMedia(p.cover.src, typeof p.title === "string" ? { alt: p.cover.alt, title: p.title } : { alt: p.cover.alt }); }
    };
    const card = h(Card, { as: "article", flush: true, class: "m-pg-card m-corner-host", "data-category": p.category ?? null },
      cover,
      h("div", { class: "m-pg-text" },
        h("h3", { class: "m-pg-title" }, h("a", { href: p.href ?? `#${p.id}`, class: "m-pg-link", onClick: open }, p.title)),
        h("p", { class: "m-pg-meta" }, p.category ?? null, p.category && p.year != null ? " · " : null, p.year ?? null),
        p.summary != null ? h("p", { class: "m-pg-sum" }, p.summary) : null)) as HTMLElement;
    return { p, card };
  });
  const grid = h("div", { class: cx("m-pg-grid", `m-pg-cols-${props.cols ?? 3}`), "aria-live": "polite" }, cards.map((c) => c.card)) as HTMLElement;

  const choose = (c: string | null): void => {
    if (filter.peek() === c) return;
    filter.set(c);
    const match = (x: { p: Project }): boolean => !c || x.p.category === c;
    const leaving = cards.filter((x) => !x.card.hidden && !match(x)).map((x) => x.card);
    const swap = (): void => { for (const x of cards) x.card.hidden = !match(x); };
    if (props.motion === false) { swap(); return; }
    const apply = (): void => flip(cards.filter(match).map((x) => x.card), swap, { duration: 420, easing: "expo" });
    if (!leaving.length || still()) { apply(); return; }
    // hold the faded state until the cards are hidden, then drop the animation (no flash in between)
    const out = animate(leaving, { opacity: [1, 0], transform: ["scale(1)", "scale(.94)"] }, { duration: 180, easing: "in", fill: "forwards" });
    // a newer choice made meanwhile has placed the cards already: only drop the fade
    void out.finished.then(() => { if (filter.peek() === c) apply(); out.cancel(); });
  };
  const chips = props.filters !== false && cats.length > 1
    ? h("div", { class: "m-pg-filters", role: "group", "aria-label": props.filtersLabel ?? t`Filter projects` },
      h(Chip, { selected: () => filter() === null, onClick: () => choose(null) }, () => val(props.allLabel) ?? t`All`),
      cats.map((c) => h(Chip, { selected: () => filter() === c, onClick: () => choose(c) }, c)))
    : null;
  if (props.reveal !== false) owned(revealOnScroll(grid, { effect: "up", stagger: 70, ...props.reveal, select: ".m-pg-card" }));
  return h("div", { class: cx("m-pg", val(props.class)) }, chips, grid) as Element;
}
