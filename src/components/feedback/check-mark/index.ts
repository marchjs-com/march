// CheckMark (hadi-march/feedback): the yes / no / partly mark of comparison tables, plan features and check lists:
// ✓, ✕ or – with the text a screen reader reads ("Yes", "No", "Partly"). The text is hidden by default (`text` shows
// it beside the mark); `label={false}` makes the mark decoration when the line around it already says it. Each glyph
// can be replaced or switched off, the look is plain, a soft disc or a filled disc, the colour follows the value
// (success / danger / warn) unless `color` names a theme token.
import "./check-mark.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { x as cross } from "../../../icons/glyphs/x.ts";
import { minus } from "../../../icons/glyphs/minus.ts";

/** What a CheckMark shows: yes (`true`), no (`false`) or partly. */
export type CheckMarkValue = boolean | "partial";
/** Texts of a CheckMark, one per value. */
export interface CheckMarkLabels { yes?: string; no?: string; partial?: string }
/** Own glyphs of a CheckMark, one per value: an icon of hadi-march/icons, text or a node; `false` draws none. */
export interface CheckMarkIcons { yes?: unknown; no?: unknown; partial?: unknown }

export interface CheckMarkProps {
  /** `true` (✓), `false` (✕) or "partial" (–). Default `true`. */
  value?: MaybeFn<CheckMarkValue | undefined>;
  /** Texts per value (defaults: Yes / No / Partly). */
  labels?: MaybeFn<CheckMarkLabels | undefined>;
  /** The text for the current value (wins over `labels`); `false`: no text, the mark is decorative. */
  label?: MaybeFn<string | false | undefined>;
  /** Show the text beside the mark instead of hiding it visually (default false). */
  text?: MaybeFn<boolean | undefined>;
  /** Own glyphs per value. */
  icons?: CheckMarkIcons | undefined;
  /** plain (default: the glyph alone) · soft (a tinted disc) · solid (a filled disc). */
  variant?: MaybeFn<"plain" | "soft" | "solid" | undefined>;
  /** sm · md (default) · lg. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /** Theme colour token instead of the colour of the value (yes: success, no: danger, partly: warn). */
  color?: MaybeFn<ColorToken | undefined>;
  class?: ClassProp;
  /** Other attributes (`data-*`, `title`, `id`) go to the root. */
  [attr: string]: unknown;
}

const GLYPH = { yes: check, no: cross, partial: minus } as const;

/** `<CheckMark value={row.included} />`, `<CheckMark value="partial" text />`, `<CheckMark value={false} variant="soft" label={false} />` */
export function CheckMark(props: CheckMarkProps): Element {
  const kind = (): "yes" | "no" | "partial" => { const v = val(props.value); return v === "partial" ? "partial" : v === false ? "no" : "yes"; };
  const label = (): string | null => {
    const own = val(props.label);
    if (own === false) return null;
    const k = kind();
    return own ?? val(props.labels)?.[k] ?? (k === "yes" ? t`Yes` : k === "no" ? t`No` : t`Partly`);
  };
  return h("span", {
    ...rest(props, ["value", "labels", "label", "text", "icons", "variant", "size", "color"]),
    class: () => cx("hm-checkmark", `hm-checkmark-${val(props.variant) ?? "plain"}`, `hm-checkmark-${val(props.size) ?? "md"}`, `is-${kind()}`, val(props.class)),
    "data-hm-color": () => colorAttr(val(props.color)), "aria-hidden": () => (label() == null ? "true" : null),
  },
  h("span", { class: "hm-checkmark-icon", "aria-hidden": "true" }, () => { const k = kind(); return ownIcon(props.icons?.[k], GLYPH[k], "hm-checkmark-own"); }),
  () => (label() == null ? null : h("span", { class: () => (val(props.text) ? "hm-checkmark-text" : "hm-sr-only") }, label)));
}
