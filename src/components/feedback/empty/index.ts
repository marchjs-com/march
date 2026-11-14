// Empty (hadi-march/feedback): an empty state with an icon, a title, a line of text and the next step.
import "./empty.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { isIconDef } from "../../../icons/svg.ts";
import { IconTile } from "../../data/icon-tile/index.ts";
import { type ActionsProp, actionsOf } from "../../../ui/display-base.ts";

export interface EmptyProps { icon?: unknown; /** "md" (default) or "sm": the compact empty state of a panel, a list or a popup. */ size?: "sm" | "md" | undefined; /** The title; `false` leaves it out (default "Nothing here yet", translated). */ title?: MaybeFn<string | undefined> | false; action?: ActionsProp; class?: ClassProp; children?: unknown }
/** `<Empty icon="📭" title="No users yet" action={…}>Invite someone to get started.</Empty>`, `<Empty size="sm" title="No matches" />` */
export function Empty(props: EmptyProps): Element {
  return h("div", { class: () => cx("hm-empty", props.size === "sm" && "hm-empty-sm", val(props.class)) },
    // an icon or an emoji sits in a framed IconTile; your own node (an illustration) is placed as it is
    props.icon == null || props.icon === false ? null : isIconDef(props.icon) || typeof props.icon === "string"
      ? h(IconTile, { icon: props.icon, tone: "neutral", variant: "outline", size: props.size === "sm" ? "sm" : "lg", class: "hm-empty-icon" }) : props.icon,
    props.title !== false && h("p", { class: "hm-empty-title" }, () => val(props.title as MaybeFn<string | undefined>) ?? t`Nothing here yet`),
    props.children != null && h("div", { class: "hm-empty-text" }, props.children),
    props.action != null && h("div", { class: "hm-empty-action" }, actionsOf(() => props.action)));
}
