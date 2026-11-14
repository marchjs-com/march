// Button and ActionButton (hadi-march/ui): the button, and an action() drawn as one. Folder: src/components/actions/button/.
import "./button.css";
import { untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import type { Href } from "../../../router/router.ts";
import { routerLink } from "../../../dom/link.ts";
import type { Action } from "../../../ui/action.ts";
import { labelWithKey } from "../../../ui/keys.ts";
import { val, cx, rest, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "link";
export type ButtonSize = "sm" | "md" | "lg";
const SIZES: Record<string, string | undefined> = { sm: "hm-btn-sm", lg: "hm-btn-lg" };
/** Size class of a button, shared by IconButton and the Menu / Dropdown trigger: `sm` / `lg` → their class (none for `md`). */
export const buttonSizeClass = (s: ButtonSize | null | undefined): string | undefined => (s ? SIZES[s] : undefined);

/** `aria-pressed` value of a `pressed` prop (shared with IconButton): null when the prop is not set, so a plain button carries no state. */
export const pressedAttr = (p: MaybeFn<boolean | null | undefined>): "true" | "false" | null => { const v = val(p); return v == null ? null : v ? "true" : "false"; };

/** Where a button link may go: a route of the app, or an external address with a scheme (`https://…`, `mailto:…`). */
export type ButtonHref = Href | `${string}:${string}`;
const EXTERNAL = /^(\w+:|\/\/)/;
/**
 * Draw a button as a link (shared with IconButton): the router's Link when the app has a router and the address is inside the app,
 * a plain `<a>` otherwise (no router, or an external address such as `https://…` / `mailto:`).
 */
export function buttonLink(attrs: Record<string, unknown>, to: MaybeFn<ButtonHref>, body: unknown): unknown {
  const href = (): ButtonHref => val(to);
  const L = EXTERNAL.test(untrack(href)) ? null : routerLink();
  return L ? h(L, { ...attrs, href, children: body }) : h("a", { ...attrs, href }, body);
}

/** Props of <Button>. Other props (onClick, title, aria-*, data-*) go to the <button> / <a>. */
export interface ButtonProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  variant?: MaybeFn<ButtonVariant | undefined>;
  size?: MaybeFn<ButtonSize | undefined>;
  loading?: MaybeFn<boolean | null | undefined>;
  /** The loading spinner: true (default), false (the icon stays while loading), or your own node / icon. */
  spinner?: unknown;
  icon?: unknown;
  iconEnd?: unknown;
  block?: boolean;
  /** A toggle button: sets `aria-pressed` and the shared pressed look (`is-pressed`). Leave unset for a plain button. */
  pressed?: MaybeFn<boolean | null | undefined>;
  /** `pill`: fully rounded ends. */
  shape?: MaybeFn<"pill" | undefined>;
  /** Renders a link: the router's Link inside the app, a plain `<a>` for an external address. */
  href?: MaybeFn<ButtonHref>;
  disabled?: MaybeFn<boolean | null | undefined>;
  type?: "button" | "submit" | "reset";
  class?: ClassProp;
  children?: unknown;
  [attr: string]: unknown;
}

/**
 * `<Button variant="primary" size="sm" loading={$saving} icon="+" href="/x" block>Save</Button>`
 * variant: primary | secondary (default) | ghost | danger | dark (ink fill: the text color, e.g. HADİ navy) | link (text that reads as a link, flows inline).
 * size: sm | md | lg. `href` renders a router Link. `pressed` makes it a toggle (aria-pressed); `shape="pill"` rounds the ends.
 */
export function Button(props: ButtonProps): unknown {
  const loading = (): boolean => !!val(props.loading);
  const cls = (): string => cx("hm-btn", `hm-btn-${val(props.variant) ?? "secondary"}`, buttonSizeClass(val(props.size)), val(props.shape) === "pill" && "hm-btn-pill", props.block && "hm-btn-block", loading() && "is-loading", val(props.pressed) && "is-pressed", val(props.class));
  const body = [
    () => (!loading() || props.spinner === false ? icon(val(props.icon))
      : props.spinner == null || props.spinner === true ? h("span", { class: "hm-loading hm-btn-spin", "aria-hidden": "true" }) // not <Spinner>: its texts and colour lists would more than double a Button-only page
      : h("span", { class: "hm-btn-spin-own", "aria-hidden": "true" }, icon(props.spinner))),
    props.children != null && h("span", { class: "hm-btn-label" }, props.children),
    props.iconEnd != null && icon(props.iconEnd),
  ];
  const attrs = { ...rest(props, ["variant", "size", "loading", "spinner", "icon", "iconEnd", "block", "pressed", "shape", "href", "disabled", "type", "color"]), "data-hm-color": () => colorAttr(props.color) };
  if (props.href != null) return buttonLink({ ...attrs, class: cls }, props.href as MaybeFn<ButtonHref>, body);
  return h("button", {
    "aria-pressed": () => pressedAttr(props.pressed), // the caller's own aria-pressed (in attrs) wins
    ...attrs, type: props.type ?? "button", class: cls,
    disabled: () => !!val(props.disabled) || loading(), "aria-busy": () => (loading() ? "true" : null),
  }, body);
}

/** The arguments an action gets: a list, or an accessor for it (shared with Menu). */
export type Args<A extends readonly unknown[]> = A | (() => A) | null | undefined;
/** Read the `args` prop of a component that runs actions (ActionButton, Menu). */
export const argsOf = <A extends readonly unknown[]>(props: { args?: Args<A> }): A => ((typeof props.args === "function" ? props.args() : props.args) ?? []) as A;

/** A plain action for ActionButton: `{ label, run }` with optional `visible` / `disabled` / `busy` and `opts` (a table's row and bulk actions have this shape). */
export interface PlainAction<A extends unknown[] = unknown[]> {
  label: string | (() => string);
  run(...args: A): unknown;
  visible?(...args: A): boolean;
  disabled?(...args: A): boolean;
  busy?(): boolean;
  opts?: { readonly danger?: boolean | undefined; readonly icon?: unknown; readonly key?: string | undefined } | undefined;
}

/** Props of <ActionButton>. `args` (or an accessor for them) are passed to the action. */
export interface ActionButtonProps<A extends unknown[] = unknown[], R = unknown> {
  /** An action() object, or a plain `{ label, run }`. */
  action: Action<A, R> | PlainAction<A>;
  args?: Args<A>;
  /** Runs instead of `action.run` (same arguments), e.g. a table's bulk run that clears the selection afterwards. */
  run?: ((...args: A) => unknown) | undefined;
  variant?: MaybeFn<ButtonVariant | undefined>;
  size?: MaybeFn<ButtonSize | undefined>;
  /** Theme color token of the button (see Button). */
  color?: ColorToken | undefined;
  /** The busy spinner: true (default), false, or your own node / icon (see Button). */
  spinner?: unknown;
  icon?: unknown;
  /** See Button. */
  shape?: MaybeFn<"pill" | undefined>;
  block?: boolean;
  class?: ClassProp;
  /** Only the icon; the label becomes the aria-label. */
  iconOnly?: boolean;
  onDone?: (result: R | undefined) => void;
  onError?: (error: unknown) => void;
  children?: unknown;
  /** Other attributes (`role`, `title`, `data-*`, `aria-*`) go to the button. */
  [attr: string]: unknown;
}

/**
 * Render an action() as a button: hidden when the user may not run it, disabled while busy, confirm/reason/toasts handled
 * by the action. `<ActionButton action={remove} args={[row]} variant="danger" size="sm" />`
 */
export function ActionButton<A extends unknown[], R>(props: ActionButtonProps<A, R>): () => unknown {
  return () => {
    const a = props.action as PlainAction<A> | null | undefined;
    if (typeof a?.run !== "function") return null;
    const args = argsOf(props);
    if (a.visible && !a.visible(...args)) return null;
    const o = a.opts ?? {};
    const label = (): string => (typeof a.label === "function" ? a.label() : a.label);
    return untrack(() => h(Button, {
      ...rest(props, ["action", "args", "variant", "size", "color", "spinner", "icon", "iconOnly", "run", "onDone", "onError", "children", "onClick"]),
      variant: props.variant ?? (o.danger ? "danger" : "secondary"), size: props.size, icon: props.icon ?? o.icon, class: props.class, color: props.color, spinner: props.spinner,
      loading: () => !!a.busy?.(), disabled: () => !!a.disabled?.(...argsOf(props)),
      title: props["title"] ?? (o.key ? labelWithKey(label(), o.key) : null),
      onClick: async (e: Event) => {
        (props["onClick"] as ((e: Event) => void) | undefined)?.(e); // e.g. close the menu the button sits in
        try { const r = await (props.run ?? a.run.bind(a))(...argsOf(props)); props.onDone?.(r as R | undefined); } catch (e) { props.onError?.(e); } // errors were toasted by the action
      },
      children: props.children ?? (props.iconOnly ? null : label),
      "aria-label": props["aria-label"] ?? (props.iconOnly ? label : null),
    }));
  };
}
