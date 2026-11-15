// Steps (hadi-march/ui).
import "./steps.css";
import { h } from "../../../dom/h.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { CheckMark } from "../../feedback/check-mark/index.ts";
import { type ColorToken } from "../../../theme/colors.ts";

export interface StepItem { title: unknown; description?: unknown; icon?: unknown }
export interface StepsProps {
  /** The steps: `{ title, description?, icon? }`. @tr Adımlar: `{ title, description?, icon? }`. */
  steps: readonly StepItem[];
  /** Current step (0-based). @tr Geçerli adım (0'dan başlar). */
  current: MaybeFn<number>;
  /** Called with a step's index; when given, each step is a button. @tr Bir adımın dizinini alarak çağrılır; verilince her adım bir düğme olur. */
  onSelect?: (i: number) => void;
  /** Steps as a vertical list (default false). @tr Adımlar dikey bir liste (varsayılan false). */
  vertical?: boolean;
  /** Mark of a done step: the check (default), your own icon (an IconDef or a short string), or false to keep the number / step icon. @tr Tamamlanan adımın işareti: onay (varsayılan), kendi ikonun (IconDef ya da kısa metin) ya da numarayı / adım ikonunu korumak için false. */
  doneIcon?: unknown;
  /** Your own dot content: `(i, state, step) => node` (replaces the number, the step icon and the check). @tr Kendi nokta içeriğin: `(i, state, step) => node` (numaranın, adım ikonunun ve onay işaretinin yerine geçer). */
  renderDot?: ((i: number, state: "done" | "current" | "todo", step: StepItem) => unknown) | undefined;
  /** The line between the steps (default true). @tr Adımlar arasındaki çizgi (varsayılan true). */
  connector?: boolean | undefined;
  /** Extra class on the list. @tr Listeye eklenen sınıf. */
  class?: ClassProp;
}
/** Progress through stages: `<Steps steps={[{ title: "Account" }, …]} current={$step} onSelect={(i) => $step = i} />` */
export function Steps(props: StepsProps): Element {
  const renderDot = props.renderDot;
  return h("ol", { class: () => cx("m-steps2", props.vertical && "m-steps2-v", props.connector === false && "m-steps2-bare", val(props.class)) }, props.steps.map((s, i) => {
    const state = (): "done" | "current" | "todo" => { const c = val(props.current); return i < c ? "done" : i === c ? "current" : "todo"; };
    const dot = (): unknown => {
      const st = state();
      if (renderDot) return renderDot(i, st, s);
      const done = props.doneIcon;
      if (st === "done" && done !== false) return h(CheckMark, { variant: "bare", label: false, icons: { yes: done ?? undefined } }); // the step's own text says it
      return s.icon != null ? icon(s.icon) : String(i + 1);
    };
    const inner = [
      h("span", { class: "m-step2-dot" }, dot),
      h("span", { class: "m-step2-text" }, h("span", { class: "m-step2-title" }, s.title), s.description != null && h("span", { class: "m-step2-desc" }, s.description)),
    ];
    return h("li", { class: () => cx("m-step2", `is-${state()}`), "aria-current": () => (state() === "current" ? "step" : null) },
      props.onSelect ? h("button", { type: "button", class: "m-step2-hit", onClick: () => props.onSelect?.(i) }, inner) : h("span", { class: "m-step2-hit" }, inner));
  }));
}
