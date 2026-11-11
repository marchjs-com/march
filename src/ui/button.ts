// Buttons, menus, tooltips and the copy button.
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Link, type Href } from "../router/index.ts";
import { can, type PermCheck } from "../access/index.ts";
import { isAction, type Action } from "./action.ts";
import { toast } from "./toast.ts";
import { floating, type Placement } from "./popover.ts";
import { roving } from "./focus.ts";
import { formatKey } from "./keys.ts";
import { val, cx, rest, uid, icon, glyph, later, debounce, type MaybeFn, type ClassProp } from "./util.ts";
import { check, copy as copyIcon } from "../icons/set.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
const SIZES: Record<string, string | undefined> = { sm: "hm-btn-sm", lg: "hm-btn-lg" };
const sizeClass = (s: ButtonSize | null | undefined): string | undefined => (s ? SIZES[s] : undefined);

/** Props of <Button>. Other props (onClick, title, aria-*, data-*) go to the <button> / <a>. */
export interface ButtonProps {
  variant?: MaybeFn<ButtonVariant | undefined>;
  size?: MaybeFn<ButtonSize | undefined>;
  loading?: MaybeFn<boolean | null | undefined>;
  icon?: unknown;
  iconEnd?: unknown;
  block?: boolean;
  /** Renders a router Link. */
  href?: MaybeFn<Href>;
  disabled?: MaybeFn<boolean | null | undefined>;
  type?: "button" | "submit" | "reset";
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}

/**
 * `<Button variant="primary" size="sm" loading={$saving} icon="+" href="/x" block>Save</Button>`
 * variant: primary | secondary (default) | ghost | danger. size: sm | md | lg. `href` renders a router Link.
 */
export function Button(props: ButtonProps): unknown {
  const loading = (): boolean => !!val(props.loading);
  const cls = (): string => cx("hm-btn", `hm-btn-${val(props.variant) ?? "secondary"}`, sizeClass(val(props.size)), props.block && "hm-btn-block", loading() && "is-loading", val(props.class));
  const body = [
    () => (loading() ? h("span", { class: "hm-loading hm-btn-spin", "aria-hidden": "true" }) : icon(val(props.icon))),
    props.children != null && h("span", { class: "hm-btn-label" }, props.children),
    props.iconEnd != null && icon(props.iconEnd),
  ];
  const attrs = rest(props, ["variant", "size", "loading", "icon", "iconEnd", "block", "href", "disabled", "type"]);
  if (props.href != null) return h(Link, { ...attrs, href: () => val(props.href as MaybeFn<Href>), class: cls, children: body });
  return h("button", {
    ...attrs, type: props.type ?? "button", class: cls,
    disabled: () => !!val(props.disabled) || loading(), "aria-busy": () => (loading() ? "true" : null),
  }, body);
}

/** Props of <IconButton>. `label` (or aria-label) is required. */
export interface IconButtonProps {
  icon?: unknown;
  label?: MaybeFn<string>;
  "aria-label"?: MaybeFn<string>;
  variant?: string;
  size?: MaybeFn<ButtonSize | undefined>;
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}
/** Icon-only button. `label` is required (aria-label + tooltip title). `<IconButton icon="✕" label="Close" onClick={…}/>` */
export function IconButton(props: IconButtonProps): Element {
  if (props.label == null && props["aria-label"] == null) throw new Error("March: <IconButton> needs a label (accessible name).");
  const attrs = rest(props, ["icon", "label", "variant", "size"]);
  return h("button", {
    type: "button", ...attrs, class: () => cx("hm-icon-btn", props.variant && `hm-icon-btn-${props.variant}`, sizeClass(val(props.size)), val(props.class)),
    "aria-label": () => val(props.label) ?? val(props["aria-label"]), title: () => val(props.label),
  }, icon(val(props.icon)) ?? props.children);
}

export interface ButtonGroupProps { label?: MaybeFn<string>; attached?: boolean; class?: ClassProp; children?: unknown }
/** Group related buttons: `<ButtonGroup label="View">…</ButtonGroup>` */
export function ButtonGroup(props: ButtonGroupProps): Element {
  return h("div", { class: () => cx("hm-btn-group", props.attached && "hm-btn-group-attached", val(props.class)), role: "group", "aria-label": () => val(props.label) ?? null }, props.children);
}

type Args<A extends readonly unknown[]> = A | (() => A) | null | undefined;
const argsOf = <A extends readonly unknown[]>(props: { args?: Args<A> }): A => ((typeof props.args === "function" ? props.args() : props.args) ?? []) as A;

/** Props of <ActionButton>. `args` (or an accessor for them) are passed to the action. */
export interface ActionButtonProps<A extends unknown[] = unknown[], R = unknown> {
  action: Action<A, R>;
  args?: Args<A>;
  variant?: MaybeFn<ButtonVariant | undefined>;
  size?: MaybeFn<ButtonSize | undefined>;
  icon?: unknown;
  class?: ClassProp;
  /** Only the icon; the label becomes the aria-label. */
  iconOnly?: boolean;
  onDone?: (result: R | undefined) => void;
  onError?: (error: unknown) => void;
  children?: unknown;
}

/**
 * Render an action() as a button: hidden when the user may not run it, disabled while busy, confirm/reason/toasts handled
 * by the action. `<ActionButton action={remove} args={[row]} variant="danger" size="sm" />`
 */
export function ActionButton<A extends unknown[], R>(props: ActionButtonProps<A, R>): () => unknown {
  return () => {
    const a = props.action;
    if (!isAction(a)) return null;
    const args = argsOf(props);
    if (!a.visible(...args)) return null;
    return untrack(() => h(Button, {
      variant: props.variant ?? (a.opts.danger ? "danger" : "secondary"), size: props.size, icon: props.icon ?? a.opts.icon, class: props.class,
      loading: () => a.busy(), disabled: () => a.disabled(...argsOf(props)),
      title: a.opts.key ? `${a.label()} (${formatKey(a.opts.key)})` : null,
      onClick: async () => {
        try { const r = await a.run(...argsOf(props)); props.onDone?.(r); } catch (e) { props.onError?.(e); } // errors were toasted by the action
      },
      children: props.children ?? (props.iconOnly ? null : () => a.label()),
      "aria-label": props.iconOnly ? () => a.label() : null,
    }));
  };
}

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
  separator?: false;
}
/** A menu entry: a plain item, an action(), or a separator ("-" or `{ separator: true }`). */
export type MenuItem = MenuItemSpec | Action | "-" | { separator: true };

const isSep = (it: MenuItem): it is "-" | { separator: true } => it === "-" || !!(it as { separator?: boolean } | null)?.separator;
const itemVisible = (it: MenuItem, args: unknown[]): boolean => {
  if (isSep(it)) return true;
  if (isAction(it)) return it.visible(...args);
  return !val(it.hidden) && can(it.can);
};
type Disableable = HTMLElement & { disabled?: boolean };
const menuItems = (panel: HTMLElement | undefined): HTMLElement[] => (panel ? Array.from(panel.querySelectorAll<Disableable>('[role="menuitem"]')).filter((x) => !x.disabled) : []);

function renderItem(it: MenuItem, args: unknown[], close: (refocus: boolean) => void): unknown {
  if (isSep(it)) return h("div", { role: "separator", class: "hm-menu-sep" });
  if (isAction(it)) {
    return h("button", {
      type: "button", role: "menuitem", tabindex: "-1", class: cx("hm-menu-item", it.opts.danger && "is-danger"), disabled: () => it.disabled(...args),
      onClick: () => { close(true); it.run(...args).catch(() => {}); },
    }, icon(it.opts.icon), h("span", { class: "hm-menu-label" }, () => it.label()), it.opts.key && h("kbd", { class: "hm-kbd hm-menu-kbd" }, formatKey(it.opts.key)));
  }
  const body = [icon(it.icon), h("span", { class: "hm-menu-label" }, () => val(it.label)), it.shortcut && h("kbd", { class: "hm-kbd hm-menu-kbd" }, formatKey(it.shortcut))];
  const cls = cx("hm-menu-item", it.danger && "is-danger");
  if (it.href) return h(Link, { href: it.href, role: "menuitem", tabindex: "-1", class: cls, "on:click": () => close(false), children: body });
  return h("button", { type: "button", role: "menuitem", tabindex: "-1", class: cls, disabled: () => !!val(it.disabled), onClick: () => { close(true); it.onSelect?.(...args); } }, body);
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
  const btn = h("button", {
    type: "button", ref: (x: HTMLElement) => { trigger = x; },
    class: () => cx(props.icon && props.trigger == null ? "hm-icon-btn" : `hm-btn hm-btn-${val(props.variant) ?? "secondary"}`, sizeClass(val(props.size)), val(props.class)),
    "aria-haspopup": role === "menu" ? "menu" : "dialog", "aria-expanded": () => String(open()), "aria-controls": id,
    "aria-label": () => val(props.label) ?? null, disabled: () => !!val(props.disabled),
    onClick: () => (open.peek() ? close(false) : show(0)),
    onKeydown: (e: KeyboardEvent) => {
      if (role !== "menu") return;
      if (e.key === "ArrowDown") { e.preventDefault(); show(0); } else if (e.key === "ArrowUp") { e.preventDefault(); show(-1); }
    },
  }, props.trigger ?? icon(props.icon) ?? (() => val(props.label)));
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
 * Dropdown menu. items: [{ label, onSelect, icon, href, danger, disabled, hidden, can, shortcut } | action | "-"].
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

export interface TooltipProps { text: MaybeFn<string>; placement?: Placement; children?: unknown }
/** `<Tooltip text="Copy link" placement="top"><button>…</button></Tooltip>` — on hover and keyboard focus. */
export function Tooltip(props: TooltipProps): unknown[] {
  const show = signal(false);
  const id = uid("hm-tip");
  let anchor: HTMLElement | undefined;
  const open = debounce(() => show.set(true), 300);
  const hide = (): void => { open.cancel(); show.set(false); };
  const wrap = h("span", {
    class: "hm-tip-anchor", ref: (x: HTMLElement) => { anchor = x; },
    onMouseenter: open, onMouseleave: hide, onFocusin: () => show.set(true), onFocusout: hide,
    onKeydown: (e: KeyboardEvent) => { if (e.key === "Escape") hide(); },
  }, props.children);
  const target = (): Element => (anchor as HTMLElement).firstElementChild ?? (anchor as HTMLElement);
  return [wrap, () => {
    const on = show();
    untrack(() => (on ? target().setAttribute("aria-describedby", id) : target().removeAttribute("aria-describedby")));
    return on && untrack(() => floating({ anchor, placement: props.placement ?? "top", role: "tooltip", id, class: "hm-tooltip", onClose: hide, children: () => val(props.text) }));
  }];
}

export interface CopyButtonProps {
  text: MaybeFn<string | number | null | undefined>;
  label?: MaybeFn<string>;
  iconOnly?: boolean;
  class?: ClassProp;
  onCopy?: () => void;
}
/** Copy text to the clipboard: `<CopyButton text={() => token} label="Copy" />` */
export function CopyButton(props: CopyButtonProps): Element {
  const copied = signal(false);
  const copy = async (): Promise<void> => {
    try {
      await globalThis.navigator.clipboard.writeText(String(val(props.text) ?? ""));
      copied.set(true);
      later(() => copied.set(false), 1500);
      props.onCopy?.();
    } catch { toast(t`Could not copy to the clipboard.`, { kind: "danger" }); }
  };
  return h("button", {
    type: "button", class: () => cx(props.iconOnly ? "hm-icon-btn" : "hm-btn hm-btn-ghost hm-btn-sm", "hm-copy", copied() && "is-copied", val(props.class)),
    onClick: copy, "aria-live": "polite",
    "aria-label": () => (props.iconOnly ? (copied() ? t`Copied` : val(props.label) ?? t`Copy`) : null),
  }, () => (props.iconOnly ? glyph(copied() ? check : copyIcon) : copied() ? t`Copied` : val(props.label) ?? t`Copy`));
}
