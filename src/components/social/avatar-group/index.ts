// AvatarGroup (hadi-march/social): overlapping avatars and a "+N" bubble for the people that do not fit. Every part is
// yours: the accessible name, the bubble (off, or your own content), the spacing, a colour and a shape for all avatars.
import "./avatar-group.css";
import { untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { Avatar, type AvatarSize } from "../avatar/index.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** One person of an AvatarGroup: a name, or a name with a picture and a colour. */
export type AvatarPerson = string | { name: string; src?: string | undefined; color?: ColorToken | undefined };
export interface AvatarGroupProps {
  names: MaybeFn<readonly AvatarPerson[]>;
  /** Avatars shown before "+N" (default 4). */
  max?: MaybeFn<number | undefined>;
  size?: MaybeFn<AvatarSize | undefined>;
  /** Accessible name of the group (default "N people"). */
  label?: MaybeFn<string | undefined> | ((count: number) => string);
  /** The "+N" bubble: true (default), false, or `(rest) => content`. */
  more?: boolean | ((rest: number) => unknown) | undefined;
  /** "overlap" (default) or "gap": avatars side by side. */
  spacing?: MaybeFn<"overlap" | "gap" | undefined>;
  /** One theme colour for every avatar (a person's own `color` wins). */
  color?: MaybeFn<ColorToken | undefined>;
  shape?: MaybeFn<"circle" | "square" | undefined>;
  class?: ClassProp;
}
/** Overlapping avatars with "+N": `<AvatarGroup names={["Ada", "Linus", …]} max={4} />` */
export function AvatarGroup(props: AvatarGroupProps): Element {
  const label = (): string => {
    const n = val(props.names).length, l = props.label;
    return (typeof l === "function" && l.length ? (l as (n: number) => string)(n) : val(l as MaybeFn<string | undefined>)) ?? t`${n} people`;
  };
  return h("span", { class: () => cx("hm-avatars", val(props.spacing) === "gap" && "hm-avatars-gap", val(props.class)), role: "group", "aria-label": label }, () => {
    const list = val(props.names), max = val(props.max) ?? 4, shown = list.slice(0, max), rest = list.length - shown.length;
    const size = val(props.size) ?? "sm", color = val(props.color), shape = val(props.shape);
    return untrack(() => [
      ...shown.map((n) => (typeof n === "string" ? h(Avatar, { name: n, size, color, shape }) : h(Avatar, { name: n.name, src: n.src, size, color: n.color ?? color, shape }))),
      rest > 0 && props.more !== false && (typeof props.more === "function"
        ? h(Avatar, { size, shape, class: "hm-avatar-more", label: `+${rest}` }, props.more(rest))
        : h(Avatar, { size, shape, class: "hm-avatar-more", text: `+${rest}` })),
    ]);
  });
}
