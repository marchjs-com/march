// Card (hadi-march/ui). Folder: src/components/data/card/.
import "./card.css";
import { h } from "../../../dom/h.ts";
import { rest, val, cx, type ClassProp } from "../../../ui/util.ts";
import { type ActionsProp, actionsOf } from "../../../ui/display-base.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";

export interface CardProps {
  title?: unknown;
  subtitle?: unknown;
  actions?: ActionsProp;
  footer?: unknown;
  /** Root tag (default "section"). */
  as?: string;
  /** No body padding. */
  flush?: boolean;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/** `<Card title="…" subtitle="…" actions={[edit]} footer={…}>…</Card>` */
export function Card(props: CardProps): Element {
  const head = props.title != null || props.actions != null || props.subtitle != null;
  return h(props.as ?? "section", { ...rest(props, ["title", "subtitle", "actions", "footer", "as", "flush"]), class: () => cx("hm-card", props.flush && "hm-card-flush", val(props.class)) },
    // the head is a PanelHeader; the card's own class names stay on its parts
    head && h(PanelHeader, {
      class: "hm-card-head", size: "lg", align: "start", divider: () => props.flush,
      title: props.title != null ? () => val(props.title) : undefined, subtitle: props.subtitle != null ? () => val(props.subtitle) : undefined,
      actions: props.actions != null ? actionsOf(() => props.actions) : undefined,
      partClass: { titles: "hm-card-titles", title: "hm-card-title", subtitle: "hm-card-sub", actions: "hm-card-actions" },
    }),
    h("div", { class: "hm-card-body" }, props.children),
    props.footer != null && h("footer", { class: "hm-card-foot" }, props.footer));
}
