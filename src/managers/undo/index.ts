// UndoManager: one undo / redo history for the app, built on the command registry.
//
//   import { undoStack, undoCommands } from "march/managers/undo";
//   const u = undoStack();
//   u.push({ label: "Rename", undo: () => set(old), redo: () => set(next) });  // record a change already made
//   u.run("Delete row", () => remove(row), () => insert(row));               // do it now and record it
//   u.transaction("Paste 3 rows", () => { … several pushes … })             // one step
//   u.undo()  u.redo()  u.canUndo()  u.past()  u.future()  u.markSaved()  u.atSaved()
//
// Commands: a command whose run() returns { undo, redo? } is recorded automatically (its title is the label), and
// undoCommands() registers "edit.undo" (mod+z) and "edit.redo" (mod+shift+z) for the palette, menus and buttons.
// Recording starts with the first undoStack() / undoCommands() call.
// Typing-style changes merge: entries with the same `merge` key within `mergeMs` become one step.
import { untrack } from "../../core/reactive.ts";
import { t, messages } from "../../core/i18n.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";
import { command, onCommandRun, type Command } from "../command/index.ts";
import { create, type UndoEntry, type UndoConfig, type UndoStack } from "./history.ts";
import tr from "./tr.ts";

messages("tr", tr);

export type { UndoEntry, UndoConfig, UndoStack } from "./history.ts";
export { undoHistory } from "./history.ts";

const pub = publisher("undo");
const isEntry = (v: unknown): v is UndoEntry => !!v && typeof (v as UndoEntry).undo === "function";

const manager = defineManager<UndoStack, UndoConfig>("undo", (cfg) => {
  const stack = create(cfg, pub);
  // commands that return { undo, redo? } become steps; the command's title is the label
  const off = cfg.commands ? onCommandRun((r) => {
    if (r.id === "edit.undo" || r.id === "edit.redo" || !isEntry(r.result)) return;
    const e = r.result;
    stack.push({ label: e.label || r.title, undo: e.undo, ...(e.redo ? { redo: e.redo } : {}), ...(e.merge ? { merge: e.merge } : {}) });
  }) : null;
  return { ...stack, dispose: () => off?.() };
}, { limit: 100, mergeMs: 1000, commands: true });

/** The app's undo history (created on first call). */
export const undoStack = (): UndoStack => manager.get();
/** Set the undo manager's options (merged into the current config). */
export const configureUndo = (config: Partial<UndoConfig>): void => manager.configure(config);
/** Stop the undo manager and remove its listeners; the next call starts it again. */
export const disposeUndo = (): void => manager.dispose();
/** The undo manager (get, configure, dispose). */
export const undoManager = manager;

/** Register "edit.undo" (mod+z) and "edit.redo" (mod+shift+z); removed with the current owner. */
export function undoCommands(group = "Edit"): [Command, Command] {
  const s = (): UndoStack => undoStack();
  untrack(s); // start recording now
  return [
    command({ id: "edit.undo", title: () => { const l = s().past()[0]; return l ? t`Undo: ${l}` : t`Undo`; }, shortcut: "mod+z", group, when: () => s().canUndo(), run: () => s().undo() }),
    command({ id: "edit.redo", title: () => { const l = s().future()[0]; return l ? t`Redo: ${l}` : t`Redo`; }, shortcut: "mod+shift+z", group, when: () => s().canRedo(), run: () => s().redo() }),
  ];
}
