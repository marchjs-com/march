// Buttons, menus, tooltips and the copy button.
import "./button.css";
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import type { Href } from "../router/index.ts";
import { routerLink } from "../dom/link.ts";
import { can, type PermCheck } from "../access/index.ts";
import { isAction, type Action } from "./action.ts";
import { toast } from "../components/overlays/toast/index.ts";
import { floating, type Placement } from "./popover.ts";
import { roving } from "./focus.ts";
import { formatKey } from "./keys.ts";
import { val, cx, rest, uid, icon, glyph, later, debounce, type MaybeFn, type ClassProp } from "./util.ts";
import { check } from "../icons/glyphs/check.ts";
import { copy as copyIcon } from "../icons/glyphs/copy.ts";
import { colorAttr, type ColorToken } from "../theme/colors.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
export type ButtonSize = "sm" | "md" | "lg";
const SIZES: Record<string, string | undefined> = { sm: "hm-btn-sm", lg: "hm-btn-lg" };
const sizeClass = (s: ButtonSize | null | undefined): string | undefined => (s ? SIZES[s] : undefined);

/** Props of <Button>. Other props (onClick, title, aria-*, data-*) go to the <button> / <a>. */
export interface ButtonProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
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
 * variant: primary | secondary (default) | ghost | danger | dark (ink fill: the text color, e.g. HADİ navy). size: sm | md | lg. `href` renders a router Link.
 */
export function Button(props: ButtonProps): unknown {
  const loading = (): boolean => !!val(props.loading);
  const cls = (): string => cx("hm-btn", `hm-btn-${val(props.variant) ?? "secondary"}`, sizeClass(val(props.size)), props.block && "hm-btn-block", loading() && "is-loading", val(props.class));
  const body = [
    () => (loading() ? h("span", { class: "hm-loading hm-btn-spin", "aria-hidden": "true" }) : icon(val(props.icon))),
    props.children != null && h("span", { class: "hm-btn-label" }, props.children),
    props.iconEnd != null && icon(props.iconEnd),
  ];
  const attrs = { ...rest(props, ["variant", "size", "loading", "icon", "iconEnd", "block", "href", "disabled", "type", "color"]), "data-hm-color": colorAttr(props.color) };
  if (props.href != null) {
    const href = (): Href => val(props.href as MaybeFn<Href>);
    const L = routerLink(); // the router's Link when the app has a router; otherwise a plain link
    return L ? h(L, { ...attrs, href, class: cls, children: body }) : h("a", { ...attrs, href, class: cls }, body);
  }
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
