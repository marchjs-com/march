// SiteFooter (hadi-march/landing): the end of a website — brand and a short line about the product, link columns,
// social links, an optional Newsletter and a bottom row (copyright, legal links, a "back to top" button). Columns fold to
// two per row on tablets and stack on phones. An optional big wordmark fills the last line (a modern touch).
import "./site-footer.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, icon, glyph, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Brand, type BrandProps } from "../../../ui/app.ts";
import { IconButton } from "../../../ui/button.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { Newsletter, type NewsletterProps } from "../newsletter/index.ts";

export interface FooterLink { label: unknown; href: string }
export interface FooterColumn { title: unknown; links: readonly FooterLink[] }
export interface FooterSocial { label: string; href: string; icon: unknown }
export interface SiteFooterProps {
  brand: BrandProps | Node;
  about?: MaybeFn<unknown> | undefined;
  columns?: readonly FooterColumn[] | undefined;
  social?: readonly FooterSocial[] | undefined;
  newsletter?: NewsletterProps | undefined;
  /** Bottom start (default "© <year> <brand name>"); false for none. */
  copyright?: MaybeFn<unknown> | false | undefined;
  legal?: readonly FooterLink[] | undefined;
  /** A large wordmark across the bottom (text or your own node). */
  wordmark?: unknown | undefined;
  /** "Back to top" button (default true). */
  toTop?: boolean | undefined;
  /** Icon of the "back to top" button (default: an arrow up). */
  toTopIcon?: unknown | undefined;
  /** Accessible name of the "back to top" button (default "Back to top"). */
  toTopLabel?: string | undefined;
  class?: ClassProp | undefined;
}

/** `<SiteFooter brand={{ name: "HADİ" }} columns={[{ title: "Product", links: [{ label: "Pricing", href: "/pricing" }] }]} />` */
export function SiteFooter(props: SiteFooterProps): Element {
  const isNode = (props.brand as Node).nodeType != null;
  const name = isNode ? "" : String(val((props.brand as BrandProps).name) ?? "");
  const year = new Date().getFullYear();
  return h("footer", { class: cx("hm-sfoot", val(props.class)) },
    h("div", { class: "hm-sfoot-inner" },
      h("div", { class: "hm-sfoot-top" },
        h("div", { class: "hm-sfoot-about" },
          isNode ? props.brand : h(Brand, props.brand as BrandProps),
          props.about != null && h("p", { class: "hm-sfoot-text" }, () => val(props.about)),
          props.social?.length ? h("ul", { class: "hm-sfoot-social" }, props.social.map((s) => h("li", {}, h("a", { href: s.href, "aria-label": s.label, title: s.label, class: "hm-sfoot-social-link", rel: "noopener" }, icon(s.icon))))) : null),
        (props.columns ?? []).map((c) => h("nav", { class: "hm-sfoot-col", "aria-label": typeof c.title === "string" ? c.title : null },
          h("h3", { class: "hm-sfoot-col-title" }, c.title),
          h("ul", {}, c.links.map((l) => h("li", {}, h("a", { href: l.href, class: "hm-sfoot-link" }, l.label)))))),
        props.newsletter ? h("div", { class: "hm-sfoot-news" }, h(Newsletter, { layout: "stacked", ...props.newsletter })) : null),
      h("div", { class: "hm-sfoot-bottom" },
        props.copyright !== false && h("p", { class: "hm-sfoot-copy" }, () => val(props.copyright) ?? `© ${year} ${name}`.trim()),
        props.legal?.length ? h("ul", { class: "hm-sfoot-legal" }, props.legal.map((l) => h("li", {}, h("a", { href: l.href, class: "hm-sfoot-link" }, l.label)))) : null,
        props.toTop !== false && h(IconButton, { class: "hm-sfoot-top-btn", variant: "ghost", size: "sm", label: () => props.toTopLabel ?? t`Back to top`, onClick: () => globalThis.scrollTo?.({ top: 0, behavior: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }) }, props.toTopIcon != null ? icon(props.toTopIcon) : glyph(arrowUp))),
      props.wordmark ? h("p", { class: "hm-sfoot-mark", "aria-hidden": "true" }, props.wordmark) : null));
}
