// StatusDot (hadi-march/feedback): one small dot in a tone or a theme colour, still or pulsing. With a `label` it is
// an image screen readers read ("Online"); without one it is decoration (aria-hidden) next to text that says the same.
// Used wherever a state is shown as a dot: live marks, status bars, "changed" marks, timeline and kanban points.
import "./status-dot.css";
import { h } from "../../../dom/h.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

/** Meaning of a StatusDot. */
export type StatusDotTone = "neutral" | "primary" | "info" | "success" | "warn" | "danger";
/** How a StatusDot moves: a ring that breathes around it ("ring", also `true`), the dot itself fading ("blink"), or still. */
export type StatusDotPulse = boolean | "ring" | "blink";

export interface StatusDotProps {
  /** Meaning: neutral, primary, info, success (default), warn, danger. */
  tone?: MaybeFn<StatusDotTone | undefined>;
  /** A theme colour token instead of the tone ("brand-orange", "cat-3"…). */
  color?: MaybeFn<ColorToken | undefined>;
  /** Motion: `true` / "ring" (a breathing ring), "blink" (the dot fades), `false` (default, still). */
  pulse?: MaybeFn<StatusDotPulse | undefined>;
  /** xs · sm · md (default) · lg. */
  size?: MaybeFn<"xs" | "sm" | "md" | "lg" | undefined>;
  /** Accessible name ("Online"). Without it the dot is decorative. */
  label?: MaybeFn<string | null | undefined>;
  /** A ring instead of a filled dot (the point of a timeline entry): the ground shows through; children (an icon) sit inside. */
  hollow?: MaybeFn<boolean | undefined>;
  class?: ClassProp;
  /** With `hollow`: a small mark inside the ring. */
  children?: unknown;
  /** Other attributes (`data-*`, `title`, `id`) go to the dot. */
  [attr: string]: unknown;
}

/** `<StatusDot tone="success" pulse label="Live" />`, `<StatusDot color="brand-orange" size="xs" />` (decorative). */
export function StatusDot(props: StatusDotProps): Element {
  const label = (): string | null => val(props.label) || null;
  const pulse = (): string | false => { const p = val(props.pulse); return p === true ? "ring" : p || false; };
  return h("span", {
    ...rest(props, ["tone", "color", "pulse", "size", "label", "hollow"]),
    class: () => cx("m-status-dot", `m-status-dot-${val(props.size) ?? "md"}`, `is-${val(props.tone) ?? "success"}`, pulse() && `is-pulse-${pulse()}`, val(props.hollow) && "m-status-dot-hollow", val(props.class)),
    "data-m-color": () => colorAttr(val(props.color)),
    role: () => (label() ? "img" : null), "aria-label": label, "aria-hidden": () => (label() ? null : "true"),
  }, props.children);
}
