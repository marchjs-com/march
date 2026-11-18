// Button and ActionButton (march/ui): the button, and an action() drawn as one. Folder: src/components/actions/button/.
import "./button.css";
import { untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import type { Href } from "../../../router/router.ts";
import { routerLink } from "../../../dom/link.ts";
import type { Action } from "../../../ui/action.ts";
import { labelWithKey } from "../../../ui/keys.ts";
import { val, cx, rest, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Spinner } from "../../feedback/spinner/index.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "link";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonWeight = "light" | "regular" | "medium" | "strong";
const SIZES: Record<string, string | undefined> = { sm: "m-btn-sm", lg: "m-btn-lg" };
/** Size class of a button, shared by IconButton and the Menu / Dropdown trigger: `sm` / `lg` → their class (none for `md`). */
export const buttonSizeClass = (s: ButtonSize | null | undefined): string | undefined => (s ? SIZES[s] : undefined);

/** The font weight of a button's label (`medium`, the default, sets none): set on its style, so it costs no CSS. */
const WEIGHTS: Record<string, string> = { light: "var(--m-weight-light)", regular: "var(--m-weight-regular)", strong: "var(--m-weight-bold)" };

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
  /** The look: primary, secondary (default), ghost, danger, dark (ink fill) or link (inline text that reads as a link). @tr Görünüm: primary, secondary (varsayılan), ghost, danger, dark (mürekkep dolgu) ya da link (bağlantı gibi okunan satır içi metin). */
  variant?: MaybeFn<ButtonVariant | undefined>;
  /** sm, md (default) or lg; the icons follow it. @tr sm, md (varsayılan) ya da lg; ikonlar da buna uyar. */
  size?: MaybeFn<ButtonSize | undefined>;
  /** While true: a spinner, `aria-busy`, and the button is disabled. @tr Doğruyken: dönen gösterge, `aria-busy`, ve düğme devre dışı. */
  loading?: MaybeFn<boolean | null | undefined>;
  /** The loading spinner: true (default), false (the icon stays while loading), or your own node / icon.
   * @tr Yükleniyor göstergesi: true (varsayılan), false (yüklenirken ikon kalır) ya da kendi düğümün / ikonun. */
  spinner?: unknown;
  /** The icon before the label (an icon name or a node). @tr Etiketten önceki ikon (ikon adı ya da düğüm). */
  icon?: IconProp;
  /** The icon after the label. @tr Etiketten sonraki ikon. */
  iconEnd?: IconProp;
  /** Full width of its container. @tr Kapsayıcısının tam genişliği. */
  block?: boolean;
  /** A toggle button: sets `aria-pressed` and the shared pressed look (`is-pressed`). Leave unset for a plain button.
   * @tr Aç / kapa düğmesi: `aria-pressed` ve ortak basılı görünüm (`is-pressed`). Düz düğme için boş bırak. */
  pressed?: MaybeFn<boolean | null | undefined>;
  /** `pill`: fully rounded ends. @tr `pill`: uçlar tam yuvarlak. */
  shape?: MaybeFn<"pill" | undefined>;
  /** The label's font weight in the theme's font: light, regular, medium (default) or strong.
   * @tr Etiketin yazı kalınlığı, temanın yazı tipinde: light, regular, medium (varsayılan) ya da strong. */
  weight?: MaybeFn<ButtonWeight | undefined>;
  /** Renders a link: the router's Link inside the app, a plain `<a>` for an external address.
   * @tr Bağlantı çizer: uygulama içinde yönlendiricinin Link'i, dış adres için düz `<a>`. */
  href?: MaybeFn<ButtonHref>;
  /** Not clickable, dimmed. @tr Tıklanamaz, soluk. */
  disabled?: MaybeFn<boolean | null | undefined>;
  /** The button's type in a form: button (default), submit or reset. @tr Formdaki düğme türü: button (varsayılan), submit ya da reset. */
  type?: "button" | "submit" | "reset";
  /** Extra classes on the button. @tr Düğmeye eklenen sınıflar. */
  class?: ClassProp;
  /** The label. @tr Etiket. */
  children?: unknown;
  [attr: string]: unknown;
}

/**
 * `<Button variant="primary" size="sm" loading={$saving} icon="+" href="/x" block>Save</Button>`
 * variant: primary | secondary (default) | ghost | danger | dark (ink fill: the text color, e.g. HADİ navy) | link (text that reads as a link, flows inline).
 * size: sm | md | lg (the icons follow it). weight: light | regular | medium | strong. `href` renders a router Link. `pressed` makes it a toggle (aria-pressed); `shape="pill"` rounds the ends.
 */
export function Button(props: ButtonProps): unknown {
  const loading = (): boolean => !!val(props.loading);
  const cls = (): string => cx("m-btn", `m-btn-${val(props.variant) ?? "secondary"}`, buttonSizeClass(val(props.size)), val(props.shape) === "pill" && "m-btn-pill", props.block && "m-btn-block", loading() && "is-loading", val(props.pressed) && "is-pressed", val(props.class));
  const body = [
    () => (!loading() || props.spinner === false ? icon(val(props.icon))
      // the Spinner itself (a part: the Hierarchy lists it, m:parts={{ Spinner: … }} reaches it), quiet: the button says busy
      : props.spinner == null || props.spinner === true ? h(Spinner, { size: "em", decorative: true, class: "m-btn-spin" })
      : h("span", { class: "m-btn-spin-own", "aria-hidden": "true" }, icon(props.spinner))),
    props.children != null && h("span", { class: "m-btn-label" }, props.children),
    props.iconEnd != null && icon(props.iconEnd),
  ];
  const attrs: Record<string, unknown> = { ...rest(props, ["variant", "size", "loading", "spinner", "icon", "iconEnd", "block", "pressed", "shape", "weight", "href", "disabled", "type"]) };
  if (props.weight != null) attrs["style"] = () => ({ ...(val(props["style"] as MaybeFn<Record<string, unknown> | undefined>) ?? {}), "font-weight": WEIGHTS[val(props.weight) ?? ""] ?? null });
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
  /** An action() object, or a plain `{ label, run }`. @tr Bir action() nesnesi ya da düz `{ label, run }`. */
  action: Action<A, R> | PlainAction<A>;
  /** The arguments passed to the action (a list, or an accessor for it). @tr Eyleme verilen argümanlar (liste ya da onu veren erişimci). */
  args?: Args<A>;
  /** Runs instead of `action.run` (same arguments), e.g. a table's bulk run that clears the selection afterwards.
   * @tr `action.run` yerine çalışır (aynı argümanlar); ör. tablonun seçimi sonra temizleyen toplu çalıştırması. */
  run?: ((...args: A) => unknown) | undefined;
  /** The look (see Button); danger when the action is marked danger, else secondary. @tr Görünüm (bkz. Button); eylem tehlikeli işaretliyse danger, değilse secondary. */
  variant?: MaybeFn<ButtonVariant | undefined>;
  /** sm, md (default) or lg. @tr sm, md (varsayılan) ya da lg. */
  size?: MaybeFn<ButtonSize | undefined>;
  /** The busy spinner: true (default), false, or your own node / icon (see Button). @tr Meşgul göstergesi: true (varsayılan), false ya da kendi düğümün / ikonun (bkz. Button). */
  spinner?: unknown;
  /** The icon; the action's own icon when unset. @tr İkon; verilmezse eylemin kendi ikonu. */
  icon?: IconProp;
  /** See Button. @tr Bkz. Button: `pill` uçları tam yuvarlar. */
  shape?: MaybeFn<"pill" | undefined>;
  /** Full width of its container. @tr Kapsayıcısının tam genişliği. */
  block?: boolean;
  /** Extra classes on the button. @tr Düğmeye eklenen sınıflar. */
  class?: ClassProp;
  /** Only the icon; the label becomes the aria-label. @tr Yalnız ikon; etiket aria-label olur. */
  iconOnly?: boolean;
  /** Called with the action's result after it ran. @tr Eylem çalıştıktan sonra sonucuyla çağrılır. */
  onDone?: (result: R | undefined) => void;
  /** Called when the action throws (the action has already shown its toast). @tr Eylem hata fırlatınca çağrılır (eylem bildirimini zaten göstermiştir). */
  onError?: (error: unknown) => void;
  /** The label, in place of the action's. @tr Eylemin etiketi yerine geçen etiket. */
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
      ...rest(props, ["action", "args", "variant", "size", "spinner", "icon", "iconOnly", "run", "onDone", "onError", "children", "onClick"]),
      variant: props.variant ?? (o.danger ? "danger" : "secondary"), size: props.size, icon: props.icon ?? o.icon, class: props.class, spinner: props.spinner,
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
