// Card (march/ui). Folder: src/components/data/card/.
import "./card.css";
import { h } from "../../../dom/h.ts";
import { rest, val, cx, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { type ActionsProp, actionsOf } from "../../../ui/display-base.ts";
import { PanelHeader } from "../../layout/panel-header/index.ts";

export interface CardProps {
  /** Heading in the card's header. @tr Kartın başlığındaki başlık. */
  title?: unknown;
  /** Smaller line under the title. @tr Başlığın altındaki küçük satır. */
  subtitle?: unknown;
  /** Actions or nodes at the right of the header (action() objects become buttons). @tr Başlığın sağındaki eylemler ya da düğümler (action() nesneleri düğme olur). */
  actions?: ActionsProp;
  /** Content of the footer strip under the body. @tr Gövdenin altındaki alt şeridin içeriği. */
  footer?: unknown;
  /** Root tag (default "section"). @tr Kök etiketi (varsayılan "section"). */
  as?: string;
  /** No body padding. @tr Gövdede iç boşluk yok. */
  flush?: boolean;
  /** No frame (background, border, radius, shadow): the card structure alone, for a list of posts or a bare layout. @tr Çerçeve yok (arka plan, kenarlık, köşe yuvarlaklığı, gölge): yalnız kart yapısı; gönderi listesi ya da sade bir düzen için. */
  plain?: MaybeFn<boolean | undefined>;
  /** Extra CSS classes on the card. @tr Karta eklenen CSS sınıfları. */
  class?: ClassProp;
  /** The card body. @tr Kartın gövdesi. */
  children?: unknown;
  [attr: string]: unknown;
}
/** `<Card title="…" subtitle="…" actions={[edit]} footer={…}>…</Card>` */
export function Card(props: CardProps): Element {
  const head = props.title != null || props.actions != null || props.subtitle != null;
  return h(props.as ?? "section", { ...rest(props, ["title", "subtitle", "actions", "footer", "as", "flush", "plain"]), class: () => cx("m-card", props.flush && "m-card-flush", val(props.plain) && "m-card-plain", val(props.class)) },
    // the head is a PanelHeader; the card's own class names stay on its parts
    head && h(PanelHeader, {
      class: "m-card-head", size: "lg", align: "start", divider: () => props.flush,
      title: props.title != null ? () => val(props.title) : undefined, subtitle: props.subtitle != null ? () => val(props.subtitle) : undefined,
      actions: props.actions != null ? actionsOf(() => props.actions) : undefined,
      partClass: { titles: "m-card-titles", title: "m-card-title", subtitle: "m-card-sub", actions: "m-card-actions" },
    }),
    h("div", { class: "m-card-body" }, props.children),
    props.footer != null && h("footer", { class: "m-card-foot" }, props.footer));
}
