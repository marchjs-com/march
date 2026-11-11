// Application chrome: Brand, AuthLayout (sign-in screens), UserMenu, IconTile, LinkCard, Spacer.
// Purely presentational; every style lives in ui.css (no inline styles).
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Link, type Href } from "../router/index.ts";
import { Menu, type MenuItem } from "./button.ts";
import { Avatar } from "./display.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { chevronsUpDown, arrowUpRight } from "../icons/set.ts";

export interface BrandProps {
  /** The mark: an icon (hadi-march/icons, e.g. one made with defineIcon), text or a node. */
  mark?: unknown;
  name: MaybeFn<unknown>;
  /** Small second line (product / environment). */
  sub?: MaybeFn<unknown>;
  href?: Href;
  size?: "md" | "lg";
  class?: ClassProp;
}
/** Logo lockup: `<Brand mark={logo} name="Acme" sub="Admin" href="/" />` */
export function Brand(props: BrandProps): Element {
  const inner = [
    props.mark != null && h("span", { class: "hm-brand-mark" }, icon(props.mark, "hm-brand-glyph")),
    h("span", { class: "hm-brand-text" },
      h("span", { class: "hm-brand-name" }, () => val(props.name)),
      props.sub != null && h("span", { class: "hm-brand-sub" }, () => val(props.sub))),
  ];
  const cls = (): string => cx("hm-brand", props.size === "lg" && "hm-brand-lg", val(props.class));
  return props.href ? h(Link, { href: props.href, class: cls, children: inner }) as Element : h("span", { class: cls }, ...inner);
}

export interface AuthLayoutProps {
  brand?: unknown;
  title?: MaybeFn<unknown>;
  subtitle?: MaybeFn<unknown>;
  /** Showcase side (wide screens): a headline, a short pitch and highlight rows. */
  aside?: { headline?: unknown; text?: unknown; points?: readonly { icon?: unknown; title: unknown; text?: unknown }[]; foot?: unknown };
  footer?: unknown;
  class?: ClassProp;
  children?: unknown;
}
/**
 * Split sign-in screen: a branded showcase panel (gradient mesh, grid, highlights) and a focused form column.
 * `<AuthLayout brand={<Brand …/>} title="Sign in" subtitle="…" aside={{ headline, text, points }}>…form…</AuthLayout>`
 */
export function AuthLayout(props: AuthLayoutProps): Element {
  const a = props.aside;
  return h("main", { class: () => cx("hm-auth", a && "hm-auth-split", val(props.class)) },
    a && h("aside", { class: "hm-auth-aside", "aria-hidden": "false" },
      h("div", { class: "hm-auth-mesh", "aria-hidden": "true" }),
      h("div", { class: "hm-auth-grid", "aria-hidden": "true" }),
      h("div", { class: "hm-auth-aside-inner" },
        props.brand != null && h("div", { class: "hm-auth-aside-brand" }, props.brand),
        h("div", { class: "hm-auth-pitch" },
          a.headline != null && h("h2", { class: "hm-auth-headline" }, a.headline),
          a.text != null && h("p", { class: "hm-auth-text" }, a.text),
          a.points?.length ? h("ul", { class: "hm-auth-points" }, a.points.map((p) => h("li", { class: "hm-auth-point" },
            p.icon != null && h("span", { class: "hm-auth-point-icon" }, icon(p.icon)),
            h("span", {}, h("strong", {}, p.title), p.text != null && h("span", { class: "hm-auth-point-text" }, p.text))))) : null),
        a.foot != null && h("div", { class: "hm-auth-aside-foot" }, a.foot))),
    h("section", { class: "hm-auth-main" },
      h("div", { class: "hm-auth-panel" },
        props.brand != null && h("div", { class: "hm-auth-brand" }, props.brand),
        (props.title != null || props.subtitle != null) && h("header", { class: "hm-auth-head" },
          props.title != null && h("h1", { class: "hm-auth-title" }, () => val(props.title)),
          props.subtitle != null && h("p", { class: "hm-auth-sub" }, () => val(props.subtitle))),
        h("div", { class: "hm-auth-body" }, props.children),
        props.footer != null && h("footer", { class: "hm-auth-foot" }, props.footer))));
}

export interface UserMenuProps {
  name: MaybeFn<string | null | undefined>;
  detail?: MaybeFn<string | null | undefined>;
  avatar?: MaybeFn<string | null | undefined>;
  items: MaybeFn<readonly MenuItem[] | null | undefined>;
  /** Only the avatar (narrow places such as an icon rail or a top bar). */
  compact?: boolean;
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  class?: ClassProp;
}
/** Account button with a menu: `<UserMenu name="Ada" detail="ada@x.com" items={[profile, "-", signOut]} />` */
export function UserMenu(props: UserMenuProps): unknown {
  return h(Menu, {
    label: () => val(props.name) ?? t`Account`, variant: "ghost", placement: props.placement ?? "top-start", items: props.items,
    class: () => cx("hm-user-btn", props.compact && "hm-user-btn-compact", val(props.class)),
    trigger: [
      h(Avatar, { name: () => val(props.name) ?? "", src: props.avatar, size: "sm" }),
      !props.compact && h("span", { class: "hm-user-text hm-rail-hide" },
        h("span", { class: "hm-user-name" }, () => val(props.name) ?? ""),
        props.detail != null && h("span", { class: "hm-user-detail" }, () => val(props.detail) ?? "")),
      !props.compact && h("span", { class: "hm-user-chev hm-rail-hide", "aria-hidden": "true" }, glyph(chevronsUpDown)),
    ],
  });
}

export type IconTone = "primary" | "neutral" | "success" | "warn" | "danger" | "info" | "violet" | "pink" | "teal";
export interface IconTileProps { icon: unknown; tone?: MaybeFn<IconTone | undefined>; size?: "sm" | "md" | "lg"; class?: ClassProp }
/** An icon in a tinted rounded square: `<IconTile icon={users} tone="primary" />` */
export function IconTile(props: IconTileProps): Element {
  return h("span", { class: () => cx("hm-icon-tile", `hm-tile-${val(props.tone) ?? "primary"}`, `hm-icon-tile-${props.size ?? "md"}`, val(props.class)), "aria-hidden": "true" }, icon(props.icon, "hm-icon"));
}

export interface LinkCardProps {
  href: Href;
  title: MaybeFn<unknown>;
  description?: MaybeFn<unknown>;
  icon?: unknown;
  tone?: MaybeFn<IconTone | undefined>;
  /** Small text on the right (a count, a status). */
  meta?: MaybeFn<unknown>;
  class?: ClassProp;
}
/** A navigational card: `<LinkCard href="/users" icon={users} title="Members" description="Search and manage" />` */
export function LinkCard(props: LinkCardProps): Element {
  return h(Link, {
    href: props.href, class: () => cx("hm-link-card", val(props.class)),
    children: [
      props.icon != null && h(IconTile, { icon: props.icon, tone: props.tone }),
      h("span", { class: "hm-link-card-text" },
        h("span", { class: "hm-link-card-title" }, () => val(props.title)),
        props.description != null && h("span", { class: "hm-link-card-desc" }, () => val(props.description))),
      props.meta != null && h("span", { class: "hm-link-card-meta" }, () => val(props.meta)),
      h("span", { class: "hm-link-card-arrow", "aria-hidden": "true" }, glyph(arrowUpRight)),
    ],
  }) as Element;
}

/** Flexible gap in a row (pushes the following items to the end). */
export function Spacer(_props: Record<string, never> = {}): Element {
  return h("span", { class: "hm-spacer", "aria-hidden": "true" });
}
