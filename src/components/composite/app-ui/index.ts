// AppUI (hadi-march/app-ui, also hadi-march/ui): the core of March IDE, march-app-ui, the base of an IDE shell. A top
// bar (title, your tools, the Layout menu: ready-made and saved layouts, the panel list), a side slot (an ActivityBar),
// the DockLayout workspace and a status slot (a StatusBar). Plugins (kit.ts) add file types, panels, commands and
// services: a panel that shows a `file` is drawn by the file type that opens its path (codeEditorPlugin: code files in
// a code editor), else as plain text. Colours come from the page's theme and accent.
import "./app-ui.css";
import { computed, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Menu } from "../../actions/menu/index.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { columns } from "../../../icons/glyphs/columns.ts";
import { DockLayout, type DockLayoutProps, type DockApi, type DockPanel } from "../dock-layout/index.ts";
import { createAppKit, type AppKit, type AppPlugin, type AppFile } from "./kit.ts";

export { definePlugin } from "./kit.ts";
export type { AppPlugin, AppFile, FileType, PluginContext, AppKit } from "./kit.ts";
export { codeEditorPlugin } from "./code.ts";
export type { LanguageService, CodeEditorPluginOptions } from "./code.ts";

/** A panel of an AppUI: a DockPanel, or one that shows a file (drawn by the file type that opens its path). */
export type AppPanel = (Omit<DockPanel, "content"> & { content: () => unknown; file?: undefined }) | (Omit<DockPanel, "content"> & { file: AppFile; content?: undefined });

export interface AppUIProps extends Omit<DockLayoutProps, "panels"> {
  panels: MaybeFn<readonly AppPanel[]>;
  /** Plugins: file types (code editor…), panels, commands, services. */
  plugins?: readonly AppPlugin[] | undefined;
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
  /** The plugin kit once it runs (add or remove plugins later). */
  kit?: ((kit: AppKit) => void) | undefined;
  class?: ClassProp;
}

/** A file panel's content: the file type that opens it (a plugin may come later: it is drawn again then), else text. */
function fileView(kit: AppKit, file: AppFile): () => unknown {
  return () => {
    const type = kit.typeOf(file.path);
    // only a change of the file type draws it again: what the view reads while it is built (the text) must not
    return untrack(() => (type ? type.mount(file) : h("pre", { class: "m-app-plain" }, () => file.text())));
  };
}

/** `<AppUI title="My IDE" panels={panels} presets={PRESETS} plugins={[codeEditorPlugin()]} persist="ide" />` */
export function AppUI(props: AppUIProps): Element {
  let dock: DockApi | undefined;
  const { title, tools, side, status, bar, layoutLabel, layoutIcon, class: cls, api, plugins, kit: onKit, panels, ...rest } = props;
  const kit = createAppKit(plugins ?? []);
  onCleanup(() => kit.dispose());
  onKit?.(kit);
  // the file panels keep their content function: a panel is built once (DockLayout), the view inside follows the types
  const views = new Map<string, () => unknown>();
  const all = computed((): DockPanel[] => [
    ...(val(panels) ?? []).map((p): DockPanel => {
      if (!p.file) return p as DockPanel;
      const f = p.file;
      let view = views.get(p.id);
      if (!view) { view = fileView(kit, f); views.set(p.id, view); }
      const draw = view;
      return { ...p, content: () => h("div", { class: "m-app-file" }, draw) } as DockPanel;
    }),
    ...kit.panels(),
  ]);
  const menu = layoutLabel === false ? null : h(Menu, {
    label: () => val(layoutLabel as MaybeFn<string | undefined>) || t`Layout`, icon: ownIcon(layoutIcon, columns), size: "sm", class: "m-app-layout", panelClass: "m-app-menu", placement: "bottom-end",
    items: () => dock?.layoutMenu() ?? [],
  });
  return h("div", { class: () => cx("m-app", val(cls)) },
    () => (val(bar) === false ? null : h("div", { class: "m-app-bar" },
      () => (val(title) ? h("span", { class: "m-app-title" }, () => val(title)) : null),
      h("span", { class: "m-app-fill" }), tools ?? null, menu)),
    h("div", { class: "m-app-main" }, side ?? null,
      h("div", { class: "m-app-body" }, h(DockLayout, { ...rest, panels: all, api: (a: DockApi) => { dock = a; api?.(a); } }))),
    status ?? null) as Element;
}
