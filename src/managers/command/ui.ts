// Fill menus, context menus, toolbars and buttons from the command registry.
//
//   <Menu label="File" items={commandItems({ group: "File" })} />
//   <CommandButton command="doc.save" />                 (busy → loading, when → disabled, can → hidden)
//   <CommandToolbar pick={["doc.save", "doc.share"]} />  (icon buttons with tooltips and shortcuts)
//   bindCommandKeys()                                    (bind every command's shortcut)
import { effect, createRoot, untrack, getOwner, onCleanup } from "../../core/reactive.ts";
import { h } from "../../dom/h.ts";
import { t, messages } from "../../core/i18n.ts";
import { Button, ButtonGroup } from "../../ui/button.ts";
import { key, formatKey } from "../../ui/keys.ts";
import type { MenuItemSpec } from "../../ui/menu.ts";
import { commands, pickCommands, type Command, type CommandPick } from "./index.ts";

messages("tr", { Toolbar: "Araç çubuğu", Commands: "Komutlar" });
const noop = (): void => {};

/** One command as a menu entry (Menu, a future ContextMenu): label, icon, shortcut, disabled, hidden. */
export const commandMenuItem = (c: Command, args: unknown[] = []): MenuItemSpec => ({
  label: () => c.title(),
  icon: c.spec.icon,
  ...(c.spec.shortcut ? { shortcut: c.spec.shortcut } : {}),
  ...(c.spec.danger ? { danger: true } : {}),
  disabled: () => !c.enabled(...args),
  hidden: () => !c.visible(),
  onSelect: (...a: unknown[]) => { void c.run(...(a.length ? a : args)).catch(noop); },
});

/** Menu items from the registry (reactive accessor: commands registered later appear). */
export function commandItems(pick: CommandPick, args: unknown[] = []): () => MenuItemSpec[] {
  const list = pickCommands(pick);
  return () => list().map((c) => commandMenuItem(c, args));
}

export interface CommandButtonProps {
  /** Command id. @tr Komut id'si. */
  command: string;
  /** Arguments passed to the command's run and enabled checks. @tr Komutun çalıştırma ve etkinlik denetimlerine verilen argümanlar. */
  args?: unknown[];
  /** The button look; default danger for a danger command, else the Button default. @tr Düğme görünümü; tehlikeli komutta varsayılan danger, değilse Button'un varsayılanı. */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dark";
  /** Button size: sm, md or lg. @tr Düğme boyutu: sm, md ya da lg. */
  size?: "sm" | "md" | "lg";
  /** Icon only (the title becomes the label and tooltip). @tr Yalnız ikon (başlık etiket ve araç ipucu olur). */
  iconOnly?: boolean;
  /** The button text (default the command's title). @tr Düğme metni (varsayılan komutun başlığı). */
  children?: unknown;
}

/** A Button bound to a command: runs it, shows its busy state, follows `when` and `can`. */
export function CommandButton(props: CommandButtonProps): unknown {
  const cmd = (): Command | undefined => commands.list().find((c) => c.id === props.command);
  return () => {
    const c = cmd();
    if (!c || !c.visible()) return null;
    const args = props.args ?? [];
    const tip = (): string => (c.spec.shortcut ? `${c.title()} (${formatKey(c.spec.shortcut)})` : c.title());
    return untrack(() => h(Button, {
      variant: props.variant ?? (c.spec.danger ? "danger" : undefined),
      size: props.size,
      icon: c.spec.icon,
      loading: () => c.busy(),
      disabled: () => !c.enabled(...args),
      title: tip,
      "aria-label": props.iconOnly ? tip : undefined,
      "aria-keyshortcuts": c.spec.shortcut,
      "on:click": () => { void c.run(...args).catch(noop); },
    }, props.iconOnly ? null : (props.children ?? (() => c.title()))));
  };
}

export interface CommandToolbarProps {
  /** Which commands: a list of ids, `{ group }` or a filter function (only permitted ones show). @tr Hangi komutlar: id listesi, `{ group }` ya da bir filtre fonksiyonu (yalnız izin verilenler gösterilir). */
  pick: CommandPick;
  /** aria-label of the toolbar (default "Toolbar"). @tr Araç çubuğunun aria-label'ı (varsayılan "Toolbar"). */
  label?: string;
  /** Buttons show only their icons. @tr Düğmeler yalnız ikonlarını gösterir. */
  iconOnly?: boolean;
  /** Button size (default sm). @tr Düğme boyutu (varsayılan sm). */
  size?: "sm" | "md" | "lg";
}

/** A toolbar (button group) filled from the registry. */
export function CommandToolbar(props: CommandToolbarProps): unknown {
  const list = pickCommands(props.pick);
  return h(ButtonGroup, { label: () => props.label ?? t("Toolbar") },
    () => list().map((c) => untrack(() => h(CommandButton, { command: c.id, size: props.size ?? "sm", iconOnly: props.iconOnly ?? false }))));
}

/**
 * Bind every registered command's shortcut (through ui/keys). Re-binds when commands change. Returns unbind.
 * Simple binding: no scopes, the newest command wins a conflict.
 */
export function bindCommandKeys(): () => void {
  const bound = new Map<string, () => void>();
  const sync = (): void => {
    const now = new Set<string>();
    for (const c of commands.list()) {
      const combo = c.spec.shortcut;
      if (!combo) continue;
      const k = `${c.id}|${combo}`;
      now.add(k);
      if (!bound.has(k)) bound.set(k, untrack(() => key(combo, () => { void c.run().catch(noop); }, { when: () => c.enabled(), description: () => c.title(), group: c.spec.group ?? t("Commands") })));
    }
    for (const [k, off] of bound) if (!now.has(k)) { off(); bound.delete(k); }
  };
  // follow the registry in a root of our own (the caller's owner only decides when to unbind)
  const stop = createRoot((dispose) => { effect(() => { commands.list(); untrack(sync); }); return dispose; }, null);
  const unbind = (): void => { stop(); for (const o of bound.values()) o(); bound.clear(); };
  if (getOwner()) onCleanup(unbind);
  return unbind;
}

/** What a bar item needs from a command: label, icon, shortcut, availability, run. Fields of `item` win over the command's. */
export interface CommandBinding { label: () => string; icon: () => unknown; shortcut: () => string | undefined; disabled: () => boolean; hidden: () => boolean; busy: () => boolean; run: () => void }
/**
 * Bind a toolbar / status bar item to a command id (OverflowToolbar, StatusBar): its own `label`, `icon`, `shortcut`,
 * `disabled` and `onSelect` override the command's. Reactive: a command registered later is picked up.
 */
export function commandBinding(item: { command?: string | undefined; label?: unknown; icon?: unknown; shortcut?: string | undefined; disabled?: unknown; onSelect?: (() => unknown) | undefined }): CommandBinding {
  const cmd = (): Command | undefined => (item.command ? commands.list().find((c) => c.id === item.command) : undefined);
  const read = (v: unknown): unknown => (typeof v === "function" ? (v as () => unknown)() : v);
  return {
    label: () => (read(item.label) as string | undefined) ?? cmd()?.title() ?? item.command ?? "",
    icon: () => item.icon ?? cmd()?.spec.icon,
    shortcut: () => item.shortcut ?? cmd()?.spec.shortcut,
    disabled: () => !!read(item.disabled) || (!!item.command && !(cmd()?.enabled() ?? false)),
    hidden: () => !!item.command && !!cmd() && !cmd()!.visible(),
    busy: () => cmd()?.busy() ?? false,
    run: () => { if (item.onSelect) void item.onSelect(); else void cmd()?.run().catch(noop); },
  };
}
