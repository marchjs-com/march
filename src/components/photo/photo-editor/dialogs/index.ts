// The editor's dialogs and other UI requests from commands (`ed.shared.ui(what, data)`): each one is its own module,
// loaded on first use. A dialog module's default export opens it: (ed, { what, data }, ctx) => void | Promise<void>.
import type { Editor } from "../editor.ts";
import type { ImageDocument } from "../../../../image/doc/index.ts";

export interface DialogContext {
  save?: ((bytes: Uint8Array, doc: ImageDocument) => void) | undefined;
  export?: ((file: Blob, name: string) => void) | undefined;
  root: () => HTMLElement;
}
export interface DialogRequest { what: string; data: unknown }
export type DialogModule = { default: (ed: Editor, req: DialogRequest, ctx: DialogContext) => unknown };

/** What → module. Requests without a module are announced as not available. */
const DIALOGS: Record<string, () => Promise<DialogModule>> = {
  new: () => import("./new-document.ts"),
  open: () => import("./files.ts"), save: () => import("./files.ts"), saveAs: () => import("./files.ts"), close: () => import("./files.ts"), place: () => import("./files.ts"), quickExport: () => import("./files.ts"), print: () => import("./files.ts"), duplicateDoc: () => import("./files.ts"),
  export: () => import("./export.ts"),
  prefs: () => import("./preferences.ts"), shortcuts: () => import("./preferences.ts"), colorSettings: () => import("./preferences.ts"),
  imageSize: () => import("./image-size.ts"), canvasSize: () => import("./image-size.ts"), rotateAny: () => import("./image-size.ts"), trim: () => import("./image-size.ts"),
  layerStyle: () => import("./layer-style.ts"),
  fill: () => import("./edit-dialogs.ts"), stroke: () => import("./edit-dialogs.ts"), fade: () => import("./edit-dialogs.ts"), contentFill: () => import("./edit-dialogs.ts"), generativeFill: () => import("./edit-dialogs.ts"), definePattern: () => import("./edit-dialogs.ts"), defineBrush: () => import("./edit-dialogs.ts"), patternFill: () => import("./edit-dialogs.ts"), contentScale: () => import("./edit-dialogs.ts"), autoAlign: () => import("./edit-dialogs.ts"), autoBlend: () => import("./edit-dialogs.ts"),
  modify: () => import("./select-dialogs.ts"), colorRange: () => import("./select-dialogs.ts"), selectAndMask: () => import("./select-dialogs.ts"), loadSelection: () => import("./select-dialogs.ts"), findLayers: () => import("./select-dialogs.ts"),
  mode: () => import("./image-dialogs.ts"), depth: () => import("./image-dialogs.ts"), assignProfile: () => import("./image-dialogs.ts"), convertProfile: () => import("./image-dialogs.ts"), applyImage: () => import("./image-dialogs.ts"), calculations: () => import("./image-dialogs.ts"), adjustmentLayer: () => import("./image-dialogs.ts"), picker: () => import("./image-dialogs.ts"),
  variables: () => import("./automation.ts"), dataSets: () => import("./automation.ts"), batch: () => import("./automation.ts"),
  newGuide: () => import("./view-dialogs.ts"), guideLayout: () => import("./view-dialogs.ts"), presentation: () => import("./view-dialogs.ts"), resetWorkspace: () => import("./view-dialogs.ts"), fileInfo: () => import("./view-dialogs.ts"), about: () => import("./view-dialogs.ts"), palette: () => import("./view-dialogs.ts"),
};

/** Open a dialog / run a UI request. */
export async function openDialog(ed: Editor, what: string, data?: unknown, ctx?: Partial<DialogContext>): Promise<unknown> {
  const load = DIALOGS[what];
  if (!load) { ed.announce(`${what}: not available`); return undefined; }
  const m = await load();
  return m.default(ed, { what, data }, { root: () => globalThis.document.body, ...ctx });
}
