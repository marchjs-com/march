// ProjectDetail (hadi-march/landing): the page of one project — a back link, a big title, the facts (role, client, year,
// services as chips), the cover (marked as the shared element, so a ProjectGrid card can grow into it), the story, a
// gallery that opens in the Lightbox, and the next project. Text enters with Reveal.
import "./project-detail.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { Button } from "../../../ui/button.ts";
import { KeyValue } from "../../../ui/key-value.ts";
import { Chip } from "../../actions/chip/index.ts";
import { openMedia } from "../../../ui/media.ts";
import { Picture, isPicture } from "../../media/picture/index.ts";
import { arrowLeft } from "../../../icons/glyphs/arrowLeft.ts";
import { arrowRight } from "../../../icons/glyphs/arrowRight.ts";
import { Reveal, type RevealOptions } from "../reveal/index.ts";
import { SectionHead } from "../section-head/index.ts";
import { type ColorToken } from "../../../theme/colors.ts";
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
  /** The category line above the title (default true). */
  eyebrow?: boolean | undefined;
  /** The facts list (role, client, year, category; default true). */
  facts?: boolean | undefined;
  /** Icon of the back button: an icon, or false for none (default: an arrow). */
  backIcon?: unknown | undefined;
  /** Icon after the next project's title: an icon or a node, or false for none (default: an arrow). */
  nextIcon?: unknown | undefined;
  /** Entrance of the heading and the story: Reveal options, or false for none. */
  reveal?: RevealOptions | false | undefined;
  /** Own texts; every one defaults to the built-in translated text. */
  labels?: {
    back?: unknown; next?: unknown; role?: unknown; client?: unknown; year?: unknown; category?: unknown;
    /** Accessible name of the services list. */
    services?: string | undefined;
    /** Accessible name of a gallery image (n starts at 1). */
    openImage?: ((n: number) => string) | undefined;
  } | undefined;
  class?: ClassProp | undefined;
}

// a cover is a picture object or a ready node (Picture draws both); the main cover is on the first screen
const coverNode = (c: ProjectCover | Node, eager = false): unknown => h(Picture, { source: c, loading: eager ? "eager" : undefined });

/** `<ProjectDetail project={p} onBack={() => $open = null} next={{ project: n, onOpen }} />` */
export function ProjectDetail(props: ProjectDetailProps): Element {
  const p = props.project;
  const L = props.labels ?? {};
  const facts = (props.facts === false ? [] : [
    p.role != null && { label: L.role ?? t`Role`, value: p.role },
    p.client != null && { label: L.client ?? t`Client`, value: p.client },
    p.year != null && { label: L.year ?? t`Year`, value: p.year },
    p.category != null && { label: L.category ?? t`Category`, value: p.category },
  ]).filter(Boolean) as { label: string; value: unknown }[];
  // a block that enters with Reveal, or a plain one with `reveal={false}`
  const box = (cls: string, opts: RevealOptions, ...kids: unknown[]): unknown =>
    (props.reveal === false ? h("div", { class: cls }, kids) : h(Reveal, { class: cls, ...opts, ...props.reveal }, kids));
  const nextIcon = ownIcon(props.nextIcon, arrowRight);
  const nextCover = props.next ? h("div", { class: "m-pd-next-cover", "data-m-shared": `project-${props.next.project.id}` }, coverNode(props.next.project.cover)) as HTMLElement : null;
  return h("article", { class: cx("m-pd", val(props.class)) },
    props.onBack ? h(Button, { variant: "ghost", size: "sm", class: "m-pd-back", icon: props.backIcon === false ? undefined : props.backIcon ?? arrowLeft, onClick: () => props.onBack?.() }, L.back ?? t`All projects`) : null,
    h(SectionHead, {
      class: "m-pd-head", size: "xl", align: "start", as: "h1", eyebrow: p.category != null && props.eyebrow !== false ? p.category : undefined,
      title: p.title, lead: p.summary ?? undefined, reveal: props.reveal === false ? false : { effect: "up", stagger: 80, ...props.reveal },
    }),
    h("div", { class: "m-pd-cover", "data-m-shared": props.shared ?? `project-${p.id}` }, coverNode(p.cover, true)),
    h("div", { class: "m-pd-grid" },
      h("aside", { class: "m-pd-facts" },
        facts.length ? h(KeyValue, { items: facts }) : null,
        p.services?.length ? h("div", { class: "m-pd-services", "aria-label": L.services ?? t`Services`, role: "list" }, p.services.map((s) => h("span", { role: "listitem" }, h(Chip, { size: "sm" }, s)))) : null,
        p.links?.length ? h("div", { class: "m-pd-links" }, p.links.map((l) => h(Button, { variant: "secondary", size: "sm", href: l.href as never, iconEnd: arrowRight }, l.label))) : null),
      p.body != null ? box("m-pd-body", { effect: "up" }, p.body) : null),
    p.gallery?.length ? h("div", { class: "m-pd-gallery" }, p.gallery.map((g, i) => isPicture(g)
      ? h("button", { type: "button", class: "m-pd-shot", "aria-label": () => (L.openImage ? L.openImage(i + 1) : t`Open image ${i + 1}`), onClick: () => void openMedia(g.src, { alt: g.alt ?? "" }) }, coverNode(g))
      : h("div", { class: "m-pd-shot" }, g))) : null,
    props.next ? h("a", { class: "m-pd-next", href: props.next.project.href ?? `#${props.next.project.id}`, onClick: (e: Event) => { e.preventDefault(); props.next?.onOpen(props.next.project, nextCover as Element); } },
      h("span", { class: "m-pd-next-text" }, h("span", { class: "m-pd-next-label" }, L.next ?? t`Next project`), h("span", { class: "m-pd-next-title" }, props.next.project.title, " ", nextIcon)),
      nextCover) : null) as Element;
}
