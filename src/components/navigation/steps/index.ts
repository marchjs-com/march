// Steps (hadi-march/ui).
import "./steps.css";
import { h } from "../../../dom/h.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";

export interface StepItem { title: unknown; description?: unknown; icon?: unknown }
export interface StepsProps {
  /** Theme color token. */
  color?: ColorToken | undefined;
  steps: readonly StepItem[];
  current: MaybeFn<number>;
  onSelect?: (i: number) => void;
  vertical?: boolean;
  /** Mark of a done step: the check (default), your own icon (an IconDef or a short string), or false to keep the number / step icon. */
  doneIcon?: unknown;
  /** Your own dot content: `(i, state, step) => node` (replaces the number, the step icon and the check). */
  renderDot?: ((i: number, state: "done" | "current" | "todo", step: StepItem) => unknown) | undefined;
  /** The line between the steps (default true). */
  connector?: boolean | undefined;
  class?: ClassProp;
}
/** Progress through stages: `<Steps steps={[{ title: "Account" }, …]} current={$step} onSelect={(i) => $step = i} />` */
export function Steps(props: StepsProps): Element {
  const renderDot = props.renderDot;
  return h("ol", { "data-hm-color": () => colorAttr(props.color), class: () => cx("hm-steps2", props.vertical && "hm-steps2-v", props.connector === false && "hm-steps2-bare", val(props.class)) }, props.steps.map((s, i) => {
    const state = (): "done" | "current" | "todo" => { const c = val(props.current); return i < c ? "done" : i === c ? "current" : "todo"; };
    const dot = (): unknown => {
      const st = state();
      if (renderDot) return renderDot(i, st, s);
      const done = props.doneIcon;
      if (st === "done" && done !== false) return done == null || done === true ? glyph(check) : icon(done);
      return s.icon != null ? icon(s.icon) : String(i + 1);
    };
    const inner = [
      h("span", { class: "hm-step2-dot" }, dot),
      h("span", { class: "hm-step2-text" }, h("span", { class: "hm-step2-title" }, s.title), s.description != null && h("span", { class: "hm-step2-desc" }, s.description)),
    ];
    return h("li", { class: () => cx("hm-step2", `is-${state()}`), "aria-current": () => (state() === "current" ? "step" : null) },
      props.onSelect ? h("button", { type: "button", class: "hm-step2-hit", onClick: () => props.onSelect?.(i) }, inner) : h("span", { class: "hm-step2-hit" }, inner));
  }));
}
