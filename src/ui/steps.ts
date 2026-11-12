// Steps (hadi-march/ui).
import "./steps.css";
import { h } from "../dom/h.ts";
import { val, cx, icon, glyph, type MaybeFn, type ClassProp } from "./util.ts";
import { check } from "../icons/glyphs/check.ts";
import { colorAttr, type ColorToken } from "../theme/colors.ts";

export interface StepItem { title: unknown; description?: unknown; icon?: unknown }
export interface StepsProps { /** Theme color token. */ color?: ColorToken | undefined; steps: readonly StepItem[]; current: MaybeFn<number>; onSelect?: (i: number) => void; vertical?: boolean; class?: ClassProp }
/** Progress through stages: `<Steps steps={[{ title: "Account" }, …]} current={$step} onSelect={(i) => $step = i} />` */
export function Steps(props: StepsProps): Element {
  return h("ol", { "data-hm-color": () => colorAttr(props.color), class: () => cx("hm-steps2", props.vertical && "hm-steps2-v", val(props.class)) }, props.steps.map((s, i) => {
    const state = (): string => { const c = val(props.current); return i < c ? "done" : i === c ? "current" : "todo"; };
    const inner = [
      h("span", { class: "hm-step2-dot" }, () => (state() === "done" ? glyph(check) : s.icon != null ? icon(s.icon) : String(i + 1))),
      h("span", { class: "hm-step2-text" }, h("span", { class: "hm-step2-title" }, s.title), s.description != null && h("span", { class: "hm-step2-desc" }, s.description)),
    ];
    return h("li", { class: () => cx("hm-step2", `is-${state()}`), "aria-current": () => (state() === "current" ? "step" : null) },
      props.onSelect ? h("button", { type: "button", class: "hm-step2-hit", onClick: () => props.onSelect?.(i) }, inner) : h("span", { class: "hm-step2-hit" }, inner));
  }));
}
