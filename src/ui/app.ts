// Application chrome: Brand, AuthLayout (sign-in screens), UserMenu, IconTile, LinkCard, Spacer.
// Purely presentational; every style lives in ui.css (no inline styles).
import "./app.css";
import "./button.css";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Link, type Href } from "../router/router.ts";
import { Menu, type MenuItem } from "./menu.ts";
import { Avatar } from "./avatar.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { chevronsUpDown } from "../icons/glyphs/chevronsUpDown.ts";
import { arrowUpRight } from "../icons/glyphs/arrowUpRight.ts";
import { OverflowText } from "./marquee.ts";

export interface BrandProps {
  /** The mark: an icon (march/icons, e.g. one made with defineIcon), text or a node. @tr İşaret: bir ikon (march/icons, ör. defineIcon ile yapılmış), metin ya da bir düğüm. */
  mark?: unknown;
  /** The product name shown next to the mark. @tr İşaretin yanında gösterilen ürün adı. */
  name: MaybeFn<unknown>;
  /** Small second line (product / environment). @tr Küçük ikinci satır (ürün / ortam). */
  sub?: MaybeFn<unknown>;
  /** Makes the lockup a link to this path. @tr Logoyu bu yola giden bir bağlantı yapar. */
  href?: Href;
  /** Size: md (default) or lg. @tr Boyut: md (varsayılan) ya da lg. */
  size?: "md" | "lg";
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: ClassProp;
}
/** Logo lockup: `<Brand mark={logo} name="HADİ" sub="Admin" href="/" />` */
export function Brand(props: BrandProps): Element {
  const inner = [
    props.mark != null && h("span", { class: "m-brand-mark" }, icon(props.mark, "m-brand-glyph")),
    h("span", { class: "m-brand-text" },
      h("span", { class: "m-brand-name" }, () => val(props.name)),
      props.sub != null && h("span", { class: "m-brand-sub" }, () => val(props.sub))),
  ];
  const cls = (): string => cx("m-brand", props.size === "lg" && "m-brand-lg", val(props.class));
  return props.href ? h(Link, { href: props.href, class: cls, children: inner }) as Element : h("span", { class: cls }, ...inner);
}

export interface AuthLayoutProps {
  /** The brand (usually a `<Brand>`), shown above the form and on the showcase side. @tr Marka (genelde bir `<Brand>`); formun üstünde ve vitrin tarafında gösterilir. */
  brand?: unknown;
  /** The form column's heading. @tr Form sütununun başlığı. */
  title?: MaybeFn<unknown>;
  /** A short line under the title. @tr Başlığın altındaki kısa satır. */
  subtitle?: MaybeFn<unknown>;
  /** Showcase side (wide screens): a headline, a short pitch and highlight rows. @tr Vitrin tarafı (geniş ekranlarda): bir manşet, kısa bir tanıtım ve öne çıkan satırlar. */
  aside?: { headline?: unknown; text?: unknown; points?: readonly { icon?: unknown; title: unknown; text?: unknown }[]; foot?: unknown };
  /** Content under the form (links, legal text). @tr Formun altındaki içerik (bağlantılar, yasal metin). */
  footer?: unknown;
  /** Extra CSS classes on the root. @tr Köke eklenen ek CSS sınıfları. */
  class?: ClassProp;
  /** The form. @tr Form. */
  children?: unknown;
}
/**
 * Split sign-in screen: a branded showcase panel (gradient mesh, grid, highlights) and a focused form column.
 * `<AuthLayout brand={<Brand …/>} title="Sign in" subtitle="…" aside={{ headline, text, points }}>…form…</AuthLayout>`
 */
export function AuthLayout(props: AuthLayoutProps): Element {
  const a = props.aside;
  return h("main", { class: () => cx("m-auth", a && "m-auth-split", val(props.class)) },
    a && h("aside", { class: "m-auth-aside", "aria-hidden": "false" },
      h("div", { class: "m-auth-mesh", "aria-hidden": "true" }),
      h("div", { class: "m-auth-grid", "aria-hidden": "true" }),
      h("div", { class: "m-auth-aside-inner" },
        props.brand != null && h("div", { class: "m-auth-aside-brand" }, props.brand),
        h("div", { class: "m-auth-pitch" },
          a.headline != null && h("h2", { class: "m-auth-headline" }, a.headline),
          a.text != null && h("p", { class: "m-auth-text" }, a.text),
          a.points?.length ? h("ul", { class: "m-auth-points" }, a.points.map((p) => h("li", { class: "m-auth-point" },
            p.icon != null && h("span", { class: "m-auth-point-icon" }, icon(p.icon)),
            h("span", {}, h("strong", {}, p.title), p.text != null && h("span", { class: "m-auth-point-text" }, p.text))))) : null),
        a.foot != null && h("div", { class: "m-auth-aside-foot" }, a.foot))),
    h("section", { class: "m-auth-main" },
      h("div", { class: "m-auth-panel" },
        props.brand != null && h("div", { class: "m-auth-brand" }, props.brand),
        (props.title != null || props.subtitle != null) && h("header", { class: "m-auth-head" },
          props.title != null && h("h1", { class: "m-auth-title" }, () => val(props.title)),
          props.subtitle != null && h("p", { class: "m-auth-sub" }, () => val(props.subtitle))),
        h("div", { class: "m-auth-body" }, props.children),
        props.footer != null && h("footer", { class: "m-auth-foot" }, props.footer))));
}

export interface UserMenuProps {
  /** The user's name: the button text, the avatar's initials and the menu label (default "Account"). @tr Kullanıcının adı: düğme metni, avatarın baş harfleri ve menü etiketi (varsayılan "Account"). */
  name: MaybeFn<string | null | undefined>;
  /** A second line under the name (e.g. the email). @tr Adın altındaki ikinci satır (ör. e-posta). */
  detail?: MaybeFn<string | null | undefined>;
  /** Avatar image URL; without it the initials show. @tr Avatar görselinin URL'si; verilmezse baş harfler gösterilir. */
  avatar?: MaybeFn<string | null | undefined>;
  /** The menu items ("-" for a separator). @tr Menü öğeleri (ayırıcı için "-"). */
  items: MaybeFn<readonly MenuItem[] | null | undefined>;
  /** Only the avatar (narrow places such as an icon rail or a top bar). @tr Yalnız avatar (ikon rayı ya da üst çubuk gibi dar yerler için). */
  compact?: boolean;
  /** Where the menu opens (default top-start). @tr Menünün açıldığı yön (varsayılan top-start). */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  /** Extra CSS classes on the button. @tr Düğmeye eklenen ek CSS sınıfları. */
  class?: ClassProp;
}
/** Account button with a menu: `<UserMenu name="Ada" detail="ada@x.com" items={[profile, "-", signOut]} />` */
export function UserMenu(props: UserMenuProps): unknown {
  return h(Menu, {
    label: () => val(props.name) ?? t`Account`, variant: "ghost", placement: props.placement ?? "top-start", items: props.items,
    class: () => cx("m-user-btn", props.compact && "m-user-btn-compact", val(props.class)),
    trigger: [
      h(Avatar, { name: () => val(props.name) ?? "", src: props.avatar, size: "sm" }),
      !props.compact && h("span", { class: "m-user-text m-rail-hide" },
        h(OverflowText, { class: "m-user-name" }, () => val(props.name) ?? ""),
        props.detail != null && h(OverflowText, { class: "m-user-detail" }, () => val(props.detail) ?? "")),
      !props.compact && h("span", { class: "m-user-chev m-rail-hide", "aria-hidden": "true" }, glyph(chevronsUpDown)),
    ],
  });
}

// IconTile and LinkCard moved to their component folders; this path keeps working for existing imports.
export { IconTile, type IconTileProps, type IconTone } from "../components/data/icon-tile/index.ts";
export { LinkCard, type LinkCardProps } from "../components/navigation/link-card/index.ts";
export { Spacer } from "./spacer.ts";
