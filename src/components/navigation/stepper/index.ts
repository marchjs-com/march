// Stepper (hadi-march/ui): progress through stages with morphing motion. It draws Steps and adds a liquid highlight
// that stretches from the old step to the new one and settles there, and step panels that morph into each other —
// the old one blurs and slides out, the new one slides in from the direction of travel (mirrored in RTL) while the
// frame's height follows. Everything runs on the motion engine; reduced motion switches instantly.
import "./stepper.css";
import { effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, uid, clamp, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Steps, type StepItem } from "../steps/index.ts";
import { Button } from "../../../ui/button.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/animate.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { nextFrame } from "../../../motion/engine/index.ts";
import { isRtl } from "../../../core/util.ts";

export interface StepperProps {
  steps: readonly StepItem[];
  /** Current step (0-based). */
  current: MaybeFn<number>;
  /** Called with the step to go to (a step click, Back / Next). */
  onSelect?: ((i: number) => void) | undefined;
  /** Content per step: a list, or a function of the index. */
  panels?: readonly unknown[] | ((i: number) => unknown) | undefined;
  /** Show Back / Next buttons under the panel. Default: when there are panels and onSelect. */
  nav?: boolean | undefined;
  /** Label of the last step's button. Default "Finish". */
  finishLabel?: MaybeFn<string | undefined>;
  onFinish?: (() => void) | undefined;
  vertical?: boolean | undefined;
  /** Theme color token. */
  color?: ColorToken | undefined;
  class?: ClassProp;
}

/** `<Stepper steps={[{ title: "Cart" }, …]} current={$i} onSelect={(i) => $i = i} panels={[<Cart/>, <Address/>, <Pay/>]} />` */
export function Stepper(props: StepperProps): Element {
  const cur = (): number => val(props.current);
  const n = props.steps.length;
  const panelId = uid("hm-stepper-panel");
  let root!: HTMLElement, blob!: HTMLElement, frame: HTMLElement | null = null;
  const rtl = (): boolean => isRtl(root);
  /** The dot of step i, in px relative to the root (physical: measured). */
  const dotBox = (i: number): { x: number; y: number; w: number; h: number } | null => {
    const dot = root?.querySelectorAll<HTMLElement>(".hm-step2-dot")[i];
    if (!dot || typeof dot.getBoundingClientRect !== "function") return null;
    const r = dot.getBoundingClientRect(), o = root.getBoundingClientRect();
    const pad = 6;
    return { x: r.left - o.left - pad, y: r.top - o.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  };
  const place = (b: { x: number; y: number; w: number; h: number }): void =>
    setStyle(blob, { translate: `${b.x}px ${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, opacity: "1" });

  // the highlight: stretch over both dots, then settle on the new one (a liquid move)
  let last = -1;
  effect(() => {
    const i = cur();
    untrack(() => nextFrame(() => {
      const to = dotBox(i);
      if (!to) return;
      const from = last >= 0 && last !== i ? dotBox(last) : null;
      last = i;
      if (!from || reducedMotion()) { place(to); return; }
      const x0 = Math.min(from.x, to.x), y0 = Math.min(from.y, to.y);
      const span = { x: x0, y: y0, w: Math.max(from.x + from.w, to.x + to.w) - x0, h: Math.max(from.y + from.h, to.y + to.h) - y0 };
      const k = (b: typeof to) => ({ translate: `${b.x}px ${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
      place(to);
      animate(blob, [{ ...k(from), offset: 0 }, { ...k(span), offset: 0.45 }, { ...k(to), offset: 1 }], { duration: 560, easing: "inOut" });
    }, "write"));
  });

  // panels: the old one leaves toward the past, the new one arrives from the future; the frame's height follows
  const panelOf = (i: number): unknown => (typeof props.panels === "function" ? props.panels(i) : props.panels?.[i]);
  const showPanel = (i: number, prev: number): void => {
    if (!frame) return;
    const old = frame.firstElementChild as HTMLElement | null;
    const next = h("div", { class: "hm-stepper-pane" }, panelOf(i)) as HTMLElement;
    if (!old || reducedMotion() || prev < 0) { frame.replaceChildren(next); return; }
    const h0 = frame.offsetHeight;
    setStyle(old, { position: "absolute", "inset-inline": "0", "inset-block-start": "0" });
    old.setAttribute("aria-hidden", "true");
    frame.appendChild(next);
    const h1 = next.offsetHeight;
    const dir = (i > prev ? 1 : -1) * (rtl() ? -1 : 1);
    animate(old, [{ opacity: 1, transform: "translateX(0) scale(1)", filter: "blur(0)" }, { opacity: 0, transform: `translateX(${-dir * 32}px) scale(.97)`, filter: "blur(6px)" }], { duration: 280, easing: "in" }).finished.then(() => old.remove());
    animate(next, [{ opacity: 0, transform: `translateX(${dir * 40}px) scale(.98)`, filter: "blur(6px)" }, { opacity: 1, transform: "translateX(0) scale(1)", filter: "blur(0)" }], { duration: 420, delay: 90, easing: "out" });
    if (h0 && h1 && h0 !== h1) animate(frame, [{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 420, easing: "inOut" });
  };
  onCleanup(() => { frame = null; });

  const withNav = props.nav ?? (!!props.panels && !!props.onSelect);
  const go = (i: number): void => props.onSelect?.(clamp(i, 0, n - 1));
  const el = h("div", { ref: (x: HTMLElement) => { root = x; }, class: () => cx("hm-stepper", props.vertical && "hm-stepper-v", val(props.class)), "data-hm-color": colorAttr(props.color) },
    h("span", { class: "hm-stepper-blob", "aria-hidden": "true", ref: (x: HTMLElement) => { blob = x; } }),
    h(Steps, { steps: props.steps, current: cur, ...(props.onSelect ? { onSelect: props.onSelect } : {}), ...(props.vertical ? { vertical: true } : {}) }),
    props.panels && h("div", { class: "hm-stepper-frame", id: panelId, role: "region", "aria-live": "polite", "aria-label": () => t`Step ${cur() + 1} of ${n}`, ref: (x: HTMLElement) => { frame = x; } }),
    withNav && h("div", { class: "hm-stepper-nav" },
      h(Button, { variant: "secondary", disabled: () => cur() === 0, onClick: () => go(cur() - 1), "aria-controls": panelId }, () => t`Back`),
      h("span", { class: "hm-stepper-count", "aria-hidden": "true" }, () => `${cur() + 1} / ${n}`),
      h(Button, { variant: "primary", onClick: () => (cur() === n - 1 ? props.onFinish?.() : go(cur() + 1)), "aria-controls": panelId },
        () => (cur() === n - 1 ? val(props.finishLabel) ?? t`Finish` : t`Next`))),
  ) as Element;
  let shown = -1;
  if (props.panels) {
    effect(() => {
      const i = cur();
      untrack(() => { const prev = shown; shown = i; showPanel(i, prev); });
    });
  }
  return el;
}
