// ProjectDetail (hadi-march/landing): the page of one project — a back link, a big title, the facts (role, client, year,
// services as chips), the cover (marked as the shared element, so a ProjectGrid card can grow into it), the story, a
// gallery that opens in the Lightbox, and the next project. Text enters with Reveal.
import "./project-detail.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, glyph, type ClassProp } from "../../../ui/util.ts";
import { Button } from "../../../ui/button.ts";
import { KeyValue } from "../../../ui/key-value.ts";
import { Chip } from "../../chip/index.ts";
import { openMedia } from "../../../ui/media.ts";
import { arrowLeft } from "../../../icons/glyphs/arrowLeft.ts";
import { arrowRight } from "../../../icons/glyphs/arrowRight.ts";
import { Reveal } from "../reveal/index.ts";
import type { Project, ProjectCover } from "../project-grid/index.ts";

export interface ProjectDetails extends Project {
  role?: unknown;
  client?: unknown;
  services?: readonly string[] | undefined;
  /** The story: paragraphs or any nodes. */
  body?: unknown;
  gallery?: readonly (ProjectCover | Node)[] | undefined;
  links?: readonly { label: unknown; href: string }[] | undefined;
}
export interface ProjectDetailProps {
  project: ProjectDetails;
  /** Back to the list (shows the back button). */
  onBack?: (() => void) | undefined;
  /** The next project (a card at the end). */
  next?: { project: Project; onOpen: (p: Project, cover: Element) => void } | undefined;
  /** Shared element name of the cover (default `project-<id>`, the name ProjectGrid gives its covers). */
  shared?: string | undefined;
  class?: ClassProp | undefined;
}

const isCover = (c: unknown): c is ProjectCover => !!c && typeof c === "object" && !(c as Node).nodeType && typeof (c as ProjectCover).src === "string";
const coverNode = (c: ProjectCover | Node, eager = false): unknown => (isCover(c)
  ? h("img", { src: c.src, alt: c.alt, width: c.width, height: c.height, srcset: c.srcset ?? null, sizes: c.sizes ?? null, loading: eager ? null : "lazy", decoding: "async", fetchpriority: eager ? "high" : null })
  : c);

/** `<ProjectDetail project={p} onBack={() => $open = null} next={{ project: n, onOpen }} />` */
export function ProjectDetail(props: ProjectDetailProps): Element {
  const p = props.project;
  const facts = [
    p.role != null && { label: t`Role`, value: p.role },
    p.client != null && { label: t`Client`, value: p.client },
    p.year != null && { label: t`Year`, value: p.year },
    p.category != null && { label: t`Category`, value: p.category },
  ].filter(Boolean) as { label: string; value: unknown }[];
  const nextCover = props.next ? h("div", { class: "hm-pd-next-cover", "data-hm-shared": `project-${props.next.project.id}` }, coverNode(props.next.project.cover)) as HTMLElement : null;
  return h("article", { class: cx("hm-pd", val(props.class)) },
    props.onBack ? h(Button, { variant: "ghost", size: "sm", class: "hm-pd-back", icon: arrowLeft, onClick: () => props.onBack?.() }, t`All projects`) : null,
    h(Reveal, { class: "hm-pd-head", effect: "up", stagger: 80 },
      p.category != null ? h("p", { class: "hm-pd-eyebrow" }, p.category) : null,
      h("h1", { class: "hm-pd-title" }, p.title),
      p.summary != null ? h("p", { class: "hm-pd-lead" }, p.summary) : null),
    h("div", { class: "hm-pd-cover", "data-hm-shared": props.shared ?? `project-${p.id}` }, coverNode(p.cover, true)),
    h("div", { class: "hm-pd-grid" },
      h("aside", { class: "hm-pd-facts" },
        facts.length ? h(KeyValue, { items: facts }) : null,
        p.services?.length ? h("div", { class: "hm-pd-services", "aria-label": t`Services`, role: "list" }, p.services.map((s) => h("span", { role: "listitem" }, h(Chip, { size: "sm" }, s)))) : null,
        p.links?.length ? h("div", { class: "hm-pd-links" }, p.links.map((l) => h(Button, { variant: "secondary", size: "sm", href: l.href as never, iconEnd: arrowRight }, l.label))) : null),
      p.body != null ? h(Reveal, { class: "hm-pd-body", effect: "up" }, p.body) : null),
    p.gallery?.length ? h("div", { class: "hm-pd-gallery" }, p.gallery.map((g, i) => isCover(g)
      ? h("button", { type: "button", class: "hm-pd-shot", "aria-label": () => t`Open image ${i + 1}`, onClick: () => void openMedia(g.src, { alt: g.alt }) }, coverNode(g))
      : h("div", { class: "hm-pd-shot" }, g))) : null,
    props.next ? h("a", { class: "hm-pd-next", href: props.next.project.href ?? `#${props.next.project.id}`, onClick: (e: Event) => { e.preventDefault(); props.next?.onOpen(props.next.project, nextCover as Element); } },
      h("span", { class: "hm-pd-next-text" }, h("span", { class: "hm-pd-next-label" }, t`Next project`), h("span", { class: "hm-pd-next-title" }, props.next.project.title, " ", glyph(arrowRight))),
      nextCover) : null) as Element;
}
