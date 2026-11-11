// Shared registries: pages (from NavMenu) and commands, searched by the command palette.
import { signal, getOwner, onCleanup } from "../core/reactive.js";
import { val } from "./util.js";

const pageLists = signal([], { name: "palette.pages" });
const commandLists = signal([], { name: "palette.commands" });

function add(store, list) {
  store.update((l) => [...l, list]);
  const off = () => store.update((l) => l.filter((x) => x !== list));
  if (getOwner()) onCleanup(off);
  return off;
}
/** Make pages ({ id, title, href, group, keywords, icon }) searchable. `list` may be an accessor. Returns unregister. */
export const registerPages = (list) => add(pageLists, list);
/**
 * Register palette commands: [{ id, title, run, href, group, keywords, icon, shortcut, hidden, can }] or action() objects.
 * `list` may be an accessor. Removed with the current owner, or call the returned function.
 */
export const registerCommands = (list) => add(commandLists, list);
/** Registered pages (reactive). */
export const pages = () => pageLists().flatMap((l) => val(l) ?? []);
/** Registered commands (reactive). */
export const commands = () => commandLists().flatMap((l) => val(l) ?? []);
