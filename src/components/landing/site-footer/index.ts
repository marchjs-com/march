// SiteFooter (march/landing): the end of a website — brand and a short line about the product, link columns,
// social links, an optional Newsletter and a bottom row (copyright, legal links, a "back to top" button). Columns fold to
// two per row on tablets and stack on phones. An optional big wordmark fills the last line (a modern touch).
import "./site-footer.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Brand, type BrandProps } from "../../../ui/app.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { Newsletter, type NewsletterProps } from "../newsletter/index.ts";

export interface FooterLink { label: unknown; href: string }
export interface FooterColumn { title: unknown; links: readonly FooterLink[] }
export interface FooterSocial { label: string; href: string; icon: unknown }
export interface SiteFooterProps {
  /** The brand: Brand props or your own node. @tr Marka: Brand özellikleri ya da kendi düğümünüz. */
  brand: BrandProps | Node;
  /** Short line under the brand. @tr Markanın altındaki kısa satır. */
  about?: MaybeFn<unknown> | undefined;
  /** Link columns: `{ title, links: { label, href }[] }`. @tr Bağlantı sütunları: `{ title, links: { label, href }[] }`. */
  columns?: readonly FooterColumn[] | undefined;
  /** Icon links `{ label, href, icon }`; the label is the accessible name. @tr İkon bağlantıları `{ label, href, icon }`; label erişilebilir addır. */
  social?: readonly FooterSocial[] | undefined;
  /** Newsletter props; adds the sign-up form. @tr Newsletter özellikleri; kayıt formunu ekler. */
  newsletter?: NewsletterProps | undefined;
  /** Bottom start (default "© <year> <brand name>"); false for none. @tr Alt başlangıç (varsayılan "© <yıl> <marka adı>"); hiçbiri için false. */
  copyright?: MaybeFn<unknown> | false | undefined;
  /** Bottom links `{ label, href }` (privacy, terms…). @tr Alttaki bağlantılar `{ label, href }` (gizlilik, koşullar…). */
  legal?: readonly FooterLink[] | undefined;
  /** A large wordmark across the bottom (text or your own node). @tr Altta boydan boya büyük bir yazı (metin ya da kendi düğümünüz). */
  wordmark?: unknown | undefined;
  /** "Back to top" button (default true). @tr "Back to top" düğmesi (varsayılan true). */
  toTop?: boolean | undefined;
  /** Icon of the "back to top" button (default: an arrow up). @tr "Back to top" düğmesinin ikonu (varsayılan: yukarı ok). */
  toTopIcon?: unknown | undefined;
  /** Accessible name of the "back to top" button (default "Back to top"). @tr "Back to top" düğmesinin erişilebilir adı (varsayılan "Back to top"). */
  toTopLabel?: string | undefined;
  /** Extra CSS class on the footer. @tr Alt bilgiye eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

/** `<SiteFooter brand={{ name: "HADİ" }} columns={[{ title: "Product", links: [{ label: "Pricing", href: "/pricing" }] }]} />` */
export function SiteFooter(props: SiteFooterProps): Element {
  const isNode = (props.brand as Node).nodeType != null;
  const name = isNode ? "" : String(val((props.brand as BrandProps).name) ?? "");
  const year = new Date().getFullYear();
  return h("footer", { class: cx("m-sfoot", val(props.class)) },
    h("div", { class: "m-sfoot-inner" },
      h("div", { class: "m-sfoot-top" },
        h("div", { class: "m-sfoot-about" },
          isNode ? props.brand : h(Brand, props.brand as BrandProps),
          props.about != null && h("p", { class: "m-sfoot-text" }, () => val(props.about)),
          props.social?.length ? h("ul", { class: "m-sfoot-social" }, props.social.map((s) => h("li", {}, h(IconButton, { href: s.href as never, label: s.label, icon: s.icon, shape: "round", class: "m-sfoot-social-link", rel: "noopener" })))) : null),
        (props.columns ?? []).map((c) => h("nav", { class: "m-sfoot-col", "aria-label": typeof c.title === "string" ? c.title : null },
          h("h3", { class: "m-sfoot-col-title" }, c.title),
          h("ul", {}, c.links.map((l) => h("li", {}, h("a", { href: l.href, class: "m-sfoot-link" }, l.label)))))),
        props.newsletter ? h("div", { class: "m-sfoot-news" }, h(Newsletter, { layout: "stacked", ...props.newsletter })) : null),
      h("div", { class: "m-sfoot-bottom" },
        props.copyright !== false && h("p", { class: "m-sfoot-copy" }, () => val(props.copyright) ?? `© ${year} ${name}`.trim()),
        props.legal?.length ? h("ul", { class: "m-sfoot-legal" }, props.legal.map((l) => h("li", {}, h("a", { href: l.href, class: "m-sfoot-link" }, l.label)))) : null,
        props.toTop !== false && h(IconButton, { class: "m-sfoot-top-btn", size: "sm", icon: props.toTopIcon ?? arrowUp, label: () => props.toTopLabel ?? t`Back to top`, onClick: () => globalThis.scrollTo?.({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" }) })),
      props.wordmark ? h("p", { class: "m-sfoot-mark", "aria-hidden": "true" }, props.wordmark) : null));
}
