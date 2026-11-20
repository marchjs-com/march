// Stepper (march/ui): progress through stages with morphing motion. It draws Steps and adds a liquid highlight
// that stretches from the old step to the new one and settles there, and step panels that morph into each other —
// the old one blurs and slides out, the new one slides in from the direction of travel (mirrored in RTL) while the
// frame's height follows. Everything runs on the motion engine; reduced motion switches instantly.
import "./stepper.css";
import { effect, untrack, onCleanup, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, uid, clamp, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { Steps, type StepItem } from "../steps/index.ts";
import { Button } from "../../../ui/button.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { animate } from "../../../motion/animate.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { nextFrame } from "../../../motion/engine/index.ts";
import { isRtl, type Handler } from "../../../core/util.ts";
import type { IconProp } from "../../../icons/types.ts";

export interface StepperProps {
  /** The steps: `{ title, description?, icon? }` (the Steps items). @tr Adımlar: `{ title, description?, icon? }` (Steps öğeleri). */
  steps: readonly StepItem[];
  /** Current step (0-based). @tr Geçerli adım (0'dan başlar). */
  current: MaybeFn<number>;
  /** Called with the step to go to (a step click, Back / Next). @tr Gidilecek adımla çağrılır (adıma tıklama, Back / Next). */
  onSelect?: Handler<[i: number]> | undefined;
  /** Content per step: a list, or a function of the index. @tr Adım başına içerik: bir liste ya da dizinin fonksiyonu. */
  panels?: readonly unknown[] | ((i: number) => unknown) | undefined;
  /** Show Back / Next buttons under the panel. Default: when there are panels and onSelect. @tr Panelin altında Back / Next düğmeleri gösterir. Varsayılan: panel ve onSelect varken. */
  nav?: boolean | undefined;
  /** Label of the last step's button. Default "Finish". @tr Son adımın düğme etiketi. Varsayılan "Finish". */
  finishLabel?: MaybeFn<string | undefined>;
  /** Called on the last step's button. @tr Son adımın düğmesinde çağrılır. */
  onFinish?: Handler<[]> | undefined;
  /** Steps in a column beside the panel (live: the same stepper turns). @tr Adımlar panelin yanında bir sütunda (canlı: aynı stepper döner). */
  vertical?: MaybeFn<boolean | undefined>;
  /** Morph between steps (default true): the highlight stretches and the panels blur into each other; false = at once. @tr Adımlar arasında biçim değişimi (varsayılan true): vurgu uzar, paneller birbirine bulanarak geçer; false = anında. */
  morph?: MaybeFn<boolean | undefined>;
  /** The liquid highlight around the current step (default true). @tr Geçerli adımın çevresindeki sıvı vurgu (varsayılan true). */
  highlight?: boolean | undefined;
  /** The "2 / 4" counter between Back and Next: true (default), false, or `(i, n) => content` (i is 0-based). @tr Back ile Next arasındaki "2 / 4" sayacı: true (varsayılan), false ya da `(i, n) => content` (i 0'dan başlar). */
  counter?: boolean | ((i: number, n: number) => unknown) | undefined;
  /** Texts: the Back and Next buttons and the panel's accessible name (`step(i, n)`, i is 0-based). @tr Metinler: Back ve Next düğmeleri ve panelin erişilebilir adı (`step(i, n)`, i 0'dan başlar). */
  labels?: { back?: MaybeFn<string | undefined>; next?: MaybeFn<string | undefined>; step?: ((i: number, n: number) => string) | undefined } | undefined;
  /** Passed to Steps: the mark of a done step (icon, string, or false to keep the number). @tr Steps'e geçer: tamamlanan adımın işareti (ikon, metin ya da numarayı korumak için false). */
  doneIcon?: IconProp;
  /** Passed to Steps: your own dot content. @tr Steps'e geçer: kendi nokta içeriğin. */
  renderDot?: ((i: number, state: "done" | "current" | "todo", step: StepItem) => unknown) | undefined;
  /** Passed to Steps: the line between the steps (default true). @tr Steps'e geçer: adımlar arasındaki çizgi (varsayılan true). */
  connector?: boolean | undefined;
  /** Extra class on the root. @tr Kök öğeye eklenen sınıf. */
  class?: ClassProp;
}

/** `<Stepper steps={[{ title: "Cart" }, …]} current={$i} onSelect={(i) => $i = i} panels={[<Cart/>, <Address/>, <Pay/>]} />` */
export function Stepper(props: StepperProps): Element {
  const cur = (): number => val(props.current);
  const vertical = (): boolean => !!val(props.vertical);
  const morph = (): boolean => val(props.morph) !== false;
  const n = props.steps.length;
  const panelId = uid("m-stepper-panel");
  let root!: HTMLElement, blob: HTMLElement | undefined, frame: HTMLElement | null = null;
  const rtl = (): boolean => isRtl(root);
  /** The dot of step i, in px relative to the root (physical: measured). */
  const dotBox = (i: number): { x: number; y: number; w: number; h: number } | null => {
    const dot = root?.querySelectorAll<HTMLElement>(".m-step2-dot")[i];
    if (!dot || typeof dot.getBoundingClientRect !== "function") return null;
    const r = dot.getBoundingClientRect(), o = root.getBoundingClientRect();
    const pad = 6;
    return { x: r.left - o.left - pad, y: r.top - o.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  };
  const place = (b: { x: number; y: number; w: number; h: number }): void => {
    if (blob) setStyle(blob, { translate: `${b.x}px ${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, opacity: "1" });
  };

  // the highlight: stretch over both dots, then settle on the new one (a liquid move)
  let last = -1;
  if (props.highlight !== false) effect(() => {
    const i = cur();
    vertical(); // a turned stepper: the highlight moves to the dot's new place
    untrack(() => nextFrame(() => {
      const to = dotBox(i);
      if (!to || !blob) return;
      const from = last >= 0 && last !== i ? dotBox(last) : null;
      last = i;
      if (!from || reducedMotion() || !morph()) { place(to); return; }
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
    const next = h("div", { class: "m-stepper-pane" }, panelOf(i)) as HTMLElement;
    if (!old || reducedMotion() || prev < 0 || !morph()) { frame.replaceChildren(next); return; }
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
  const go = (i: number): void => void props.onSelect?.(clamp(i, 0, n - 1));
  const counter = props.counter, stepName = props.labels?.step;
  const el = h("div", { ref: (x: HTMLElement) => { root = x; }, class: () => cx("m-stepper", vertical() && "m-stepper-v", val(props.class)) },
    props.highlight !== false && h("span", { class: "m-stepper-blob", "aria-hidden": "true", ref: (x: HTMLElement) => { blob = x; } }),
    h(Steps, { steps: props.steps, current: cur, ...(props.onSelect ? { onSelect: props.onSelect } : {}), vertical: reactive(vertical) as never,
      doneIcon: props.doneIcon, renderDot: props.renderDot, connector: props.connector }),
    props.panels && h("div", { class: "m-stepper-frame", id: panelId, role: "region", "aria-live": "polite", "aria-label": () => (stepName ? stepName(cur(), n) : t`Step ${cur() + 1} of ${n}`), ref: (x: HTMLElement) => { frame = x; } }),
    withNav && h("div", { class: "m-stepper-nav" },
      h(Button, { variant: "secondary", disabled: () => cur() === 0, onClick: () => go(cur() - 1), "aria-controls": panelId }, () => val(props.labels?.back) ?? t`Back`),
      counter !== false && h("span", { class: "m-stepper-count", "aria-hidden": "true" }, () => (typeof counter === "function" ? counter(cur(), n) : `${cur() + 1} / ${n}`)),
      h(Button, { variant: "primary", onClick: () => (cur() === n - 1 ? props.onFinish?.() : go(cur() + 1)), "aria-controls": panelId },
        () => (cur() === n - 1 ? val(props.finishLabel) ?? t`Finish` : val(props.labels?.next) ?? t`Next`))),
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
