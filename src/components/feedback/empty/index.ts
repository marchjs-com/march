// Empty (hadi-march/feedback): an empty state with an icon, a title, a line of text and the next step.
import "./empty.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { isIconDef } from "../../../icons/svg.ts";
import { IconTile } from "../../data/icon-tile/index.ts";
import { type ActionsProp, actionsOf } from "../../../ui/display-base.ts";

export interface EmptyProps {
  /** A node, glyph or emoji shown in a raised tile. @tr Yükseltilmiş bir karoda gösterilen düğüm, glif ya da emoji. */
  icon?: unknown;
  /** "md" (default) or "sm": the compact empty state of a panel, a list or a popup. @tr "md" (varsayılan) ya da "sm": bir panelin, listenin ya da açılır pencerenin sıkışık boş durumu. */
  size?: "sm" | "md" | undefined;
  /** The title; `false` leaves it out (default "Nothing here yet", translated). @tr Başlık; `false` onu çıkarır (varsayılan "Nothing here yet", çevrilir). */
  title?: MaybeFn<string | undefined> | false;
  /** The next step: a node, a list or `action()` objects (drawn as buttons). @tr Sonraki adım: düğüm, liste ya da `action()` nesneleri (düğme olarak çizilir). */
  action?: ActionsProp;
  /** Extra classes on the empty state. @tr Boş duruma eklenen sınıflar. */
  class?: ClassProp;
  /** The explanation. @tr Açıklama. */
  children?: unknown;
}
/** `<Empty icon="📭" title="No users yet" action={…}>Invite someone to get started.</Empty>`, `<Empty size="sm" title="No matches" />` */
export function Empty(props: EmptyProps): Element {
  return h("div", { class: () => cx("m-empty", props.size === "sm" && "m-empty-sm", val(props.class)) },
    // an icon or an emoji sits in a framed IconTile; your own node (an illustration) is placed as it is
    props.icon == null || props.icon === false ? null : isIconDef(props.icon) || typeof props.icon === "string"
      ? h(IconTile, { icon: props.icon, tone: "neutral", variant: "outline", size: props.size === "sm" ? "sm" : "lg", class: "m-empty-icon" }) : props.icon,
    props.title !== false && h("p", { class: "m-empty-title" }, () => val(props.title as MaybeFn<string | undefined>) ?? t`Nothing here yet`),
    props.children != null && h("div", { class: "m-empty-text" }, props.children),
    props.action != null && h("div", { class: "m-empty-action" }, actionsOf(() => props.action)));
}
