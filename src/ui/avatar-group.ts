// AvatarGroup (hadi-march/ui).
import "./avatar-group.css";
import "./display.css";
import { untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Avatar } from "./display.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";
import { more } from "../icons/set.ts";

export interface AvatarGroupProps { names: MaybeFn<readonly (string | { name: string; src?: string })[]>; max?: number; size?: "sm" | "md" | "lg"; class?: ClassProp }
/** Overlapping avatars with "+N": `<AvatarGroup names={["Ada", "Linus", …]} max={4} />` */
export function AvatarGroup(props: AvatarGroupProps): Element {
  return h("span", { class: () => cx("hm-avatars", val(props.class)), role: "group", "aria-label": () => t`${val(props.names).length} people` }, () => {
    const list = val(props.names), max = props.max ?? 4, shown = list.slice(0, max), rest = list.length - shown.length;
    return untrack(() => [
      ...shown.map((n) => (typeof n === "string" ? h(Avatar, { name: n, size: props.size ?? "sm" }) : h(Avatar, { name: n.name, src: n.src, size: props.size ?? "sm" }))),
      rest > 0 && h("span", { class: cx("hm-avatar", `hm-avatar-${props.size ?? "sm"}`, "hm-avatar-more") }, `+${rest}`),
    ]);
  });
}
