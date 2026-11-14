// PanelHeader (hadi-march/ui): the bar on top of a panel — a dialog, a drawer, a window, a dock tab group, a card, a
// board column, an editor. Lead slot + icon + title + subtitle, then free content, a count / badge, the actions slot
// and the close button. Every part is optional, has its own text and can be replaced; `as="footer"` draws the same
// bar at the bottom of a panel (status text + actions). Pointer / key handlers and `ref` reach the root, so the bar
// can be the drag handle of what it heads (Window, DockLayout).
import "./panel-header.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, rest, icon, glyph, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";

/** Props of <PanelHeader>. Unknown props (events, aria, role, tabindex, id) go to the root element. */
export interface PanelHeaderProps {
  /** Root element: "header" (default), "footer" (the bar under a panel: rule above, sticks to the bottom) or "div". */
  as?: "header" | "footer" | "div" | undefined;
  /** Before everything: a back button, a status dot, a drag grip. */
  lead?: unknown | undefined;
  /** An icon (IconDef, emoji, node) before the title. */
  icon?: unknown | undefined;
  title?: MaybeFn<unknown> | undefined;
  /** Element of the title (default "h3"; "span" in a footer). */
  titleAs?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span" | "div" | "p" | undefined;
  /** Id of the title element (aria-labelledby of the panel). */
  titleId?: string | undefined;
  /** Second line under the title. */
  subtitle?: MaybeFn<unknown> | undefined;
  /** Right after the title: a count, a badge, a status. */
  meta?: MaybeFn<unknown> | undefined;
  /** The end side: buttons, menus (nodes or an accessor). */
  actions?: MaybeFn<unknown> | undefined;
  /** Shows the close button and runs on it. */
  onClose?: ((e: MouseEvent) => void) | undefined;
  /** The close button: shown when `onClose` is given (default), false for none, or your own icon for it. */
  close?: boolean | unknown | undefined;
  /** Accessible name and tooltip of the close button (default "Close"). */
  closeLabel?: MaybeFn<string | undefined>;
  /** Height and type size (default md). */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Stays at the top (the bottom for a footer) of the scrolling panel. */
  sticky?: MaybeFn<boolean | undefined>;
  /** A rule between the bar and the content. */
  divider?: MaybeFn<boolean | undefined>;
  /** "muted": the tinted bar of editors and code blocks. */
  tone?: MaybeFn<"plain" | "muted" | undefined>;
  /** The bar is a drag handle: no text selection, touch gestures go to your handlers. */
  drag?: MaybeFn<boolean | undefined>;
  /** Titles at the top of a tall bar (default: centred). */
  align?: MaybeFn<"center" | "start" | undefined>;
  /** Theme colour of the icon. */
  color?: ColorToken | undefined;
  /** Called with the root element (drag behaviors attach here). */
  ref?: ((el: HTMLElement) => void) | undefined;
  class?: ClassProp | undefined;
  /** An extra class on a part, for a host that keeps its own class names: `{ titles, title, subtitle, meta, actions }`. */
  partClass?: Partial<Record<"titles" | "title" | "subtitle" | "meta" | "actions", string>> | undefined;
  /** Free content between the titles and the actions (tabs, a search box). */
  children?: unknown | undefined;
  [attr: string]: unknown;
}

const USED = ["as", "lead", "icon", "title", "titleAs", "titleId", "subtitle", "meta", "actions", "onClose", "close", "closeLabel", "size", "sticky", "divider", "tone", "drag", "align", "color", "ref", "partClass"] as const;

/** `<PanelHeader icon={cog} title="Settings" subtitle="Workspace" actions={<Button size="sm">Save</Button>} onClose={close} divider />` */
export function PanelHeader(props: PanelHeaderProps): Element {
  const foot = props.as === "footer";
  const hasTitles = props.title != null || props.subtitle != null;
  const own = props.close != null && typeof props.close !== "boolean";
  const pc = (part: "titles" | "title" | "subtitle" | "meta" | "actions"): string => cx(`hm-panel-header-${part === "subtitle" ? "sub" : part}`, props.partClass?.[part]);
  const showClose = props.close === false ? false : props.onClose != null || props.close === true || own;
  return h(props.as ?? "header", {
    ...rest(props, USED),
    class: () => cx("hm-panel-header", `hm-panel-header-${val(props.size) ?? "md"}`, foot && "hm-panel-header-foot", val(props.sticky) && "is-sticky", val(props.divider) && "is-divided",
      val(props.tone) === "muted" && "hm-panel-header-muted", val(props.drag) && "is-drag", val(props.align) === "start" && "hm-panel-header-top", val(props.class)),
    "data-hm-color": colorAttr(props.color),
    ref: (el: HTMLElement) => props.ref?.(el),
  },
  props.lead != null ? h("span", { class: "hm-panel-header-lead" }, props.lead) : null,
  props.icon != null && props.icon !== false ? icon(props.icon, "hm-panel-header-icon") : null,
  hasTitles ? h("div", { class: pc("titles") },
    props.title != null ? h(props.titleAs ?? (foot ? "span" : "h3"), { class: pc("title"), id: props.titleId }, () => val(props.title)) : null,
    props.subtitle != null ? h("p", { class: pc("subtitle") }, () => val(props.subtitle)) : null) : null,
  props.meta != null ? h("span", { class: pc("meta") }, () => val(props.meta)) : null,
  props.children != null ? h("div", { class: "hm-panel-header-body" }, props.children) : null,
  props.actions != null ? h("div", { class: pc("actions") }, () => val(props.actions)) : null,
  showClose ? h(IconButton, {
    class: "hm-panel-header-close", size: () => (val(props.size) === "lg" ? undefined : "sm"), icon: own ? props.close : glyph(xIcon), label: () => val(props.closeLabel) ?? t`Close`,
    onClick: (e: MouseEvent) => { e.stopPropagation(); props.onClose?.(e); }, onPointerDown: (e: Event) => e.stopPropagation(),
  }) : null);
}
