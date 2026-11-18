// AppUI (march/app-ui, also march/ui): the core of March IDE, march-app-ui, the base of an IDE shell. A top
// bar (title, your tools, the Layout menu: ready-made and saved layouts, the panel list), a side slot (an ActivityBar),
// the DockLayout workspace and a status slot (a StatusBar). Plugins (kit.ts) add file types, panels, commands and
// services: a panel that shows a `file` is drawn by the file type that opens its path (codeEditorPlugin: code files in
// a code editor), else as plain text. Colours come from the page's theme and accent.
import "./app-ui.css";
import { computed, untrack, onCleanup, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Menu } from "../../actions/menu/index.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { columns } from "../../../icons/glyphs/columns.ts";
import { DockLayout, type DockLayoutProps, type DockApi, type DockPanel } from "../dock-layout/index.ts";
import { createAppKit, type AppKit, type AppPlugin, type AppFile } from "./kit.ts";
import type { IconProp } from "../../../icons/types.ts";

export { definePlugin } from "./kit.ts";
export type { AppPlugin, AppFile, FileType, PluginContext, AppKit } from "./kit.ts";
export { codeEditorPlugin } from "./code.ts";
export type { LanguageService, CodeEditorPluginOptions } from "./code.ts";
export { MARCH_SNIPPETS, snippetRows, type CodeSnippet } from "./snippets.ts";
export { marchLanguagePlugin } from "./march-lang.ts";
export { AppPreview, PREVIEW_DEVICES } from "./preview.ts";
export { typeScriptPlugin } from "./ts.ts";
export { debuggerPlugin } from "./debug.ts";
export { vaultPlugin, aiPlugin } from "./ai.ts";
export type { VaultService, VaultPluginOptions, AiService, AiPluginOptions, AiContext } from "./ai.ts";
export type { DebuggerService, GutterService, DebuggerPluginOptions } from "./debug.ts";
export type { TypeScriptService, TypeScriptPluginOptions, CodeProblem, CodeReference, CodeSymbol, CodeInlay } from "./ts.ts";
export type { AppPreviewProps, AppPreviewToolbar, AppPreviewDevice } from "./preview.ts";
export type { MarchCatalog, MarchExport, MarchLanguageOptions } from "./march-lang.ts";

/** A panel of an AppUI: a DockPanel, or one that shows a file (drawn by the file type that opens its path). */
export type AppPanel = (Omit<DockPanel, "content"> & { content: () => unknown; file?: undefined }) | (Omit<DockPanel, "content"> & { file: AppFile; content?: undefined });

export interface AppUIProps extends Omit<DockLayoutProps, "panels"> {
  /** The panels: DockPanels, or ones that show a file (drawn by the file type that opens its path). @tr Paneller: DockPanel'ler ya da bir dosya gösterenler (yolunu açan dosya türü çizer). */
  panels: MaybeFn<readonly AppPanel[]>;
  /** Plugins: file types (code editor…), panels, commands, services. @tr Eklentiler: dosya türleri (kod düzenleyici…), paneller, komutlar, servisler. */
  plugins?: readonly AppPlugin[] | undefined;
  /** Text at the start of the top bar; empty or null: none. @tr Üst çubuğun başındaki metin; boş ya da null: yok. */
  title?: MaybeFn<string | null | undefined>;
  /** A short note beside the title, quiet and smaller, written as a code comment ("// …"; the "//" is added). @tr Başlığın yanında sessiz ve daha küçük kısa not, kod yorumu gibi yazılır ("// …"; "//" eklenir). */
  description?: MaybeFn<string | null | undefined>;
  /** What starts the description (default "//"); "" for none. @tr Açıklamanın başındaki işaret (varsayılan "//"); hiç olmasın diye "". */
  descriptionMark?: string | undefined;
  /** Your items in the top bar, before the Layout menu. @tr Üst çubukta, Layout menüsünden önceki kendi öğelerin. */
  tools?: unknown;
  /** Beside the workspace, at the start (an ActivityBar). @tr Çalışma alanının başında, yanında (bir ActivityBar). */
  side?: unknown;
  /** Under the workspace (a StatusBar). @tr Çalışma alanının altında (bir StatusBar). */
  status?: unknown;
  /** The top bar (default true); false: only the workspace (open the layout menu yourself: `api.layoutMenu()`). @tr Üst çubuk (varsayılan true); false: yalnız çalışma alanı (düzen menüsünü kendin aç: `api.layoutMenu()`). */
  bar?: MaybeFn<boolean | undefined>;
  /** Name (tooltip) of the Layout menu button, an icon button (default "Layout"); false: no button. @tr Layout menüsü ikon düğmesinin adı (ipucu) (varsayılan "Layout"); false: düğme yok. */
  layoutLabel?: MaybeFn<string | undefined> | false;
  /** The Layout menu button at the end of the top bar (default true; live); false hides it (as `layoutLabel={false}`). @tr Üst çubuğun sonundaki Layout menüsü düğmesi (varsayılan true; canlı); false gizler (`layoutLabel={false}` gibi). */
  layoutMenu?: MaybeFn<boolean | undefined>;
  /** Own icon of the Layout menu button. @tr Layout menüsü düğmesinin kendi ikonu. */
  layoutIcon?: IconProp;
  /** The plugin kit once it runs (add or remove plugins later). @tr Eklenti kiti çalışmaya başlayınca çağrılır (sonradan eklenti ekle ya da kaldır). */
  kit?: ((kit: AppKit) => void) | undefined;
  /** Extra classes on the root. @tr Köke eklenen sınıflar. */
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
  // title and description are read from props when drawn (live: a getter prop follows its value)
  const { title: _title, description: _description, layoutMenu: _layoutMenu, descriptionMark, tools, side, status, bar, layoutLabel, layoutIcon, class: cls, api, plugins, kit: onKit, panels: _panels, ...rest } = props;
  const kit = createAppKit(plugins ?? []);
  onCleanup(() => kit.dispose());
  onKit?.(kit);
  // the file panels keep their content function: a panel is built once (DockLayout), the view inside follows the types
  const views = new Map<string, () => unknown>();
  const all = computed((): DockPanel[] => [
    // read from props each time: a reactive list (a signal, a computed) is a live getter prop
    ...(val(props.panels) ?? []).map((p): DockPanel => {
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
      () => (val(props.title) ? h("span", { class: "m-app-title" }, () => val(props.title)) : null),
      () => { const d = val(props.description); return d ? h("span", { class: "m-app-desc" }, (descriptionMark ?? "//") ? h("span", { class: "m-app-desc-mark", "aria-hidden": "true" }, `${descriptionMark ?? "//"} `) : null, d) : null; },
      h("span", { class: "m-app-fill" }), tools ?? null, () => (val(props.layoutMenu) === false ? null : menu))),
    h("div", { class: "m-app-main" }, side ?? null,
      h("div", { class: "m-app-body" }, h(DockLayout, { ...rest, actions: reactive(() => val(props.actions)), panels: all, api: (a: DockApi) => { dock = a; api?.(a); } }))),
    status ?? null) as Element;
}
