// RowTools (march/forms): the tools of one row in an editable list: move up, move down, remove. Built from
// IconButton. Give the row's `index` and the list's `count` and the arrows switch off at the ends. Which tools show
// (`actions`), their names, icons, size and colour are yours.
import "./row-tools.css";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { IconButton, type IconButtonSize } from "../../actions/icon-button/index.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { arrowDown } from "../../../icons/glyphs/arrowDown.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { ownPart } from "../../../ui/parts.ts";
import tr from "./tr.ts";
import { withColor } from "../../../theme/colors.ts";

messages("tr", tr);

export type RowAction = "up" | "down" | "remove";
const ALL: readonly RowAction[] = ["up", "down", "remove"];

export interface RowToolsProps {
  /** Which tools, in this order (default: up, down, remove); also a string of names ("up down"). @tr Hangi araçlar, bu sırayla (varsayılan: up, down, remove); adlar bir metin olarak da verilebilir ("up down"). */
  actions?: readonly RowAction[] | string | undefined;
  /** Called when "Move up" is clicked. @tr "Move up" tıklanınca çağrılır. */
  onUp?: (() => void) | undefined;
  /** Called when "Move down" is clicked. @tr "Move down" tıklanınca çağrılır. */
  onDown?: (() => void) | undefined;
  /** Called when "Remove" is clicked. @tr "Remove" tıklanınca çağrılır. */
  onRemove?: (() => void) | undefined;
  /** One handler for every tool (called besides onUp / onDown / onRemove). @tr Tüm araçlar için tek işleyici (onUp / onDown / onRemove'a ek olarak çağrılır). */
  onAction?: ((action: RowAction) => void) | undefined;
  /** Position of the row: "up" is off on the first row. @tr Satırın sırası: ilk satırda "up" kapalıdır. */
  index?: MaybeFn<number | undefined>;
  /** Rows in the list: "down" is off on the last row. @tr Listedeki satır sayısı: son satırda "down" kapalıdır. */
  count?: MaybeFn<number | undefined>;
  /** Switch all tools off, or some: `{ remove: () => list().length <= 1 }`. @tr Tüm araçları ya da bazılarını kapatır: `{ remove: () => list().length <= 1 }`. */
  disabled?: MaybeFn<boolean | undefined> | Partial<Record<RowAction, MaybeFn<boolean | undefined>>>;
  /** Own names (default "Move up", "Move down", "Remove", group "Row tools"; translated). @tr Kendi adlarınız (varsayılan "Move up", "Move down", "Remove", grup "Row tools"; çevrilir). */
  labels?: Partial<Record<RowAction | "group", MaybeFn<string | undefined>>> | undefined;
  /** Own icons: an icon, text, a node or `() => node` each (a node is copied for every row). @tr Kendi ikonlarınız: her biri ikon, metin, düğüm ya da `() => node` (düğüm her satır için kopyalanır). */
  icons?: Partial<Record<RowAction, unknown>> | undefined;
  /** Size of the tool buttons (IconButton sizes). @tr Araç düğmelerinin boyutu (IconButton boyutları). */
  size?: MaybeFn<IconButtonSize | undefined>;
  /** The remove tool in the danger colour. @tr Kaldırma aracı tehlike renginde. */
  danger?: boolean | undefined;
  /** Extra CSS classes on the tool group. @tr Araç grubuna eklenen CSS sınıfları. */
  class?: ClassProp;
}

// the tools to draw: a list, or a string of names ("up down", "remove"); unknown names are skipped
const tools = (a: readonly RowAction[] | string | undefined): readonly RowAction[] =>
  typeof a === "string" ? a.split(/[\s,]+/).filter((x): x is RowAction => (ALL as readonly string[]).includes(x)) : a ?? ALL;

/** `<RowTools index={i} count={() => list().length} onUp={…} onDown={…} onRemove={…} />`, `<RowTools actions={["remove"]} onRemove={…} />` */
export function RowTools(props: RowToolsProps): Element {
  const ICON: Record<RowAction, unknown> = { up: arrowUp, down: arrowDown, remove: xIcon };
  const name = (a: RowAction): string => val(props.labels?.[a]) ?? (a === "up" ? t`Move up` : a === "down" ? t`Move down` : t`Remove`);
  const off = (a: RowAction): boolean => {
    const d = props.disabled;
    if (d != null && typeof d === "object" ? val(d[a]) : val(d as MaybeFn<boolean | undefined>)) return true;
    const i = val(props.index), n = val(props.count);
    return a === "up" ? i != null && i <= 0 : a === "down" ? i != null && n != null && i >= n - 1 : false;
  };
  const run = (a: RowAction): void => { (a === "up" ? props.onUp : a === "down" ? props.onDown : props.onRemove)?.(); props.onAction?.(a); };
  return h("span", { class: () => cx("m-row-tools", val(props.class)), role: "group", "aria-label": () => val(props.labels?.group) ?? t`Row tools` },
    tools(props.actions).map((a) => h(IconButton, {
      class: `m-row-tool m-row-tool-${a}`, icon: () => ownPart(props.icons?.[a], () => ICON[a]), label: () => name(a), size: props.size,
      variant: a === "remove" && props.danger ? "danger" : undefined, disabled: () => off(a), onClick: () => run(a) })));
}
