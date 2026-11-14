// CheckMark (hadi-march/feedback): the yes / no / partly mark of comparison tables, plan features and check lists:
// ✓, ✕ or – with the text a screen reader reads ("Yes", "No", "Partly"). The text is hidden by default (`text` shows
// it beside the mark); `label={false}` makes the mark decoration when the line around it already says it. Each glyph
// can be replaced or switched off, the look is plain, a soft disc or a filled disc, the colour follows the value
// (success / danger / warn) unless `color` names a theme token. `motion` plays a transition when the value changes
// (the old glyph leaves while the new one arrives): flip, fade, pop, draw, or your own function.
import "./check-mark.css";
import { h } from "../../../dom/h.ts";
import { effect, untrack } from "../../../core/reactive.ts";
import { reducedMotion } from "../../../motion/engine/prefs.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { x as cross } from "../../../icons/glyphs/x.ts";
import { minus } from "../../../icons/glyphs/minus.ts";

/** What a CheckMark shows: yes (`true`), no (`false`) or partly. */
export type CheckMarkValue = boolean | "partial";
/** Texts of a CheckMark, one per value. */
export interface CheckMarkLabels { yes?: string; no?: string; partial?: string }
/** Own glyphs of a CheckMark, one per value: an icon of hadi-march/icons, text or a node; `false` draws none. */
export interface CheckMarkIcons { yes?: unknown; no?: unknown; partial?: unknown }

/** Ready transitions between two values: the glyphs turn into each other, cross-fade, pop, or the new one is drawn as a stroke. */
export type CheckMarkMotion = "flip" | "fade" | "pop" | "draw";
/** Your own transition: `next` is the arriving glyph, `prev` the leaving one (removed when the returned promise settles). */
export type CheckMarkMotionFn = (next: HTMLElement, prev: HTMLElement, change: { from: CheckMarkValue; to: CheckMarkValue }) => unknown;

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
  /** plain (default: the glyph alone) · soft (a tinted disc) · solid (a filled disc) · bare (the glyph alone in the colour and at the text size of what it sits in: a step dot, a button). */
  variant?: MaybeFn<"plain" | "soft" | "solid" | "bare" | undefined>;
  /** sm · md (default) · lg. */
  size?: MaybeFn<"sm" | "md" | "lg" | undefined>;
  /**
   * The transition when the value changes: "flip" (the glyphs turn into each other), "fade", "pop", "draw" (the new
   * stroke is drawn), your own `(next, prev, change) => …`, or "none" / `false` (default: the glyph changes at once).
   */
  motion?: CheckMarkMotion | "none" | false | CheckMarkMotionFn | undefined;
  class?: ClassProp;
  /** Other attributes (`data-*`, `title`, `id`) go to the root. */
  [attr: string]: unknown;
}

const GLYPH = { yes: check, no: cross, partial: minus } as const;
const VALUE = { yes: true, no: false, partial: "partial" } as const;
type Kind = keyof typeof GLYPH;
type Move = PropertyIndexedKeyframes;
// [the leaving glyph, the arriving glyph]; the arriving one of flip and pop lands with a spring
const MOVES: Record<Exclude<CheckMarkMotion, "draw">, [Move, Move]> = {
  flip: [{ opacity: [1, 0], transform: ["none", "scale(.3) rotate(90deg)"] }, { opacity: [0, 1], transform: ["scale(.3) rotate(-90deg)", "none"] }],
  fade: [{ opacity: [1, 0] }, { opacity: [0, 1] }],
  pop: [{ opacity: [1, 0], transform: ["none", "scale(.6)"] }, { opacity: [0, 1], transform: ["scale(.3)", "none"] }],
};

/** `<CheckMark value={row.included} />`, `<CheckMark value="partial" text />`, `<CheckMark value={false} variant="soft" label={false} />`, `<CheckMark value={$done} motion="flip" />` */
export function CheckMark(props: CheckMarkProps): Element {
  const kind = (): Kind => { const v = val(props.value); return v === "partial" ? "partial" : v === false ? "no" : "yes"; };
  const label = (): string | null => {
    const own = val(props.label);
    if (own === false) return null;
    const k = kind();
    return own ?? val(props.labels)?.[k] ?? (k === "yes" ? t`Yes` : k === "no" ? t`No` : t`Partly`);
  };
  const moves = (): boolean => props.motion != null && props.motion !== false && props.motion !== "none";
  // the glyph: drawn again when the value (or its own icon) changes; with `motion` the old one leaves while the new one arrives
  const holder = h("span", { class: "m-checkmark-icon", "aria-hidden": "true" }) as HTMLElement;
  let shown: Kind | null = null;
  effect(() => {
    const k = kind(), own = props.icons?.[k];
    untrack(() => {
      const from = shown, prev = from !== null && from !== k ? holder.lastElementChild as HTMLElement | null : null;
      shown = k;
      const glyph = ownIcon(own, GLYPH[k], "m-checkmark-own");
      const next = glyph == null ? null : h("span", { class: "m-checkmark-glyph" }, glyph) as HTMLElement;
      const m = props.motion;
      if (!prev || !next || from === null || !moves() || reducedMotion()) { holder.replaceChildren(...(next ? [next] : [])); return; }
      for (const c of [...holder.children]) if (c !== prev) c.remove(); // a glyph still leaving from the change before
      prev.classList.add("is-leaving");
      holder.appendChild(next);
      const done = (): void => prev.remove();
      if (typeof m === "function") { void Promise.resolve(m(next, prev, { from: VALUE[from], to: VALUE[k] })).then(done, done); return; }
      // the motion engine (and the stroke helper of "draw") loads when the first transition plays: a mark that never
      // changes costs nothing. Until it is there the new glyph waits unseen, so the two never show at once.
      next.classList.add("is-arriving");
      void Promise.all([import("../../../motion/animate.ts"), m === "draw" ? import("../../../motion/svg.ts") : null]).then(([{ animate }, svg]) => {
        next.classList.remove("is-arriving");
        if (!next.isConnected) return; // a newer change took over
        const soft = m === "fade" || m === "draw";
        const [leave, enter] = MOVES[soft ? "fade" : m as "flip"] ?? MOVES.fade;
        void animate(prev, leave, { duration: 200, easing: "in", fill: "forwards" }).finished.then(done, done);
        const strokes = svg ? next.querySelectorAll("svg path, svg line, svg polyline, svg circle") : null;
        // draw: a glyph without strokes (text, an image) fades in
        if (svg && strokes?.length) svg.drawPath(strokes, { duration: 420, easing: "out" });
        else animate(next, enter, { duration: soft ? 220 : 360, easing: soft ? "out" : "spring" });
      }, () => { next.classList.remove("is-arriving"); done(); });
    });
  });
  return h("span", {
    ...rest(props, ["value", "labels", "label", "text", "icons", "variant", "size", "color", "motion"]),
    class: () => cx("m-checkmark", `m-checkmark-${val(props.variant) ?? "plain"}`, `m-checkmark-${val(props.size) ?? "md"}`, `is-${kind()}`, moves() && "m-checkmark-moves", val(props.class)),
    "aria-hidden": () => (label() == null ? "true" : null),
  },
  holder,
  () => (label() == null ? null : h("span", { class: () => (val(props.text) ? "m-checkmark-text" : "m-sr-only") }, label)));
}
