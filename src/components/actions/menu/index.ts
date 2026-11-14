// Menu and Dropdown (hadi-march/ui): a trigger button with a floating menu of items / actions, or any floating content.
// Folder: src/components/actions/menu/.
import "./menu.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import type { Href } from "../../../router/router.ts";
import { can, type PermCheck } from "../../../access/index.ts";
import { isAction, type Action } from "../../../ui/action.ts";
import type { Placement } from "../../../ui/popover.ts";
import { PopoverPanel } from "../../overlays/popover/index.ts";
import { roving } from "../../../ui/focus.ts";
import { val, cx, uid, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { CheckMark } from "../../feedback/check-mark/index.ts";
import { Button, argsOf, type Args, type ButtonVariant, type ButtonSize } from "../button/index.ts";
import { IconButton } from "../icon-button/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import { Divider } from "../../layout/stack/index.ts";
import { PlainListRow } from "../../data/list-row/core.ts";
import type { ColorToken } from "../../../theme/colors.ts";

// ------------------------------------------------------------------ menus
/** A plain menu entry. `onSelect` receives the menu's `args`. */
export interface MenuItemSpec {
  label: MaybeFn<string>;
  onSelect?(...args: unknown[]): unknown;
  icon?: unknown;
  href?: Href;
  danger?: boolean;
  disabled?: MaybeFn<boolean>;
  hidden?: MaybeFn<boolean>;
  can?: PermCheck;
  shortcut?: string;
  /** A choice that is on or off: the item becomes a `menuitemcheckbox` (`menuitemradio` with `radio`) with a check mark. */
  checked?: MaybeFn<boolean | undefined>;
  /** With `checked`: one of a group where only one is on (`role="menuitemradio"`). */
  radio?: boolean;
  /** The entry of where the user is now (the open page among its siblings): tinted (the router marks a link to the open page with `aria-current="page"`). */
  current?: MaybeFn<boolean | undefined>;
  /** A second, quieter line under the label. */
  sub?: MaybeFn<string | undefined>;
  separator?: false;
}
/** A menu entry: a plain item, an action(), or a separator ("-" or `{ separator: true }`). */
export type MenuItem = MenuItemSpec | Action | "-" | { separator: true };

/** Is this menu entry a separator ("-" or `{ separator: true }`)? */
export const isSep = (it: MenuItem): it is "-" | { separator: true } => it === "-" || !!(it as { separator?: boolean } | null)?.separator;
/** Is this menu entry shown for `args` (action guard, `hidden`, `can` permission)? */
export const itemVisible = (it: MenuItem, args: unknown[]): boolean => {
  if (isSep(it)) return true;
  if (isAction(it)) return it.visible(...args);
  return !val(it.hidden) && can(it.can);
};
type Disableable = HTMLElement & { disabled?: boolean };
/** The enabled item elements of a menu panel (`menuitem`, `menuitemcheckbox`, `menuitemradio`), in order (roving focus moves among them). */
export const menuItems = (panel: HTMLElement | undefined): HTMLElement[] => (panel ? Array.from(panel.querySelectorAll<Disableable>('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')).filter((x) => !x.disabled) : []);

/** An action() as a plain entry: one row drawer for both kinds. */
const specOf = (it: Action, args: unknown[]): MenuItemSpec => ({
  label: () => it.label(), icon: it.opts.icon, disabled: () => it.disabled(...args), onSelect: () => { it.run(...args).catch(() => {}); },
  ...(it.opts.danger ? { danger: true } : {}), ...(it.opts.key ? { shortcut: it.opts.key } : {}),
});

/** Draw one menu entry: a separator (Divider) or a ListRow (a router link with `href`, a button otherwise). ContextMenu reuses it. */
export function renderItem(it: MenuItem, args: unknown[], close: (refocus: boolean) => void): unknown {
  if (isSep(it)) { const sep = h(Divider, { class: "m-menu-sep" }) as Element; sep.setAttribute("role", "separator"); return sep; }
  const x = isAction(it) ? specOf(it, args) : it;
  const choice = x.checked !== undefined;
  const trail = choice || x.shortcut ? [choice && h(CheckMark, { variant: "bare", label: false, class: "m-menu-check" }), x.shortcut && h(Kbd, { keys: x.shortcut, class: "m-menu-kbd" })] : undefined;
  const row = { size: "sm" as const, overflow: "wrap" as const, tabindex: "-1", class: cx("m-menu-item", x.danger && "is-danger", x.sub !== undefined && "is-two-line"), lead: x.icon, title: () => val(x.label), trail,
    ...(x.sub !== undefined ? { sub: () => val(x.sub) } : {}), ...(x.current !== undefined ? { active: () => !!val(x.current) } : {}) };
  if (x.href) return h(PlainListRow, { ...row, href: x.href, role: "menuitem", "on:click": () => close(false) });
  return h(PlainListRow, {
    ...row, role: choice ? (x.radio ? "menuitemradio" : "menuitemcheckbox") : "menuitem", "aria-checked": choice ? () => String(!!val(x.checked)) : null,
    disabled: () => !!val(x.disabled), onClick: () => { close(true); x.onSelect?.(...args); },
  });
}

/** Props shared by <Menu> and <Dropdown> (the trigger button and its panel). */
export interface PopoverButtonProps {
  /** Trigger text and accessible name. */
  label?: MaybeFn<string>;
  /** Icon-only trigger. */
  icon?: unknown;
  /** Custom trigger content. */
  trigger?: unknown;
  variant?: MaybeFn<ButtonVariant | undefined>;
  size?: MaybeFn<ButtonSize | undefined>;
  /** Theme color token of the trigger (the primary variant's fill, an icon trigger's icon). */
  color?: ColorToken | undefined;
  class?: ClassProp;
  panelClass?: string;
  placement?: Placement;
  disabled?: MaybeFn<boolean | null | undefined>;
}

/** What the shared menu panel needs: where it hangs, when it is open, what it lists. */
export interface MenuPanelOptions {
  /** The element the panel is placed by (the trigger, or a point for a context menu). */
  anchor: () => Element | undefined;
  open: () => boolean;
  /** Called when the panel wants to close; `refocus`: focus goes back to where it came from (Escape, a choice). */
  close: (refocus?: boolean) => void;
  /** The entries of this opening (already filtered by `itemVisible`). */
  items: () => readonly MenuItem[];
  args?: () => unknown[];
  label?: MaybeFn<string | null | undefined>;
  id?: string;
  class?: string | undefined;
  placement?: Placement | undefined;
  ref?: (panel: HTMLElement) => void;
}
/**
 * The floating panel of a menu, drawn once for Menu and ContextMenu: a Popover panel with `role="menu"`, the entries
 * (renderItem), arrow keys / Home / End among them, Tab closes.
 */
export function menuPanel(o: MenuPanelOptions): unknown {
  let panel: HTMLElement | undefined;
  return h(PopoverPanel, {
    anchor: o.anchor, open: o.open, onOpenChange: (on: boolean, why: string) => { if (!on) o.close(why === "escape"); },
    role: "menu", ...(o.id ? { id: o.id } : {}), label: () => val(o.label) ?? undefined, placement: o.placement, flush: true, autoFocus: false, panelClass: cx("m-menu", o.class),
    panelProps: { ref: (x: HTMLElement) => { panel = x; o.ref?.(x); }, onKeydown: (e: KeyboardEvent) => { if (e.key === "Tab") o.close(false); else roving(e, menuItems(panel)); } },
    children: () => { const args = o.args?.() ?? []; const items = o.items(); return untrack(() => items.map((it) => renderItem(it, args, (refocus) => o.close(refocus)))); },
  });
}

// Shared trigger (Button / IconButton) of Menu and Dropdown: the ARIA of a popup button; `panel` draws what it opens.
function popButton(props: PopoverButtonProps, role: "menu" | "dialog", panel: (p: { anchor: () => HTMLElement | undefined; open: () => boolean; close: (refocus?: boolean) => void; id: string; ref: (x: HTMLElement) => void }) => unknown): unknown[] {
  const open = signal(false);
  const id = uid("m-pop");
  let trigger: HTMLElement | undefined, panelEl: HTMLElement | undefined;
  const close = (refocus?: boolean): void => { open.set(false); if (refocus) trigger?.focus(); };
  const focusIn = (i: number): void => queueMicrotask(() => { const els = role === "menu" ? menuItems(panelEl) : []; (i < 0 ? els[els.length - 1] : els[i])?.focus(); });
  const show = (i = 0): void => { open.set(true); focusIn(i); };
  // the trigger is an IconButton (icon only) or a Button; its own content goes in unwrapped (Button's icon slot passes nodes through)
  const iconOnly = !!props.icon && props.trigger == null;
  const own = props.trigger != null && typeof props.trigger !== "string";
  const attrs = {
    ref: (x: HTMLElement) => { trigger = x; }, class: () => val(props.class), size: () => val(props.size), color: props.color,
    "aria-haspopup": role === "menu" ? "menu" : "dialog", "aria-expanded": () => String(open()), "aria-controls": id,
    "aria-label": (() => val(props.label) ?? null) as () => string, disabled: () => !!val(props.disabled),
    onClick: () => (open.peek() ? close(false) : show(0)),
    onKeydown: (e: KeyboardEvent) => {
      if (role !== "menu") return;
      if (e.key === "ArrowDown") { e.preventDefault(); show(0); } else if (e.key === "ArrowUp") { e.preventDefault(); show(-1); }
    },
  };
  const btn = iconOnly ? h(IconButton, { ...attrs, icon: props.icon })
    : h(Button, { ...attrs, variant: () => val(props.variant), ...(own ? { icon: props.trigger } : { children: props.trigger ?? (() => val(props.label)) }) });
  return [btn, panel({ anchor: () => trigger, open: () => open(), close, id, ref: (x) => { panelEl = x; } })];
}

/** Props of <Menu>. `args` are passed to actions and `onSelect`. */
export interface MenuProps extends PopoverButtonProps {
  items: MaybeFn<readonly MenuItem[] | null | undefined>;
  args?: Args<unknown[]>;
}
/**
 * Dropdown menu. items: [{ label, onSelect, icon, href, danger, disabled, hidden, can, shortcut, checked, radio } | action | "-"].
 * `<Menu label="Row actions" icon="⋯" items={[edit, remove, "-", { label: "Open", href: "/x" }]} args={[row]} />`
 * Keyboard: ↓/↑ on the trigger opens, ↑ ↓ Home End move, Enter activates, Esc closes, Tab leaves.
 */
export function Menu(props: MenuProps): unknown[] {
  return popButton(props, "menu", (p) => menuPanel({
    ...p, label: () => val(props.label), class: props.panelClass, placement: props.placement, args: () => argsOf(props),
    items: () => { const args = argsOf(props); return (val(props.items) ?? []).filter((it) => itemVisible(it, args)); },
  }));
}

/** Props of <Dropdown>: children may be a function of `close`. */
export interface DropdownProps extends PopoverButtonProps { children?: unknown }
/** Trigger with arbitrary floating content (a Popover on a button): `<Dropdown label="Filters">{(close) => …}</Dropdown>` */
export function Dropdown(props: DropdownProps): unknown[] {
  return popButton(props, "dialog", (p) => h(PopoverPanel, {
    anchor: p.anchor, open: p.open, onOpenChange: (on: boolean, why: string) => { if (!on) p.close(why === "escape"); },
    role: null, id: p.id, placement: props.placement, autoFocus: false, panelClass: cx("m-dropdown", props.panelClass), panelProps: { ref: p.ref },
    children: () => (typeof props.children === "function" && props.children.length ? (props.children as (close: (refocus?: boolean) => void) => unknown)(p.close) : props.children),
  }));
}
