// PhotoEditor (march/photo-editor): a complete photo editor on march/image/doc. Folder: src/components/photo/photo-editor/.
//   <PhotoEditor documents={[{ width: 1920, height: 1080 }]} workspace="photography" api={(ed) => editor = ed} />
// Menu bar, tool options bar, toolbar with tool groups, documents as tabs (or floating windows), dockable panels
// (DockLayout), status bar, dialogs, a command palette over every menu command, Photoshop-habit shortcuts
// (remappable), context menus, screen modes, touch gestures. Every text, part and animation can be replaced or off.
import "./photo-editor.css";
import { signal, effect, untrack, onCleanup, batch } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, on, val, type ClassProp, type MaybeFn } from "../../../core/util.ts";
import { formatKey } from "../../../ui/key-label.ts";
import { MenuBar, type MenuBarItem, type MenuBarMenu } from "../../actions/menu-bar/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { TabList } from "../../navigation/tabs/index.ts";
import { DockLayout, row, col, tabs, type DockApi } from "../../composite/dock-layout/index.ts";
import { StatusBar } from "../../layout/status-bar/index.ts";
import { Window } from "../../layout/window/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { Segmented } from "../../forms/segmented/index.ts";
import { ContextMenu } from "../../overlays/context-menu/index.ts";
import { ImageDocument, type DocInit } from "../../../image/doc/index.ts";
import { getTool } from "../../../image/doc/tools/tool.ts";
import { Editor, type Plugin, type Prefs, type Workspace, type DocEntry, type EditorCommand } from "./editor.ts";
import { coreCommands, mergeCommand, menuTree, type MenuNode } from "./commands.ts";
import { CanvasView, isTyping } from "./view.ts";
import { Toolbar, TOOL_SLOTS } from "./toolbar.ts";
import { OptionsBar } from "./options-bar.ts";
import { PANELS, WORKSPACES, panelContent } from "./panels/index.ts";
import { openDialog } from "./dialogs/index.ts";
import { installTools } from "./install.ts";
import { ICONS } from "./icons.ts";
import tr from "./tr.ts";

messages("tr", tr);

export { Editor } from "./editor.ts";
export type { Plugin, PluginApi, Prefs, Workspace, DocEntry, EditorCommand, ScriptApi, ViewState } from "./editor.ts";

export interface PhotoEditorLabels {
  editor?: string; tools?: string; panels?: string; documents?: string; status?: string; start?: string; startHint?: string;
  newDoc?: string; open?: string; menu?: string;
}

export interface PhotoEditorProps {
  /** Documents to open: sizes ({ width, height, … }), image files / bytes, or ready ImageDocuments. @tr Açılacak belgeler: boyutlar ({ width, height, … }), görsel dosyaları / baytlar ya da hazır ImageDocument'ler. */
  documents?: MaybeFn<readonly (DocInit | Blob | Uint8Array | ImageDocument)[] | undefined>;
  /** Open a generated sample photo when no document is given (default true). @tr Belge verilmezse üretilmiş bir örnek fotoğraf açar (varsayılan true). */
  sample?: boolean | undefined;
  /** Panel arrangement: essentials, photography, painting or design. @tr Panel düzeni: essentials, photography, painting ya da design. */
  workspace?: Workspace | undefined;
  /** Which tools the toolbar shows (tool ids; default all). @tr Araç çubuğunun gösterdiği araçlar (araç id'leri; varsayılan hepsi). */
  tools?: readonly string[] | undefined;
  /** Which panels exist (panel ids; default all). @tr Hangi paneller var (panel id'leri; varsayılan hepsi). */
  panels?: readonly string[] | undefined;
  /** The menu bar (default true). @tr Menü çubuğu (varsayılan true). */
  menu?: boolean | undefined;
  /** The tool options bar (default true). @tr Araç seçenekleri çubuğu (varsayılan true). */
  optionsBar?: boolean | undefined;
  /** The toolbar (default true). @tr Araç çubuğu (varsayılan true). */
  toolbar?: boolean | undefined;
  /** The status bar (default true). @tr Durum çubuğu (varsayılan true). */
  statusBar?: boolean | undefined;
  /** The panel dock (default true). @tr Panel yuvası (varsayılan true). */
  dock?: boolean | undefined;
  /** The workspace switcher in the menu bar (default true). @tr Menü çubuğundaki çalışma alanı seçici (varsayılan true). */
  workspaceSwitcher?: boolean | undefined;
  /** Interface animations: panel docking, tool switching, handles, marching ants, layer reorder, dialogs (default true; reduced motion is honored). @tr Arayüz animasyonları: panel yerleşimi, araç geçişi, tutamaçlar, yürüyen karıncalar, katman sıralama, iletişim kutuları (varsayılan true; azaltılmış hareket gözetilir). */
  motion?: boolean | undefined;
  /** Interface color: dark (default), darker, medium or light. @tr Arayüz rengi: dark (varsayılan), darker, medium ya da light. */
  uiColor?: Prefs["uiColor"] | undefined;
  /** Preferences to start with (merged over the saved ones). @tr Başlangıç tercihleri (kayıtlı olanların üzerine). */
  prefs?: Partial<Prefs> | undefined;
  /** Plugins: tools, panels, filters and commands of your own. @tr Eklentiler: kendi araçlarınız, panelleriniz, filtreleriniz ve komutlarınız. */
  plugins?: readonly Plugin[] | undefined;
  /** AI hooks (generative fill, object select, sky replace, neural filters); without them those commands stay off. @tr Yapay zekâ kancaları (üretken dolgu, nesne seçimi, gökyüzü değiştirme, nöral filtreler); verilmezse bu komutlar kapalı kalır. */
  ai?: Record<string, unknown> | undefined;
  /** Height of the editor (CSS length, default 100%). @tr Düzenleyicinin yüksekliği (CSS uzunluğu, varsayılan %100). */
  height?: string | undefined;
  /** Called with the file bytes when the user saves (.march-image). @tr Kullanıcı kaydedince dosya baytlarıyla çağrılır (.march-image). */
  onSave?: ((bytes: Uint8Array, doc: ImageDocument) => void) | undefined;
  /** Called with an exported file. @tr Dışa aktarılan bir dosyayla çağrılır. */
  onExport?: ((file: Blob, name: string) => void) | undefined;
  /** Called after every document change. @tr Her belge değişikliğinden sonra çağrılır. */
  onChange?: ((doc: ImageDocument) => void) | undefined;
  /** Receives the editor controller (scripting: editor.api.doc.layers.add(…)). @tr Düzenleyici denetleyicisini alır (betik: editor.api.doc.layers.add(…)). */
  api?: ((editor: Editor) => void) | undefined;
  /** Own texts. @tr Kendi metinleriniz. */
  labels?: PhotoEditorLabels | undefined;
  /** Extra classes on the root (`m-pe`). @tr Köke (`m-pe`) eklenen sınıflar. */
  class?: ClassProp;
}

/** A complete photo editor: `<PhotoEditor documents={[file]} />`. */
export function PhotoEditor(props: PhotoEditorProps): Element {
  const ed = new Editor();
  if (props.prefs) ed.setPrefs(props.prefs);
  if (props.uiColor) ed.setPrefs({ uiColor: props.uiColor });
  if (props.motion === false) ed.setPrefs({ motion: false });
  if (props.workspace) ed.workspace.set(props.workspace);
  if (props.ai) ed.shared.ai = props.ai;
  const L = (): PhotoEditorLabels => props.labels ?? {};
  let root!: HTMLElement;
  const dock = signal<DockApi | null>(null);
  const ctxMenu = signal<{ x: number; y: number; items: MenuBarItem[] } | null>(null);

  // tools and commands
  installTools(ed);
  ed.addCommand(...coreCommands(), mergeCommand());
  if (props.plugins) for (const p of props.plugins) ed.use(p);
  ed.setTool("move");

  // dialogs and other UI requests from commands
  ed.shared.ui = (what: string, data?: unknown) => openDialog(ed, what, data, {
    save: props.onSave, export: props.onExport, root: () => root,
  });
  if (props.onChange) ed.on("doc:change", (d) => { const e = (d as { entry?: DocEntry }).entry; if (e) props.onChange!(e.doc); });

  // documents to start with
  const start = async (): Promise<void> => {
    const list = val(props.documents) ?? [];
    for (const d of list) {
      if (d instanceof ImageDocument) ed.addDoc(d);
      else if (d instanceof Uint8Array || (typeof Blob !== "undefined" && d instanceof Blob)) await ed.open(d as Uint8Array | Blob, (d as File).name ?? "Image");
      else ed.newDoc(d as DocInit);
    }
    if (!list.length && props.sample !== false) {
      const { samplePhoto } = await import("./sample.ts");
      ed.addDoc(samplePhoto());
    }
  };
  void start();

  // ——— keyboard: shortcuts (remappable), single-key tools, Tab hides the panels ———
  const combo = (e: KeyboardEvent): string => {
    const parts: string[] = [];
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    if (e.ctrlKey || e.metaKey) parts.push("mod");
    let k = e.key.toLowerCase();
    if (k === " ") k = "space";
    if (k === "+") k = "=";
    parts.push(k);
    return parts.join("+");
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!root.contains(e.target as Node) && e.target !== document.body) return;
    if (isTyping(e) || e.defaultPrevented) return;
    const tl = getTool(untrack(ed.tool)), ctx = ed.toolContext();
    if (tl?.key_ && ctx && tl.key_(ctx, { key: e.key, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, type: "down" })) { e.preventDefault(); return; }
    if (e.key === "Enter" && tl?.pending && ctx && tl.pending(ctx)) { e.preventDefault(); tl.commit?.(ctx); return; }
    if (e.key === "Escape" && tl?.pending && ctx && tl.pending(ctx)) { e.preventDefault(); tl.cancel?.(ctx); return; }
    const c = combo(e);
    for (const cmd of ed.commands.values()) {
      if (ed.keyOf(cmd.id) !== c) continue;
      e.preventDefault();
      ed.run(cmd.id);
      return;
    }
    // single-key tools: the key picks the group's current tool, Shift + key cycles the group
    if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      const k = e.key.toLowerCase();
      const slot = TOOL_SLOTS.map((s) => s.filter((id) => getTool(id))).find((s) => s.some((id) => getTool(id)!.key?.toLowerCase() === k));
      if (!slot) return;
      e.preventDefault();
      const now = untrack(ed.tool);
      const inGroup = slot.filter((id) => getTool(id)!.key?.toLowerCase() === k);
      if (e.shiftKey && inGroup.includes(now)) ed.setTool(inGroup[(inGroup.indexOf(now) + 1) % inGroup.length]!);
      else ed.setTool(inGroup.includes(now) ? now : inGroup.find((id) => ed.lastInGroup[getTool(id)!.group] === id) ?? inGroup[0]!);
    }
  };
  on(document, "keydown", onKey);
  on(document, "keyup", (e: KeyboardEvent) => {
    const tl = getTool(untrack(ed.tool)), ctx = ed.toolContext();
    if (tl?.key_ && ctx) tl.key_(ctx, { key: e.key, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, type: "up" });
  });

  // ——— menu bar from the commands ———
  const toItems = (nodes: (MenuNode | EditorCommand | "-")[]): MenuBarItem[] => {
    const out: MenuBarItem[] = [];
    for (const n of nodes) {
      if (n === "-") { if (out.length && out[out.length - 1] !== "-") out.push("-"); continue; }
      if ("items" in n) { out.push({ label: () => t(n.label), items: () => toItems(n.items) }); continue; }
      const cmd = n;
      out.push({
        label: () => t(cmd.label), onSelect: () => ed.run(cmd.id),
        disabled: () => { ed.commandsRev(); ed.active()?.rev(); ed.docs(); return cmd.enabled ? !cmd.enabled(ed) : false; },
        ...(ed.keyOf(cmd.id) ? { shortcut: ed.keyOf(cmd.id)! } : {}),
        ...(cmd.checked ? { checked: () => { ed.active()?.rev(); ed.active()?.view(); ed.screenMode(); ed.workspace(); ed.quickMask(); return cmd.checked!(ed); } } : {}),
      });
    }
    if (out[out.length - 1] === "-") out.pop();
    return out;
  };
  const menus = (): MenuBarMenu[] => { ed.commandsRev(); ed.prefs(); return menuTree(ed.commands.values()).map((m) => ({ label: () => t(m.label), items: () => toItems(m.items) })); };

  // ——— documents area ———
  const docTabs = h(TabList, {
    class: "m-pe-doctabs", label: () => L().documents ?? t`Documents`,
    tabs: () => ed.docs().filter((d) => !d.floating()).map((d) => ({ id: d.id, label: () => `${d.doc.name} @ ${Math.round(d.view().zoom * 100)}%`, closable: true, dirty: () => { d.srev(); d.rev(); return d.doc.dirtySinceSave; }, icon: ICONS.fill })),
    value: () => ed.activeId(), onSelect: (id: string) => ed.activate(id), onClose: (id: string) => ed.shared.ui && (ed.shared.ui as (w: string, d?: unknown) => void)("close", id),
  });
  const docArea = h("div", { class: "m-pe-docs" },
    () => (ed.docs().some((d) => !d.floating()) ? docTabs : null),
    () => {
      const e = ed.active();
      if (!e || e.floating()) return startScreen();
      return untrack(() => h(CanvasView, { editor: ed, entry: e, onContext: (ev: MouseEvent, x: number, y: number) => openContext(ev, x, y) }));
    },
    () => ed.docs().filter((d) => d.floating()).map((d) => untrack(() => h(Window, {
      title: () => d.doc.name, chrome: "hadi", width: 560, height: 420, onClose: () => d.floating.set(false), open: () => d.floating(),
      children: h(CanvasView, { editor: ed, entry: d }),
    }))),
  );

  // the start screen (no document): new, open, recent sizes
  const startScreen = (): unknown => h("div", { class: "m-pe-start" },
    h(Empty, {
      title: () => L().start ?? t`Start a new picture`, description: () => L().startHint ?? t`Create a document, open an image or drop one here.`,
      action: [
        h(Button, { variant: "primary", icon: ICONS.newLayer, onClick: () => ed.run("file.new") }, () => L().newDoc ?? t`New document`),
        h(Button, { variant: "secondary", icon: ICONS.folder, onClick: () => ed.run("file.open") }, () => L().open ?? t`Open…`),
      ],
    }),
  );

  // drop files to open them
  const onDrop = (e: DragEvent): void => {
    const files = [...(e.dataTransfer?.files ?? [])];
    if (!files.length) return;
    e.preventDefault();
    for (const f of files) void ed.open(f, f.name);
  };

  // ——— context menus (canvas, layers, selections) ———
  const openContext = (e: MouseEvent, x: number, y: number): void => {
    const d = ed.doc;
    if (!d) return;
    const run = (id: string, label: string): MenuBarItem => ({ label: t(label), onSelect: () => ed.run(id), disabled: !ed.can(id) });
    const items: MenuBarItem[] = d.selection
      ? [run("select.none", "Deselect"), run("select.inverse", "Select Inverse"), run("select.feather", "Feather…"), run("select.mask", "Select and Mask…"), "-", run("layer.viaCopy", "Layer via Copy"), run("layer.viaCut", "Layer via Cut"), "-", run("edit.fill", "Fill…"), run("edit.stroke", "Stroke…"), run("edit.contentFill", "Content-Aware Fill…"), run("select.transform", "Transform Selection")]
      : [run("select.all", "Select All"), run("layer.new", "New Layer"), run("layer.duplicate", "Duplicate Layer"), "-", run("edit.freeTransform", "Free Transform"), run("layer.mergeVisible", "Merge Visible"), run("layer.flatten", "Flatten Image")];
    void x; void y;
    ctxMenu.set({ x: e.clientX, y: e.clientY, items });
  };

  // ——— status bar ———
  const fmtBytes = (n: number): string => (n > 1 << 30 ? `${(n / (1 << 30)).toFixed(1)} GB` : n > 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  const status = h(StatusBar, {
    label: () => L().status ?? t`Status`,
    items: () => {
      const e = ed.active();
      if (!e) return [{ id: "ready", text: t`Ready` }];
      return [
        { id: "zoom", text: () => `${Math.round(e.view().zoom * 1000) / 10}%`, onSelect: () => ed.run("view.fit"), title: t`Fit on screen`, priority: 9 },
        { id: "size", text: () => { e.srev(); return `${e.doc.width} × ${e.doc.height} px · ${e.doc.dpi} ppi · ${e.doc.mode.toUpperCase()}/${e.doc.depth}`; }, priority: 8 },
        { id: "mem", side: "end", text: () => { e.rev(); const m = e.doc.memory(); return t`Doc: ${fmtBytes(m.layers)} · History: ${fmtBytes(m.history)}`; }, priority: 6 },
        { id: "tool", side: "end", text: () => t(getTool(ed.tool())?.label ?? ""), priority: 4 },
        { id: "said", side: "end", text: () => ed.said(), live: true, priority: 2 },
      ];
    },
  });

  // ——— panels (DockLayout) ———
  const visiblePanels = (): typeof PANELS => (props.panels ? PANELS.filter((p) => props.panels!.includes(p.id)) : PANELS);
  const dockEl = (): unknown => h(DockLayout, {
    class: "m-pe-dock", label: () => L().panels ?? t`Panels`, motion: props.motion !== false,
    panels: () => [...visiblePanels(), ...ed.panels()].map((p) => ({ id: p.id, title: () => t(p.title), icon: p.icon, min: [220, 120] as const, content: () => panelContent(ed, p.id) })),
    presets: Object.fromEntries(Object.entries(WORKSPACES).map(([k, w]) => [k, { title: t(w.title), tree: () => w.tree(row, col, tabs) }])),
    preset: untrack(ed.workspace), persist: "march.photo-editor.dock", api: (a: DockApi) => dock.set(a), commands: "photo-editor.dock",
  });
  effect(() => { const w = ed.workspace(); const a = dock(); if (a) untrack(() => a.preset(w)); });
  ed.addCommand({ id: "window.panels", label: "Panels", hidden: true, run: () => {} });

  // the workspace switcher
  const switcher = (): unknown => h(Segmented, {
    size: "sm" as const, class: "m-pe-workspaces", "aria-label": t`Workspace`,
    options: [{ value: "essentials", label: t`Essentials` }, { value: "photography", label: t`Photography` }, { value: "painting", label: t`Painting` }, { value: "design", label: t`Design` }],
    get value() { return ed.workspace(); }, setValue: (v: Workspace) => ed.workspace.set(v),
  });

  const top = h("div", { class: "m-pe-top" },
    () => (props.menu === false ? null : untrack(() => h(MenuBar, { menus, label: () => L().menu ?? t`Menu`, motion: props.motion === false ? "none" : "scale" }))),
    h("span", { class: "m-pe-top-spacer" }),
    () => (props.workspaceSwitcher === false ? null : untrack(switcher)),
    h(IconButton, { icon: ICONS.zoom, size: "sm", variant: "ghost", label: () => `${t`Search commands`} (${formatKey("mod+f")})`, onClick: () => ed.run("help.palette") }),
  );

  root = h("div", {
    class: () => cx("m-pe", `m-pe-ui-${ed.prefs().uiColor}`, ed.prefs().highContrast && "m-pe-hc", `m-pe-screen-${ed.screenMode()}`, ed.uiHidden() && "m-pe-ui-hidden", !ed.prefs().motion && "m-pe-still", val(props.class)),
    role: "application", "aria-label": () => L().editor ?? t`Photo editor`, "m:theme": ed.prefs().uiColor === "light" ? undefined : "night",
    style: () => ({ height: props.height ?? "100%" }),
    onDragover: (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); }, onDrop,
  },
    () => (ed.screenMode() === "full" || ed.uiHidden() ? null : top),
    () => (props.optionsBar === false || ed.screenMode() === "full" || ed.uiHidden() ? null : untrack(() => h(OptionsBar, { editor: ed, motion: props.motion !== false }))),
    h("div", { class: "m-pe-main" },
      () => (props.toolbar === false || ed.uiHidden() ? null : untrack(() => h(Toolbar, { editor: ed, motion: props.motion !== false, slots: props.tools ? TOOL_SLOTS.map((s) => s.filter((id) => props.tools!.includes(id))) : undefined }))),
      docArea,
      () => (props.dock === false || ed.uiHidden() || ed.screenMode() === "full" ? null : untrack(dockEl)),
    ),
    () => (props.statusBar === false || ed.uiHidden() || ed.screenMode() === "full" ? null : status),
    () => { const c = ctxMenu(); return c ? untrack(() => h(ContextMenu, { x: c.x, y: c.y, open: true, items: () => c.items, onClose: () => ctxMenu.set(null) })) : null; },
    h("div", { class: "m-sr-only", "aria-live": "polite" }, () => ed.said()),
  ) as HTMLElement;

  // the palette lists every command (lazy dialog)
  ed.addCommand({ id: "help.paletteOpen", label: "Command palette", hidden: true, run: () => openDialog(ed, "palette") });
  props.api?.(ed);
  onCleanup(() => { for (const d of untrack(ed.docs)) d.off(); });
  void batch;
  return root;
}
