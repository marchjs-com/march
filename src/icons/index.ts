// hadi-march/icons — the March icon set and <Icon>. Every icon is its own export (tree-shaken):
//   import { Icon, users, search } from "hadi-march/icons";
//   <Icon of={users} />            decorative, inherits the text color and font size (1.25em by default)
//   <Icon of={search} label="Search" size="lg" />
// Components that take an `icon` prop (Button, NavMenu items, Empty, Card, Stat…) accept an icon directly: icon={users}.
import { effect } from "../core/reactive.ts";
import { paintIcon, type IconDef } from "./svg.ts";

export { svgIcon, paintIcon, defineIcon, isIconDef } from "./svg.ts";
export type { IconDef } from "./svg.ts";
export * from "./all.ts";

export interface IconProps {
  /** The icon to draw (e.g. `users` from hadi-march/icons). @tr Çizilecek ikon (ör. hadi-march/icons'tan `users`). */
  of: IconDef;
  /** "xs" 12px · "sm" 14px · "md" 16px (default) · "lg" 20px · "xl" 24px — or inherit with "em". @tr "xs" 12px · "sm" 14px · "md" 16px (varsayılan) · "lg" 20px · "xl" 24px — ya da "em" ile yazı boyutunu alır. */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "em";
  /** Accessible name; without it the icon is decorative. @tr Erişilebilir ad; verilmezse ikon süs amaçlı sayılır. */
  label?: string;
  /** Extra CSS classes on the <svg>. @tr <svg>'ye eklenen ek CSS sınıfları. */
  class?: string;
}

/** `<Icon of={users} size="lg" />` — props may be live (`size={$size}`): the same <svg> repaints in place. */
export function Icon(props: IconProps): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  effect(() => { paintIcon(svg, props.of, ["m-svg", `m-svg-${props.size ?? "md"}`, props.class].filter(Boolean).join(" "), props.label); });
  return svg;
}
