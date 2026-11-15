// Avatar (march/social): a person's picture, or their initials on a colour taken from the name when there is no
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
  /** The person's name: gives the initials, the colour and the accessible name. @tr Kişinin adı: baş harfleri, rengi ve erişilebilir adı buradan gelir. */
  name?: MaybeFn<string | null | undefined>;
  /** Image address; the initials show while it loads or if it fails. @tr Resim adresi; yüklenirken ya da yüklenemezse baş harfler görünür. */
  src?: MaybeFn<string | null | undefined>;
  /** Size: xs, sm, md (default), lg or xl. @tr Boyut: xs, sm, md (varsayılan), lg ya da xl. */
  size?: MaybeFn<AvatarSize | undefined>;
  /** Ready text instead of the initials ("+3", "?"). @tr Baş harfler yerine hazır metin ("+3", "?"). */
  text?: MaybeFn<string | null | undefined>;
  /** An icon (or node) instead of the initials when there is no image. @tr Resim yokken baş harfler yerine bir ikon (ya da düğüm). */
  icon?: unknown;
  /** A fixed theme colour instead of the colour taken from the name. @tr Addan alınan renk yerine sabit bir tema rengi. */
  color?: MaybeFn<ColorToken | undefined>;
  /** "circle" (default) or "square" (rounded). @tr "circle" (varsayılan) ya da "square" (yuvarlatılmış köşeli). */
  shape?: MaybeFn<"circle" | "square" | undefined>;
  /** Accessible name (default: the name, or "Avatar"). @tr Erişilebilir ad (varsayılan: ad ya da "Avatar"). */
  label?: MaybeFn<string | undefined>;
  /** Hidden from screen readers (the name is written next to it). @tr Ekran okuyuculardan gizlenir (ad zaten yanında yazılıdır). */
  decorative?: boolean | undefined;
  /** How the image loads (default "lazy"). @tr Resmin nasıl yükleneceği (varsayılan "lazy"). */
  loading?: "lazy" | "eager" | undefined;
  /** Extra class on the root (`.m-avatar`). @tr Köke (`.m-avatar`) eklenen sınıf. */
  class?: ClassProp;
  /** Own content instead of the image / initials. @tr Resim / baş harfler yerine kendi içeriğiniz. */
  children?: unknown;
}
/** `<Avatar name="Ada Lovelace" src={url} size="sm|md|lg" />` — initials when there is no image or it fails. */
export function Avatar(props: AvatarProps): Element {
  const failed = signal(false);
  const fixed = (): string | null => colorAttr(val(props.color));
  return h("span", {
    class: () => cx("m-avatar", `m-avatar-${val(props.size) ?? "md"}`, !fixed() && `m-avatar-c${hue(val(props.name))}`, val(props.shape) === "square" && "m-avatar-square", val(props.class)),
    "data-m-color": fixed,
    role: props.decorative ? null : "img", "aria-hidden": props.decorative ? "true" : null,
    "aria-label": () => (props.decorative ? null : val(props.label) ?? val(props.name) ?? val(props.text) ?? t`Avatar`),
  },
  props.children ?? (() => {
    const src = val(props.src);
    if (src && !failed()) return untrack(() => h("img", { src, alt: "", loading: props.loading ?? "lazy", onError: () => failed.set(true) }));
    const text = val(props.text);
    if (text == null && props.icon != null) return untrack(() => icon(props.icon, "m-avatar-icon"));
    return h("span", { class: "m-avatar-text", "aria-hidden": "true" }, text ?? initials(val(props.name)));
  }));
}
