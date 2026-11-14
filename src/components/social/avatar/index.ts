// Avatar (hadi-march/social): a person's picture, or their initials on a colour taken from the name when there is no
// image or it fails to load. Every part is yours: a ready text or an icon instead of the initials, a fixed theme
// colour, the shape, the accessible name (or none: `decorative` beside a visible name), or your own content.
import "./avatar.css";
import { signal, untrack } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, locale } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { hashString } from "../../../ui/format.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

/** Initials for a name ("Ada Lovelace" → "AL"), locale aware upper casing. */
export function initials(name: unknown): string {
  const w = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = w[0], last = w[w.length - 1];
  const s = w.length > 1 && first && last ? (first[0] ?? "") + (last[0] ?? "") : (first ?? "?").slice(0, 2);
  return s.toLocaleUpperCase(locale.peek());
}
const hue = (s: unknown): number => hashString(s) % 8;

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export interface AvatarProps {
  name?: MaybeFn<string | null | undefined>;
  src?: MaybeFn<string | null | undefined>;
  size?: MaybeFn<AvatarSize | undefined>;
  /** Ready text instead of the initials ("+3", "?"). */
  text?: MaybeFn<string | null | undefined>;
  /** An icon (or node) instead of the initials when there is no image. */
  icon?: unknown;
  /** A fixed theme colour instead of the colour taken from the name. */
  color?: MaybeFn<ColorToken | undefined>;
  /** "circle" (default) or "square" (rounded). */
  shape?: MaybeFn<"circle" | "square" | undefined>;
  /** Accessible name (default: the name, or "Avatar"). */
  label?: MaybeFn<string | undefined>;
  /** Hidden from screen readers (the name is written next to it). */
  decorative?: boolean | undefined;
  /** How the image loads (default "lazy"). */
  loading?: "lazy" | "eager" | undefined;
  class?: ClassProp;
  /** Own content instead of the image / initials. */
  children?: unknown;
}
/** `<Avatar name="Ada Lovelace" src={url} size="sm|md|lg" />` — initials when there is no image or it fails. */
export function Avatar(props: AvatarProps): Element {
  const failed = signal(false);
  const fixed = (): string | null => colorAttr(val(props.color));
  return h("span", {
    class: () => cx("hm-avatar", `hm-avatar-${val(props.size) ?? "md"}`, !fixed() && `hm-avatar-c${hue(val(props.name))}`, val(props.shape) === "square" && "hm-avatar-square", val(props.class)),
    "data-hm-color": fixed,
    role: props.decorative ? null : "img", "aria-hidden": props.decorative ? "true" : null,
    "aria-label": () => (props.decorative ? null : val(props.label) ?? val(props.name) ?? val(props.text) ?? t`Avatar`),
  },
  props.children ?? (() => {
    const src = val(props.src);
    if (src && !failed()) return untrack(() => h("img", { src, alt: "", loading: props.loading ?? "lazy", onError: () => failed.set(true) }));
    const text = val(props.text);
    if (text == null && props.icon != null) return untrack(() => icon(props.icon, "hm-avatar-icon"));
    return h("span", { class: "hm-avatar-text", "aria-hidden": "true" }, text ?? initials(val(props.name)));
  }));
}
