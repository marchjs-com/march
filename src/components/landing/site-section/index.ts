// SiteSection (hadi-march/landing): the frame of every website block — width, vertical rhythm, a tone (plain, muted,
// inverse, brand) and an optional heading group (eyebrow, title, lead) that enters with Reveal. Blocks put their
// content inside; pages stack sections.
import "./site-section.css";
import { h } from "../../../dom/h.ts";
import { cx, val, uid, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Reveal, type RevealOptions } from "../reveal/index.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export type SectionTone = "plain" | "muted" | "inverse" | "brand";
export interface SiteSectionProps {
  eyebrow?: MaybeFn<unknown> | undefined;
  title?: MaybeFn<unknown> | undefined;
  lead?: MaybeFn<unknown> | undefined;
  /** Heading alignment (default center). */
  align?: "center" | "start" | undefined;
  tone?: SectionTone | undefined;
  /** Content width: narrow 46rem · default 72rem · wide 84rem · full (edge to edge). */
  width?: "narrow" | "default" | "wide" | "full" | undefined;
  /** Vertical padding (default md). */
  space?: "none" | "sm" | "md" | "lg" | undefined;
  /** Heading level for the title (default 2). */
  level?: 1 | 2 | 3 | undefined;
  /** Colour of the section: the eyebrow, the `brand` tone and every accent inside follow it (default: the accent). */
  color?: ColorToken | undefined;
  /** Entrance of the heading group: Reveal options, or false for none (default: up, one after another). */
  reveal?: RevealOptions | false | undefined;
  id?: string | undefined;
  class?: ClassProp | undefined;
  children?: unknown | undefined;
  [attr: string]: unknown;
}

/** `<SiteSection eyebrow="Features" title="Everything you need" lead="…">…</SiteSection>` */
export function SiteSection(props: SiteSectionProps): Element {
  const { eyebrow, title, lead, align, tone, width, space, level, color, reveal, class: c, children, ...attrs } = props;
  const hid = title != null ? uid("hm-ss") : null;
  const head = title != null || eyebrow != null || lead != null
    ? h(Reveal, { class: cx("hm-ss-head", align === "start" && "hm-ss-head-start"), effect: "up", stagger: 90, ...(reveal === false ? { effect: "none" } : reveal) },
      eyebrow != null && h("p", { class: "hm-ss-eyebrow" }, () => val(eyebrow)),
      title != null && h(`h${level ?? 2}`, { class: "hm-ss-title", id: hid }, () => val(title)),
      lead != null && h("p", { class: "hm-ss-lead" }, () => val(lead)))
    : null;
  return h("section", { ...attrs, "aria-labelledby": hid, "data-hm-color": colorAttr(color), class: () => cx("hm-ss", `hm-ss-${tone ?? "plain"}`, `hm-ss-w-${width ?? "default"}`, `hm-ss-s-${space ?? "md"}`, val(c)) },
    h("div", { class: "hm-ss-inner" }, head, children));
}
