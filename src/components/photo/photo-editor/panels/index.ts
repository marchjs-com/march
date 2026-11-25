// The editor's panels: ids, titles, icons and their modules (each loaded when the panel first shows), plus the saved
// workspaces (Essentials, Photography, Painting, Design) as DockLayout trees.
import { signal, untrack } from "../../../../core/reactive.ts";
import { h } from "../../../../dom/h.ts";
import { Spinner } from "../../../feedback/spinner/index.ts";
import { ICONS } from "../icons.ts";
import type { Editor } from "../editor.ts";
import type { row as Row, col as Col, tabs as Tabs } from "../../../composite/dock-layout/index.ts";

/** A panel module: its default export draws the panel for an editor. */
export type PanelModule = { default: (ed: Editor) => unknown };

export interface PanelDef { id: string; title: string; icon: unknown; load: () => Promise<PanelModule> }

export const PANELS: PanelDef[] = [
  { id: "layers", title: "Layers", icon: ICONS.layers, load: () => import("./layers.ts") },
  { id: "channels", title: "Channels", icon: ICONS.channels, load: () => import("./channels.ts") },
  { id: "paths", title: "Paths", icon: ICONS.paths, load: () => import("./paths.ts") },
  { id: "history", title: "History", icon: ICONS.history, load: () => import("./history.ts") },
  { id: "adjustments", title: "Adjustments", icon: ICONS.adjust, load: () => import("./adjustments.ts") },
  { id: "properties", title: "Properties", icon: ICONS.properties, load: () => import("./properties.ts") },
  { id: "color", title: "Color", icon: ICONS.color, load: () => import("./color.ts") },
  { id: "swatches", title: "Swatches", icon: ICONS.swatches, load: () => import("./swatches.ts") },
  { id: "gradients", title: "Gradients", icon: ICONS.gradients, load: () => import("./gradients.ts") },
  { id: "patterns", title: "Patterns", icon: ICONS.patterns, load: () => import("./patterns.ts") },
  { id: "brushes", title: "Brushes", icon: ICONS.brushes, load: () => import("./brushes.ts") },
  { id: "character", title: "Character", icon: ICONS.character, load: () => import("./character.ts") },
  { id: "paragraph", title: "Paragraph", icon: ICONS.paragraph, load: () => import("./paragraph.ts") },
  { id: "histogram", title: "Histogram", icon: ICONS.histogram, load: () => import("./histogram.ts") },
  { id: "navigator", title: "Navigator", icon: ICONS.navigator, load: () => import("./navigator.ts") },
  { id: "info", title: "Info", icon: ICONS.info, load: () => import("./info.ts") },
  { id: "actions", title: "Actions", icon: ICONS.actions, load: () => import("./actions.ts") },
  { id: "glyphs", title: "Glyphs", icon: ICONS.glyphs, load: () => import("./glyphs.ts") },
  { id: "comments", title: "Comments", icon: ICONS.comments, load: () => import("./comments.ts") },
];

/** The content of a panel (built-in or added by a plugin). */
export function panelContent(ed: Editor, id: string): unknown {
  const own = untrack(ed.panels).find((p) => p.id === id);
  if (own) return own.content(ed);
  const def = PANELS.find((p) => p.id === id);
  if (!def) return null;
  const mod = signal<PanelModule | null>(null);
  void def.load().then((m) => mod.set(m));
  return () => { const m = mod(); return m ? untrack(() => m.default(ed)) : h("div", { class: "m-pe-panel-loading" }, h(Spinner, { size: "sm" })); };
}

type Tree = ReturnType<typeof Tabs>;
export interface WorkspaceDef { title: string; tree: (row: typeof Row, col: typeof Col, tabs: typeof Tabs) => Tree }

/** Saved workspaces. */
export const WORKSPACES: Record<string, WorkspaceDef> = {
  essentials: { title: "Essentials", tree: (_row, col, tabs) => col([0.34, tabs(["color", "swatches", "gradients", "patterns"])], [0.26, tabs(["properties", "adjustments", "history"])], [0.4, tabs(["layers", "channels", "paths"])]) },
  photography: { title: "Photography", tree: (_row, col, tabs) => col([0.28, tabs(["histogram", "navigator", "info"])], [0.3, tabs(["adjustments", "properties", "history"])], [0.42, tabs(["layers", "channels", "paths"])]) },
  painting: { title: "Painting", tree: (_row, col, tabs) => col([0.36, tabs(["brushes", "color", "swatches"])], [0.24, tabs(["navigator", "history"])], [0.4, tabs(["layers", "channels"])]) },
  design: { title: "Design", tree: (_row, col, tabs) => col([0.3, tabs(["properties", "character", "paragraph", "glyphs"])], [0.28, tabs(["swatches", "gradients", "patterns", "comments"])], [0.42, tabs(["layers", "paths", "actions"])]) },
};
