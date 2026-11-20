// PanelHeader (march/ui): the bar on top of a panel — a dialog, a drawer, a window, a dock tab group, a card, a
// board column, an editor. Lead slot + icon + title + subtitle, then free content, a count / badge, the actions slot
// and the close button. Every part is optional, has its own text and can be replaced; `as="footer"` draws the same
// bar at the bottom of a panel (status text + actions). Pointer / key handlers and `ref` reach the root, so the bar
// can be the drag handle of what it heads (Window, DockLayout).
import "./panel-header.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, rest, icon, glyph, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import type { Handler } from "../../../core/util.ts";

/** Props of <PanelHeader>. Unknown props (events, aria, role, tabindex, id) go to the root element. */
export interface PanelHeaderProps {
  /** Root element: "header" (default), "footer" (the bar under a panel: rule above, sticks to the bottom) or "div". @tr Kök öğe: "header" (varsayılan), "footer" (panelin altındaki çubuk: üstte çizgi, alta yapışır) ya da "div". */
  as?: "header" | "footer" | "div" | undefined;
  /** Before everything: a back button, a status dot, a drag grip. @tr Her şeyden önce: bir geri düğmesi, bir durum noktası, bir sürükleme tutamacı. */
  lead?: unknown | undefined;
  /** An icon (IconDef, emoji, node) before the title. @tr Başlıktan önce bir ikon (IconDef, emoji, düğüm). */
  icon?: unknown | undefined;
  /** The title text or node. @tr Başlık metni ya da düğümü. */
  title?: MaybeFn<unknown> | undefined;
  /** Element of the title (default "h3"; "span" in a footer). @tr Başlığın öğesi (varsayılan "h3"; footer içinde "span"). */
  titleAs?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "div" | "p" | undefined;
  /** Id of the title element (aria-labelledby of the panel). @tr Başlık öğesinin id'si (panelin aria-labelledby değeri). */
  titleId?: string | undefined;
  /** Second line under the title. @tr Başlığın altındaki ikinci satır. */
  subtitle?: MaybeFn<unknown> | undefined;
  /** Right after the title: a count, a badge, a status. @tr Başlığın hemen ardından: bir sayı, bir rozet, bir durum. */
  meta?: MaybeFn<unknown> | undefined;
  /** The end side: buttons, menus (nodes or an accessor). @tr Son taraf: düğmeler, menüler (düğümler ya da bir erişimci). */
  actions?: MaybeFn<unknown> | undefined;
  /** Shows the close button and runs on it. @tr Kapat düğmesini gösterir ve ona basılınca çağrılır. */
  onClose?: Handler<[e: MouseEvent]> | undefined;
  /** The close button: shown when `onClose` is given (default), false for none, or your own icon for it. @tr Kapat düğmesi: `onClose` verilince gösterilir (varsayılan), false ile hiç, ya da onun için kendi ikonunuz. */
  close?: boolean | unknown | undefined;
  /** Accessible name and tooltip of the close button (default "Close"). @tr Kapat düğmesinin erişilebilir adı ve ipucu (varsayılan "Kapat"). */
  closeLabel?: MaybeFn<string | undefined>;
  /** Height and type size (default md). @tr Yükseklik ve yazı boyutu (varsayılan md). */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Stays at the top (the bottom for a footer) of the scrolling panel. @tr Kayan panelin üstünde (footer için altında) sabit kalır. */
  sticky?: MaybeFn<boolean | undefined>;
  /** A rule between the bar and the content. @tr Çubuk ile içerik arasında bir çizgi. */
  divider?: MaybeFn<boolean | undefined>;
  /** "muted": the tinted bar of editors and code blocks. @tr "muted": düzenleyicilerin ve kod bloklarının renkli çubuğu. */
  tone?: MaybeFn<"plain" | "muted" | undefined>;
  /** The bar is a drag handle: no text selection, touch gestures go to your handlers. @tr Çubuk bir sürükleme tutamacıdır: metin seçilmez, dokunma hareketleri sizin işleyicilerinize gider. */
  drag?: MaybeFn<boolean | undefined>;
  /** Titles at the top of a tall bar (default: centred). @tr Yüksek bir çubukta başlıklar üstte (varsayılan: ortada). */
  align?: MaybeFn<"center" | "start" | undefined>;
  /** Called with the root element (drag behaviors attach here). @tr Kök öğeyle çağrılır (sürükleme davranışları buraya bağlanır). */
  ref?: ((el: HTMLElement) => void) | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp | undefined;
  /** An extra class on a part, for a host that keeps its own class names: `{ titles, title, subtitle, meta, actions }`. @tr Kendi sınıf adlarını koruyan bir ana bileşen için bir parçaya ek sınıf: `{ titles, title, subtitle, meta, actions }`. */
  partClass?: Partial<Record<"titles" | "title" | "subtitle" | "meta" | "actions", string>> | undefined;
  /** Free content between the titles and the actions (tabs, a search box). @tr Başlıklar ile eylemler arasında serbest içerik (sekmeler, bir arama kutusu). */
  children?: unknown | undefined;
  [attr: string]: unknown;
}

const USED = ["as", "lead", "icon", "title", "titleAs", "titleId", "subtitle", "meta", "actions", "onClose", "close", "closeLabel", "size", "sticky", "divider", "tone", "drag", "align", "color", "ref", "partClass"] as const;

/** `<PanelHeader icon={cog} title="Settings" subtitle="Workspace" actions={<Button size="sm">Save</Button>} onClose={close} divider />` */
export function PanelHeader(props: PanelHeaderProps): Element {
  const foot = props.as === "footer";
  // a part given as false (`subtitle={cond && "…"}`) is left out, like null
  const has = (v: unknown): boolean => v != null && v !== false;
  const hasTitles = props.title != null || has(props.subtitle);
  const own = props.close != null && typeof props.close !== "boolean";
  const pc = (part: "titles" | "title" | "subtitle" | "meta" | "actions"): string => cx(`m-panel-header-${part === "subtitle" ? "sub" : part}`, props.partClass?.[part]);
  const showClose = props.close === false ? false : props.onClose != null || props.close === true || own;
  return h(props.as ?? "header", {
    ...rest(props, USED),
    class: () => cx("m-panel-header", `m-panel-header-${val(props.size) ?? "md"}`, foot && "m-panel-header-foot", val(props.sticky) && "is-sticky", val(props.divider) && "is-divided",
      val(props.tone) === "muted" && "m-panel-header-muted", val(props.drag) && "is-drag", val(props.align) === "start" && "m-panel-header-top", val(props.class)),
    ref: (el: HTMLElement) => props.ref?.(el),
  },
  props.lead != null ? h("span", { class: "m-panel-header-lead" }, props.lead) : null,
  props.icon != null && props.icon !== false ? icon(props.icon, "m-panel-header-icon") : null,
  hasTitles ? h("div", { class: pc("titles") },
    props.title != null ? h(props.titleAs ?? (foot ? "span" : "h3"), { class: pc("title"), id: props.titleId }, () => val(props.title)) : null,
    has(props.subtitle) ? h("p", { class: pc("subtitle") }, () => val(props.subtitle)) : null) : null,
  has(props.meta) ? h("span", { class: pc("meta") }, () => val(props.meta)) : null,
  props.children != null ? h("div", { class: "m-panel-header-body" }, props.children) : null,
  has(props.actions) ? h("div", { class: pc("actions") }, () => val(props.actions)) : null,
  showClose ? h(IconButton, {
    class: "m-panel-header-close", size: () => (val(props.size) === "lg" ? undefined : "sm"), icon: own ? props.close : glyph(xIcon), label: () => val(props.closeLabel) ?? t`Close`,
    onClick: (e: MouseEvent) => { e.stopPropagation(); props.onClose?.(e); }, onPointerDown: (e: Event) => e.stopPropagation(),
  }) : null);
}
