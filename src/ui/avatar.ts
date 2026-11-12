// Avatar and initials. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./display.css";
import { signal, untrack } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, locale } from "../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "./util.ts";

/** Initials for a name ("Ada Lovelace" → "AL"), locale aware upper casing. */
export function initials(name: unknown): string {
  const w = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = w[0], last = w[w.length - 1];
  const s = w.length > 1 && first && last ? (first[0] ?? "") + (last[0] ?? "") : (first ?? "?").slice(0, 2);
  return s.toLocaleUpperCase(locale.peek());
}
const hue = (s: unknown): number => { let x = 0; for (const c of String(s ?? "")) x = (x * 31 + (c.codePointAt(0) ?? 0)) >>> 0; return x % 8; };

export interface AvatarProps { name?: MaybeFn<string | null | undefined>; src?: MaybeFn<string | null | undefined>; size?: MaybeFn<"sm" | "md" | "lg" | undefined>; class?: ClassProp }
/** `<Avatar name="Ada Lovelace" src={url} size="sm|md|lg" />` — initials when there is no image or it fails. */
export function Avatar(props: AvatarProps): Element {
  const failed = signal(false);
  return h("span", { class: () => cx("hm-avatar", `hm-avatar-${val(props.size) ?? "md"}`, `hm-avatar-c${hue(val(props.name))}`, val(props.class)), role: "img", "aria-label": () => val(props.name) ?? t`Avatar` },
    () => {
      const src = val(props.src);
      if (src && !failed()) return untrack(() => h("img", { src, alt: "", loading: "lazy", onError: () => failed.set(true) }));
      return h("span", { class: "hm-avatar-text", "aria-hidden": "true" }, initials(val(props.name)));
    });
}
