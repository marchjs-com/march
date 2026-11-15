// AppUI (hadi-march/app-ui, also hadi-march/ui): the core of March IDE, march-app-ui, the base of an IDE shell. A top
// bar (title, your tools, the Layout menu: ready-made and saved layouts, the panel list), a side slot (an ActivityBar),
// the DockLayout workspace and a status slot (a StatusBar). Colours come from the page's theme and accent.
import "./app-ui.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Menu } from "../../actions/menu/index.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { columns } from "../../../icons/glyphs/columns.ts";
import { DockLayout, type DockLayoutProps, type DockApi } from "../dock-layout/index.ts";

export interface AppUIProps extends DockLayoutProps {
  /** Text at the start of the top bar. */
  title?: MaybeFn<string | undefined>;
  /** Your items in the top bar, before the Layout menu. */
  tools?: unknown;
  /** Beside the workspace, at the start (an ActivityBar). */
  side?: unknown;
  /** Under the workspace (a StatusBar). */
  status?: unknown;
  /** The top bar (default true); false: only the workspace (open the layout menu yourself: `api.layoutMenu()`). */
  bar?: MaybeFn<boolean | undefined>;
  /** Name (tooltip) of the Layout menu button, an icon button (default "Layout"); false: no button. */
  layoutLabel?: MaybeFn<string | undefined> | false;
  /** Own icon of the Layout menu button. */
  layoutIcon?: unknown;
  class?: ClassProp;
}

/** `<AppUI title="My IDE" panels={panels} presets={PRESETS} persist="ide" tools={<RunButton />} />` */
export function AppUI(props: AppUIProps): Element {
  let dock: DockApi | undefined;
  const { title, tools, side, status, bar, layoutLabel, layoutIcon, class: cls, api, ...rest } = props;
  const menu = layoutLabel === false ? null : h(Menu, {
    label: () => val(layoutLabel as MaybeFn<string | undefined>) || t`Layout`, icon: ownIcon(layoutIcon, columns), size: "sm", class: "m-app-layout", panelClass: "m-app-menu", placement: "bottom-end",
    items: () => dock?.layoutMenu() ?? [],
  });
  return h("div", { class: () => cx("m-app", val(cls)) },
    () => (val(bar) === false ? null : h("div", { class: "m-app-bar" },
      () => (val(title) ? h("span", { class: "m-app-title" }, () => val(title)) : null),
      h("span", { class: "m-app-fill" }), tools ?? null, menu)),
    h("div", { class: "m-app-main" }, side ?? null,
      h("div", { class: "m-app-body" }, h(DockLayout, { ...rest, api: (a: DockApi) => { dock = a; api?.(a); } }))),
    status ?? null) as Element;
}
