// Shared registries: pages (from NavMenu) and commands, searched by the command palette.
import { signal, getOwner, onCleanup, type Signal } from "../core/reactive.ts";
import type { PermCheck } from "../access/index.ts";
import type { Action } from "./action.ts";
import { val, type MaybeFn } from "./util.ts";

/** A searchable page. */
export interface PageEntry { id: string; title: MaybeFn<string>; href: string; group?: string | undefined; keywords?: string | undefined; icon?: unknown }
/** A palette command (or pass an action()). */
export interface CommandEntry {
  id: string;
  title: MaybeFn<string>;
  run?: () => unknown;
  href?: string;
  group?: string;
  keywords?: string;
  icon?: unknown;
  shortcut?: string;
  hidden?: MaybeFn<boolean>;
  can?: PermCheck;
}
export type Command = CommandEntry | Action;

const pageLists = signal<MaybeFn<readonly PageEntry[] | null | undefined>[]>([], { name: "palette.pages" });
const commandLists = signal<MaybeFn<readonly Command[] | null | undefined>[]>([], { name: "palette.commands" });

function add<L>(store: Signal<L[]>, list: L): () => void {
  store.update((l) => [...l, list]);
  const off = (): void => { store.update((l) => l.filter((x) => x !== list)); };
  if (getOwner()) onCleanup(off);
  return off;
}
/** Make pages ({ id, title, href, group, keywords, icon }) searchable. `list` may be an accessor. Returns unregister. */
export const registerPages = (list: MaybeFn<readonly PageEntry[] | null | undefined>): (() => void) => add(pageLists, list);
/**
 * Register palette commands: [{ id, title, run, href, group, keywords, icon, shortcut, hidden, can }] or action() objects.
 * `list` may be an accessor. Removed with the current owner, or call the returned function.
 */
export const registerCommands = (list: MaybeFn<readonly Command[] | null | undefined>): (() => void) => add(commandLists, list);
/** Registered pages (reactive). */
export const pages = (): PageEntry[] => pageLists().flatMap((l) => val(l) ?? []);
/** Registered commands (reactive). */
export const commands = (): Command[] => commandLists().flatMap((l) => val(l) ?? []);
