// Card. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./display.css";
import "./button.css";
import { h } from "../dom/h.ts";
import { rest, val, cx, type ClassProp } from "./util.ts";
import { type ActionsProp, actionsOf } from "./display-base.ts";

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
    head && h("header", { class: "hm-card-head" },
      h("div", { class: "hm-card-titles" },
        props.title != null && h("h3", { class: "hm-card-title" }, () => val(props.title)),
        props.subtitle != null && h("p", { class: "hm-card-sub" }, () => val(props.subtitle))),
      props.actions != null && h("div", { class: "hm-card-actions" }, actionsOf(() => props.actions))),
    h("div", { class: "hm-card-body" }, props.children),
    props.footer != null && h("footer", { class: "hm-card-foot" }, props.footer));
}
