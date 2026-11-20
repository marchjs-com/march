// RowTools (march/forms): the tools of one row in an editable list: a drag grip, move up, move down, remove. Built
// from IconButton. Give the row's `index` and the list's `count` and the arrows switch off at the ends. Which tools
// show (`actions`), their names, icons, size and colour are yours. The grip is for pointer, touch and pen (`onGrab`
// starts the drag); the keyboard reorders with the arrows.
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
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import type { Handler } from "../../../core/util.ts";

messages("tr", tr);

export type RowAction = "drag" | "up" | "down" | "remove";
const ALL: readonly RowAction[] = ["drag", "up", "down", "remove"];
const DEFAULT: readonly RowAction[] = ["up", "down", "remove"];

export interface RowToolsProps {
  /** Which tools, in this order (default: up, down, remove; "drag" adds a drag grip, with `onGrab`); also a string of names ("drag up down"). @tr Hangi araçlar, bu sırayla (varsayılan: up, down, remove; "drag" bir sürükleme tutamağı ekler, `onGrab` ile); adlar bir metin olarak da verilebilir ("drag up down"). */
  actions?: readonly RowAction[] | string | undefined;
  /** Called when "Move up" is clicked. @tr "Move up" tıklanınca çağrılır. */
  onUp?: Handler<[]> | undefined;
  /** Called when "Move down" is clicked. @tr "Move down" tıklanınca çağrılır. */
  onDown?: Handler<[]> | undefined;
  /** Called when "Remove" is clicked. @tr "Remove" tıklanınca çağrılır. */
  onRemove?: Handler<[]> | undefined;
  /** Called with the pointerdown on the drag grip: start the drag there (the row editors' `rows.grab`, or your own `pointerDrag`). @tr Sürükleme tutamağına basılınca pointerdown ile çağrılır: sürüklemeyi orada başlatın (satır düzenleyicilerinin `rows.grab`'ı ya da kendi `pointerDrag`'iniz). */
  onGrab?: Handler<[e: PointerEvent]> | undefined;
  /** Drag to reorder a plain list: called once on drop with the row's old and new position. RowTools finds its row (the nearest `[data-m-row]`, else `li`) among its siblings, lifts it under the pointer and slides the others aside; Escape cancels. With it the default tools are drag, up, down, remove. @tr Düz bir listeyi sürükleyerek sıralar: bırakınca satırın eski ve yeni sırasıyla bir kez çağrılır. RowTools satırını (en yakın `[data-m-row]`, yoksa `li`) kardeşleri arasında bulur, işaretçinin altında kaldırır, ötekileri kenara kaydırır; Escape vazgeçer. Verilince varsayılan araçlar: drag, up, down, remove. */
  onReorder?: Handler<[from: number, to: number]> | undefined;
  /** One handler for every tool (called besides onUp / onDown / onRemove). @tr Tüm araçlar için tek işleyici (onUp / onDown / onRemove'a ek olarak çağrılır). */
  onAction?: Handler<[action: RowAction]> | undefined;
  /** Position of the row: "up" is off on the first row. @tr Satırın sırası: ilk satırda "up" kapalıdır. */
  index?: MaybeFn<number | undefined>;
  /** Rows in the list: "down" is off on the last row. @tr Listedeki satır sayısı: son satırda "down" kapalıdır. */
  count?: MaybeFn<number | undefined>;
  /** Switch all tools off, or some: `{ remove: () => list().length <= 1 }`. @tr Tüm araçları ya da bazılarını kapatır: `{ remove: () => list().length <= 1 }`. */
  disabled?: MaybeFn<boolean | undefined> | Partial<Record<RowAction, MaybeFn<boolean | undefined>>>;
  /** Own names (default "Drag to reorder", "Move up", "Move down", "Remove", group "Row tools"; translated). @tr Kendi adlarınız (varsayılan "Drag to reorder", "Move up", "Move down", "Remove", grup "Row tools"; çevrilir). */
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
  typeof a === "string" ? a.split(/[\s,]+/).filter((x): x is RowAction => (ALL as readonly string[]).includes(x)) : a ?? DEFAULT;

/** `<RowTools index={i} count={() => list().length} onUp={…} onDown={…} onRemove={…} />`, `<RowTools actions={["remove"]} onRemove={…} />`, `<RowTools index={i} count={$list.length} onReorder={(from, to) => move(from, to)} … />` (drag, up, down, remove) */
export function RowTools(props: RowToolsProps): Element {
  const ICON: Record<RowAction, unknown> = { drag: null, up: arrowUp, down: arrowDown, remove: xIcon };
  const name = (a: RowAction): string => val(props.labels?.[a]) ?? (a === "drag" ? t`Drag to reorder` : a === "up" ? t`Move up` : a === "down" ? t`Move down` : t`Remove`);
  const off = (a: RowAction): boolean => {
    const d = props.disabled;
    if (d != null && typeof d === "object" ? val(d[a]) : val(d as MaybeFn<boolean | undefined>)) return true;
    const i = val(props.index), n = val(props.count);
    return a === "up" ? i != null && i <= 0 : a === "down" ? i != null && n != null && i >= n - 1 : a === "drag" ? n != null && n < 2 : false;
  };
  // drag a plain list (onReorder): the row follows the pointer, the rows between slide by one row's height
  const reorder = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const grip = e.currentTarget as HTMLElement;
    const row = grip.closest<HTMLElement>("[data-m-row]") ?? grip.closest<HTMLElement>("li");
    const box = row?.parentElement;
    if (!row || !box) return;
    const rows = Array.from(box.children).filter((r): r is HTMLElement => r.tagName === row.tagName && (!row.hasAttribute("data-m-row") || r.hasAttribute("data-m-row")));
    const from = rows.indexOf(row);
    if (from < 0 || rows.length < 2) return;
    e.preventDefault();
    const tops = rows.map((r) => r.getBoundingClientRect().top), step = rows.length > 1 ? (tops[tops.length - 1]! - tops[0]!) / (rows.length - 1) : 0;
    let to = from;
    const place = (): void => rows.forEach((r, k) => { if (k !== from) r.style.setProperty("translate", from < to && k > from && k <= to ? `0 ${-step}px` : to < from && k >= to && k < from ? `0 ${step}px` : ""); });
    const clear = (): void => { for (const r of rows) { r.style.removeProperty("translate"); r.classList.remove("is-dragging", "is-sliding"); } box.classList.remove("is-sorting"); };
    pointerDrag(e, {
      threshold: 2,
      onStart: () => { box.classList.add("is-sorting"); row.classList.add("is-dragging"); for (const r of rows) if (r !== row) r.classList.add("is-sliding"); },
      onMove: (p) => {
        row.style.setProperty("translate", `0 ${p.dy}px`);
        const mid = tops[from]! + p.dy + row.offsetHeight / 2;
        let n = 0;
        rows.forEach((r, k) => { if (k !== from && mid > tops[k]! + r.offsetHeight / 2) n++; });
        if (n !== to) { to = n; place(); }
      },
      onEnd: (_p, cancelled) => { clear(); if (!cancelled && to !== from) props.onReorder?.(from, to); },
    });
  };
  const run = (a: RowAction): void => { (a === "up" ? props.onUp : a === "down" ? props.onDown : a === "remove" ? props.onRemove : undefined)?.(); props.onAction?.(a); };
  return h("span", { class: () => cx("m-row-tools", val(props.class)), role: "group", "aria-label": () => val(props.labels?.group) ?? t`Row tools` },
    tools(props.actions ?? (props.onReorder ? ["drag", ...DEFAULT] : undefined)).map((a) => a === "drag"
      // the grip: pointer only (hidden from screen readers; the arrows are the keyboard's way), its name as a tooltip
      ? h("span", { class: () => cx("m-row-tool m-row-tool-drag m-row-grip", off(a) && "is-off"), "aria-hidden": "true", title: () => name(a),
        onPointerdown: (e: PointerEvent) => { if (off(a)) return; if (props.onGrab) props.onGrab(e); else if (props.onReorder) reorder(e); } }, () => (props.icons?.drag != null ? ownPart(props.icons.drag, () => null) : null))
      : h(IconButton, {
      class: `m-row-tool m-row-tool-${a}`, icon: () => ownPart(props.icons?.[a], () => ICON[a]), label: () => name(a), size: props.size,
      variant: a === "remove" && props.danger ? "danger" : undefined, disabled: () => off(a), onClick: () => run(a) })));
}
