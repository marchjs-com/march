// Menu and Dropdown (hadi-march/ui): a trigger button with a floating menu of items / actions, or any floating content.
// Folder: src/components/actions/menu/.
import "./menu.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import type { Href } from "../../../router/router.ts";
import { can, type PermCheck } from "../../../access/index.ts";
import { isAction, type Action } from "../../../ui/action.ts";
import { floating, type Placement } from "../../../ui/popover.ts";
import { roving } from "../../../ui/focus.ts";
import { val, cx, uid, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { Button, argsOf, type Args, type ButtonVariant, type ButtonSize } from "../button/index.ts";
import { IconButton } from "../icon-button/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import { Divider } from "../../layout/stack/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
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
  if (isSep(it)) { const sep = h(Divider, { class: "hm-menu-sep" }) as Element; sep.setAttribute("role", "separator"); return sep; }
  const x = isAction(it) ? specOf(it, args) : it;
  const choice = x.checked !== undefined;
  const trail = choice || x.shortcut ? [choice && h("span", { class: "hm-menu-check", "aria-hidden": "true" }, glyph(check)), x.shortcut && h(Kbd, { keys: x.shortcut, class: "hm-menu-kbd" })] : undefined;
  const row = { size: "sm" as const, overflow: "wrap" as const, tabindex: "-1", class: cx("hm-menu-item", x.danger && "is-danger"), lead: x.icon, title: () => val(x.label), trail };
  if (x.href) return h(ListRow, { ...row, href: x.href, role: "menuitem", "on:click": () => close(false) });
  return h(ListRow, {
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

// Shared trigger + floating panel.
function popButton(props: PopoverButtonProps, role: "menu" | "dialog", panelChildren: (close: (refocus?: boolean) => void) => unknown,
  panelKeys?: (e: KeyboardEvent, panel: HTMLElement | undefined, close: (refocus?: boolean) => void) => void): unknown[] {
  const open = signal(false);
  const id = uid("hm-pop");
  let trigger: HTMLElement | undefined, panel: HTMLElement | undefined;
  const close = (refocus?: boolean): void => { open.set(false); if (refocus) trigger?.focus(); };
  const focusIn = (i: number): void => queueMicrotask(() => { const els = role === "menu" ? menuItems(panel) : []; (i < 0 ? els[els.length - 1] : els[i])?.focus(); });
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
  return [btn, () => open() && untrack(() => floating({
    anchor: trigger, placement: props.placement ?? "bottom-start", role: role === "menu" ? "menu" : null, id,
    class: cx(role === "menu" ? "hm-menu" : "hm-dropdown", props.panelClass), onClose: close, ref: (x) => { panel = x; },
    attrs: { "aria-label": role === "menu" ? () => val(props.label) ?? null : null, onKeydown: (e: KeyboardEvent) => panelKeys?.(e, panel, close) },
    children: panelChildren(close),
  }))];
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
  return popButton(props, "menu", (close) => () => {
    const args = argsOf(props);
    const items = (val(props.items) ?? []).filter((it) => itemVisible(it, args));
    return untrack(() => items.map((it) => renderItem(it, args, close)));
  }, (e, panel, close) => {
    if (e.key === "Tab") close(false);
    else roving(e, menuItems(panel));
  });
}

/** Props of <Dropdown>: children may be a function of `close`. */
export interface DropdownProps extends PopoverButtonProps { children?: unknown }
/** Trigger with arbitrary floating content: `<Dropdown label="Filters">{(close) => …}</Dropdown>` */
export function Dropdown(props: DropdownProps): unknown[] {
  return popButton(props, "dialog", (close) => (typeof props.children === "function" && props.children.length ? (props.children as (close: (refocus?: boolean) => void) => unknown)(close) : props.children));
}
