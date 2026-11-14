// Badge and count labels (hadi-march/ui). Folder: src/components/data/badge/.
import "./badge.css";
import { h } from "../../../dom/h.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { Tone } from "../../../ui/display-base.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";

/** Format a count for badges: 120 → "99+". */
export const countLabel = (n: number, max = 99): string => (n > max ? `${max}+` : String(n));

export interface BadgeProps {
  /** Theme color token (see ColorToken): "brand-blue", "success", "cat-3"… Default: the theme's primary. */
  color?: ColorToken | undefined;
  tone?: MaybeFn<Tone | undefined>;
  /** "soft" (default: a tinted fill) or "solid": the tone's full colour with the text on it (a count that must stand out). */
  variant?: "soft" | "solid" | undefined;
  /** "md" (default) or "xs": the mini badge on the corner of an icon button, a tab, a rail item. */
  size?: "xs" | "md" | undefined;
  /** Count badge: hidden at 0 unless `showZero`; above `max` shows "99+". */
  count?: MaybeFn<number | null | undefined>;
  max?: number;
  showZero?: boolean;
  /** Count badges: accessible label after the number ("3 unread"). */
  label?: MaybeFn<string>;
  /** Dot before the text: `true` draws the built-in dot (a StatusDot), a node is your own mark. */
  dot?: boolean | Node | undefined;
  /** Colour of the built-in dot (default: the text colour of the tone). */
  dotColor?: ColorToken | undefined;
  /** The built-in dot pulses: `true` / "ring" (a breathing ring) or "blink"; it draws the dot by itself. */
  pulse?: boolean | "ring" | "blink" | undefined;
  /** Count badges: your own text for the number (default `countLabel`: 120 → "99+"). */
  format?: ((n: number, max: number) => unknown) | undefined;
  /** A badge that can be pressed: it is drawn as a `<button>` (keyboard, focus ring, hover). */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** Clickable badge: a toggle (`aria-pressed` and the pressed look). */
  pressed?: MaybeFn<boolean | null | undefined>;
  /** Clickable badge: cannot be pressed. */
  disabled?: MaybeFn<boolean | null | undefined>;
  /** Accessible name when the text alone does not say it (a clickable badge with a short code). */
  ariaLabel?: MaybeFn<string | undefined>;
  class?: ClassProp;
  children?: unknown;
}
/**
 * `<Badge tone="success">Active</Badge>`, `<Badge count={n} />` (hidden at 0 unless showZero; 120 → "99+"),
 * `<Badge tone="primary" variant="solid" count={n} />` (a filled count), `<Badge pulse>Live</Badge>`, `<Badge size="xs" count={n} />`, `<Badge onClick={open}>v2</Badge>` (a button).
 */
export function Badge(props: BadgeProps): unknown {
  // a clickable badge is a button; the look is the same element with one more class
  const click = props.onClick;
  const pressed = (): boolean | null => { const p = val(props.pressed); return p == null ? null : !!p; };
  const tag = click ? "button" : "span";
  const own = click ? { type: "button", onClick: click, disabled: () => !!val(props.disabled), "aria-pressed": () => { const p = pressed(); return p == null ? null : String(p); } } : {};
  const extra = (): string => cx(props.size === "xs" && "hm-badge-xs", props.variant === "solid" && "hm-badge-solid", click && "hm-badge-btn", click && pressed() && "is-pressed", val(props.class));
  if (props.count !== undefined) {
    return () => {
      const n = Number(val(props.count)) || 0;
      if (!n && !props.showZero) return null;
      return h(tag, { ...own, "data-hm-color": () => colorAttr(props.color), class: () => cx("hm-badge", "hm-badge-count", `hm-badge-${val(props.tone) ?? "danger"}`, extra()), "aria-label": val(props.ariaLabel) ?? (props.label ? `${n} ${val(props.label)}` : null) }, props.format ? props.format(n, props.max ?? 99) : countLabel(n, props.max ?? 99));
    };
  }
  // the dot: the built-in one (a StatusDot in the text colour or `dotColor`, still or pulsing) or the caller's node
  const node = props.dot && props.dot !== true, pulse = !node && props.pulse ? props.pulse : false, builtIn = props.dot === true || !!pulse, mark = builtIn && !pulse && !!props.dotColor;
  return h(tag, { ...own, "data-hm-color": () => colorAttr(props.color), "aria-label": () => val(props.ariaLabel) ?? null, class: () => cx("hm-badge", `hm-badge-${val(props.tone) ?? "neutral"}`, builtIn && !mark && !pulse && "hm-badge-dot", extra()) },
    node ? h("span", { class: "hm-badge-dot-own", "aria-hidden": "true" }, props.dot)
      : builtIn ? h(StatusDot, { size: "xs", pulse, color: props.dotColor, class: pulse ? "hm-badge-dot-pulse" : mark ? "hm-badge-dot-mark" : null }) : null,
    props.children);
}
