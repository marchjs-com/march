// StatusDot (march/feedback): one small dot in a tone or a theme colour, still or pulsing. With a `label` it is
// an image screen readers read ("Online"); without one it is decoration (aria-hidden) next to text that says the same.
// Used wherever a state is shown as a dot: live marks, status bars, "changed" marks, timeline and kanban points.
import "./status-dot.css";
import { h } from "../../../dom/h.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";

/** Meaning of a StatusDot. */
export type StatusDotTone = "neutral" | "primary" | "info" | "success" | "warn" | "danger";
/** How a StatusDot moves: a ring that breathes around it ("ring", also `true`), the dot itself fading ("blink"), or still. */
export type StatusDotPulse = boolean | "ring" | "blink";

export interface StatusDotProps {
  /** Meaning: neutral, primary, info, success (default), warn, danger. @tr Anlam: neutral, primary, info, success (varsayılan), warn, danger. */
  tone?: MaybeFn<StatusDotTone | undefined>;
  /** Motion: `true` / "ring" (a breathing ring), "blink" (the dot fades), `false` (default, still). @tr Hareket: `true` / "ring" (soluyan halka), "blink" (nokta solar), `false` (varsayılan, durgun). */
  pulse?: MaybeFn<StatusDotPulse | undefined>;
  /** xs · sm · md (default) · lg. @tr xs · sm · md (varsayılan) · lg. */
  size?: MaybeFn<"xs" | "sm" | "md" | "lg" | undefined>;
  /** Accessible name ("Online"). Without it the dot is decorative. @tr Erişilebilir ad ("Online"). Verilmezse nokta süs amaçlıdır. */
  label?: MaybeFn<string | null | undefined>;
  /** A ring instead of a filled dot (the point of a timeline entry): the ground shows through; children (an icon) sit inside. @tr Dolu nokta yerine halka (bir zaman çizelgesi girdisinin noktası): zemin görünür; children (bir ikon) içine oturur. */
  hollow?: MaybeFn<boolean | undefined>;
  /** Extra classes on the dot. @tr Noktaya eklenen sınıflar. */
  class?: ClassProp;
  /** With `hollow`: a small mark inside the ring. @tr `hollow` ile: halkanın içinde küçük bir işaret. */
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
    role: () => (label() ? "img" : null), "aria-label": label, "aria-hidden": () => (label() ? null : "true"),
  }, props.children);
}
