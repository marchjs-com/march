// hadi-march/icons — the HADI March icon set and <Icon>. Every icon is its own export (tree-shaken):
//   import { Icon, users, search } from "hadi-march/icons";
//   <Icon of={users} />            decorative, inherits the text color and font size (1.25em by default)
//   <Icon of={search} label="Search" size="lg" />
// Components that take an `icon` prop (Button, NavMenu items, Empty, Card, Stat…) accept an icon directly: icon={users}.
import { svgIcon, type IconDef } from "./svg.ts";

export { svgIcon, defineIcon, isIconDef } from "./svg.ts";
export type { IconDef } from "./svg.ts";
export * from "./set.ts";

export interface IconProps {
  of: IconDef;
  /** "xs" 12px · "sm" 14px · "md" 16px (default) · "lg" 20px · "xl" 24px — or inherit with "em". */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "em";
  /** Accessible name; without it the icon is decorative. */
  label?: string;
  class?: string;
}

/** `<Icon of={users} size="lg" />` */
export function Icon(props: IconProps): SVGSVGElement {
  const cls = ["hm-svg", `hm-svg-${props.size ?? "md"}`, props.class].filter(Boolean).join(" ");
  return svgIcon(props.of, cls, props.label);
}
