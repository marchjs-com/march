// Buttons, menus, tooltips and the copy button.
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { Link } from "../router/index.ts";
import { can } from "../access/index.js";
import { isAction } from "./action.js";
import { toast } from "./toast.js";
import { floating } from "./popover.js";
import { roving } from "./focus.js";
import { formatKey } from "./keys.js";
import { val, cx, rest, uid, icon, later, debounce } from "./util.js";

const SIZES = { sm: "hm-btn-sm", lg: "hm-btn-lg" };

/**
 * `<Button variant="primary" size="sm" loading={$saving} icon="+" href="/x" block>Save</Button>`
 * variant: primary | secondary (default) | ghost | danger. size: sm | md | lg. `href` renders a router Link.
 */
export function Button(props) {
  const loading = () => !!val(props.loading);
  const cls = () => cx("hm-btn", `hm-btn-${val(props.variant) ?? "secondary"}`, SIZES[val(props.size)], props.block && "hm-btn-block", loading() && "is-loading", val(props.class));
  const body = [
    () => (loading() ? h("span", { class: "hm-loading hm-btn-spin", "aria-hidden": "true" }) : icon(val(props.icon))),
    props.children != null && h("span", { class: "hm-btn-label" }, props.children),
    props.iconEnd != null && icon(props.iconEnd),
  ];
  const attrs = rest(props, ["variant", "size", "loading", "icon", "iconEnd", "block", "href", "disabled", "type"]);
  if (props.href != null) return h(Link, { ...attrs, href: () => val(props.href), class: cls, children: body });
  return h("button", {
    ...attrs, type: props.type ?? "button", class: cls,
    disabled: () => !!val(props.disabled) || loading(), "aria-busy": () => (loading() ? "true" : null),
  }, body);
}

/** Icon-only button. `label` is required (aria-label + tooltip title). `<IconButton icon="✕" label="Close" onClick={…}/>` */
export function IconButton(props) {
  if (props.label == null && props["aria-label"] == null) throw new Error("March: <IconButton> needs a label (accessible name).");
  const attrs = rest(props, ["icon", "label", "variant", "size"]);
  return h("button", {
    type: "button", ...attrs, class: () => cx("hm-icon-btn", props.variant && `hm-icon-btn-${props.variant}`, SIZES[val(props.size)], val(props.class)),
    "aria-label": () => val(props.label) ?? val(props["aria-label"]), title: () => val(props.label),
  }, icon(val(props.icon)) ?? props.children);
}

/** Group related buttons: `<ButtonGroup label="View">…</ButtonGroup>` */
export function ButtonGroup(props) {
  return h("div", { class: () => cx("hm-btn-group", props.attached && "hm-btn-group-attached", val(props.class)), role: "group", "aria-label": () => val(props.label) ?? null }, props.children);
}

const argsOf = (props) => (typeof props.args === "function" ? props.args() : props.args) ?? [];

/**
 * Render an action() as a button: hidden when the user may not run it, disabled while busy, confirm/reason/toasts handled
 * by the action. `<ActionButton action={remove} args={[row]} variant="danger" size="sm" />`
 */
export function ActionButton(props) {
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
const itemVisible = (it, args) => {
  if (it === "-" || it?.separator) return true;
  if (isAction(it)) return it.visible(...args);
  return !val(it.hidden) && can(it.can);
};
const menuItems = (panel) => panel?.querySelectorAll('[role="menuitem"]').filter((x) => !x.disabled) ?? [];

function renderItem(it, args, close) {
  if (it === "-" || it?.separator) return h("div", { role: "separator", class: "hm-menu-sep" });
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

// Shared trigger + floating panel.
function popButton(props, role, panelChildren, panelKeys) {
  const open = signal(false);
  const id = uid("hm-pop");
  let trigger, panel;
  const close = (refocus) => { open.set(false); if (refocus) trigger?.focus(); };
  const focusIn = (i) => queueMicrotask(() => { const els = role === "menu" ? menuItems(panel) : []; (i < 0 ? els[els.length - 1] : els[i])?.focus(); });
  const show = (i = 0) => { open.set(true); focusIn(i); };
  const btn = h("button", {
    type: "button", ref: (x) => { trigger = x; },
    class: () => cx(props.icon && props.trigger == null ? "hm-icon-btn" : `hm-btn hm-btn-${val(props.variant) ?? "secondary"}`, SIZES[val(props.size)], val(props.class)),
    "aria-haspopup": role === "menu" ? "menu" : "dialog", "aria-expanded": () => String(open()), "aria-controls": id,
    "aria-label": () => val(props.label) ?? null, disabled: () => !!val(props.disabled),
    onClick: () => (open.peek() ? close(false) : show(0)),
    onKeydown: (e) => {
      if (role !== "menu") return;
      if (e.key === "ArrowDown") { e.preventDefault(); show(0); } else if (e.key === "ArrowUp") { e.preventDefault(); show(-1); }
    },
  }, props.trigger ?? icon(props.icon) ?? (() => val(props.label)));
  return [btn, () => open() && untrack(() => floating({
    anchor: trigger, placement: props.placement ?? "bottom-start", role: role === "menu" ? "menu" : null, id,
    class: cx(role === "menu" ? "hm-menu" : "hm-dropdown", props.panelClass), onClose: close, ref: (x) => { panel = x; },
    attrs: { "aria-label": role === "menu" ? () => val(props.label) ?? null : null, onKeydown: (e) => panelKeys?.(e, panel, close) },
    children: panelChildren(close),
  }))];
}

/**
 * Dropdown menu. items: [{ label, onSelect, icon, href, danger, disabled, hidden, can, shortcut } | action | "-"].
 * `<Menu label="Row actions" icon="⋯" items={[edit, remove, "-", { label: "Open", href: "/x" }]} args={[row]} />`
 * Keyboard: ↓/↑ on the trigger opens, ↑ ↓ Home End move, Enter activates, Esc closes, Tab leaves.
 */
export function Menu(props) {
  return popButton(props, "menu", (close) => () => {
    const args = argsOf(props);
    const items = (val(props.items) ?? []).filter((it) => itemVisible(it, args));
    return untrack(() => items.map((it) => renderItem(it, args, close)));
  }, (e, panel, close) => {
    if (e.key === "Tab") close(false);
    else roving(e, menuItems(panel));
  });
}

/** Trigger with arbitrary floating content: `<Dropdown label="Filters">{(close) => …}</Dropdown>` */
export function Dropdown(props) {
  return popButton(props, "dialog", (close) => (typeof props.children === "function" && props.children.length ? props.children(close) : props.children));
}

/** `<Tooltip text="Copy link" placement="top"><button>…</button></Tooltip>` — on hover and keyboard focus. */
export function Tooltip(props) {
  const show = signal(false);
  const id = uid("hm-tip");
  let anchor;
  const open = debounce(() => show.set(true), 300);
  const hide = () => { open.cancel(); show.set(false); };
  const wrap = h("span", {
    class: "hm-tip-anchor", ref: (x) => { anchor = x; },
    onMouseenter: open, onMouseleave: hide, onFocusin: () => show.set(true), onFocusout: hide,
    onKeydown: (e) => { if (e.key === "Escape") hide(); },
  }, props.children);
  const target = () => anchor.firstElementChild ?? anchor;
  return [wrap, () => {
    const on = show();
    untrack(() => (on ? target().setAttribute("aria-describedby", id) : target().removeAttribute("aria-describedby")));
    return on && untrack(() => floating({ anchor, placement: props.placement ?? "top", role: "tooltip", id, class: "hm-tooltip", onClose: hide, children: () => val(props.text) }));
  }];
}

/** Copy text to the clipboard: `<CopyButton text={() => token} label="Copy" />` */
export function CopyButton(props) {
  const copied = signal(false);
  const copy = async () => {
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
  }, () => (props.iconOnly ? (copied() ? "✓" : "⧉") : copied() ? t`Copied` : val(props.label) ?? t`Copy`));
}
