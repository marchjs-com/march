// Empty (hadi-march/feedback): an empty state with an icon, a title, a line of text and the next step.
import "./empty.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { type ActionsProp, actionsOf } from "../../../ui/display-base.ts";

export interface EmptyProps { icon?: unknown; title?: MaybeFn<string | undefined>; action?: ActionsProp; class?: ClassProp; children?: unknown }
/** `<Empty icon="📭" title="No users yet" action={…}>Invite someone to get started.</Empty>` */
export function Empty(props: EmptyProps): Element {
  return h("div", { class: () => cx("hm-empty", val(props.class)) },
    icon(props.icon, "hm-empty-icon"),
    h("p", { class: "hm-empty-title" }, () => val(props.title) ?? t`Nothing here yet`),
    props.children != null && h("div", { class: "hm-empty-text" }, props.children),
    props.action != null && h("div", { class: "hm-empty-action" }, actionsOf(() => props.action)));
}
