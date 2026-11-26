// TextInput's mask part, loaded with the first masked TextInput (an unmasked one never downloads it): the march/mask
// controller on the input plus its looks: a mirror layer that draws the text over the transparent input text so
// literals can fade in and filled slots grow out of their placeholders, the ghost rest of the template, the shake of
// a refused character, the check mark of a complete value, the format hint and the announcements.
import { effect, untrack, onCleanup, signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { maskInput, type MaskController, type MaskState } from "../../../mask/input.ts";
import type { MaskSpec } from "../../../mask/core.ts";
import { play } from "../../../motion/play.ts";
import { still } from "../../../motion/engine/parts.ts";
import { observeSize } from "../../../ui/observe.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { announce } from "../../../managers/announcer/index.ts";
import { check as checkIcon } from "../../../icons/glyphs/check.ts";

/** One of the mask's built-in animations: `false` turns it off, a function plays your own on the element. */
export type MaskMotionPart = boolean | ((el: HTMLElement) => void) | undefined;
/** The mask's built-in animations, each replaceable or off: `false` turns all off. */
export interface MaskMotion {
  /** A literal ("(", " ", "/") fades in as it appears. @tr Ayraç ("(", " ", "/") belirirken yumuşakça gelir. */
  literal?: MaskMotionPart;
  /** A filled slot grows out of its placeholder. @tr Doldurulan yuva yer tutucusundan büyüyerek gelir. */
  fill?: MaskMotionPart;
  /** A refused character shakes the field. @tr Reddedilen karakter alanı sallar. */
  reject?: MaskMotionPart;
  /** The check mark of a complete value pops in. @tr Tamamlanan değerin onay işareti belirir. */
  complete?: MaskMotionPart;
}

/** What TextInput hands to the mask part. */
export interface MaskUiProps {
  mask?: MaskSpec | undefined;
  maskValue?: "raw" | "masked" | "parsed" | undefined;
  maskPlaceholder?: "lazy" | "eager" | "ghost" | "none" | undefined;
  maskMotion?: boolean | MaskMotion | undefined;
  maskDone?: unknown;
  maskLabels?: { complete?: string | undefined } | undefined;
  onMaskState?: ((state: MaskState) => void) | undefined;
  onComplete?: ((state: MaskState) => void) | undefined;
}

const FADE_IN: Keyframe[] = [{ opacity: 0, transform: "translateY(-0.3em)" }, { opacity: 1, transform: "translateY(0)" }];
const GROW: Keyframe[] = [{ opacity: 0.35, transform: "scale(0.6)" }, { opacity: 1, transform: "scale(1)" }];
const POP: Keyframe[] = [{ opacity: 0, transform: "scale(0.4) rotate(-20deg)" }, { opacity: 1, transform: "scale(1) rotate(0deg)" }];
const SHAKE: Keyframe[] = [
  { transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" },
  { transform: "translateX(-3px)" }, { transform: "translateX(2px)" }, { transform: "translateX(0)" },
];
// the font properties the mirror copies from the input, so its glyphs sit exactly on the input's own
const FONT = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing", "wordSpacing", "fontVariantNumeric", "fontFeatureSettings", "fontStretch", "textTransform", "paddingLeft", "paddingRight", "textAlign"] as const;

/**
 * Run the mask on a TextInput's input. `box` is the positioned wrapper the mirror goes in; `get` / `set` are the
 * value model; `error` receives the mask's error for the error part.
 */
export function attachMask(el: HTMLInputElement, box: HTMLElement, props: MaskUiProps, get: () => unknown, set: (v: unknown) => void, error: (e: string | null) => void): MaskController {
  const mo = (): MaskMotion | false => { const m = props.maskMotion; return m === false ? false : m === true || m == null ? {} : m; };
  const part = (k: keyof MaskMotion): MaskMotionPart => { const m = mo(); return m === false ? false : m[k] ?? true; };
  const run = (k: keyof MaskMotion, target: HTMLElement, frames: Keyframe[], o: { duration: number; easing: string }): void => {
    const p = part(k);
    if (p === false || still(props.maskMotion === false ? false : undefined)) return;
    if (typeof p === "function") p(target);
    else play(target, frames, { ...o, fill: "none" });
  };
  const ph = (): "lazy" | "eager" | "ghost" | "none" => props.maskPlaceholder ?? "lazy";
  // the mirror draws when something needs it: the ghost rest or an animation of the text
  const decor = (): boolean => ph() === "ghost" || (mo() !== false && (part("literal") !== false || part("fill") !== false));
  const line = h("span", { class: "m-mask-line" }) as HTMLElement;
  const mirror = h("span", { class: "m-mask-mirror", "aria-hidden": "true" }, line) as HTMLElement;
  const done = signal(false);
  const doneMark = h("span", { class: () => (done() ? "m-mask-done is-on" : "m-mask-done"), "aria-hidden": "true" },
    () => ownIcon(props.maskDone, checkIcon, "m-mask-done-icon")) as HTMLElement;
  box.append(mirror);
  if (props.maskDone !== false) mirror.append(doneMark);
  effect(() => { box.classList.toggle("m-mask-on", decor()); box.classList.toggle("m-mask-has-done", props.maskDone !== false); });

  // place the mirror over the input's content box and give it the input's font
  const place = (): void => {
    const cs = getComputedStyle(el), st = mirror.style;
    for (const k of FONT) (st as unknown as Record<string, string>)[k] = (cs as unknown as Record<string, string>)[k] ?? "";
    st.left = `${el.offsetLeft + el.clientLeft}px`; st.top = `${el.offsetTop + el.clientTop}px`;
    st.width = `${el.clientWidth}px`; st.height = `${el.clientHeight}px`;
    st.direction = cs.direction;
    scroll();
  };
  const scroll = (): void => { line.style.transform = el.scrollLeft ? `translateX(${-el.scrollLeft}px)` : ""; };
  onCleanup(observeSize(el, place));
  el.addEventListener("scroll", scroll);
  el.addEventListener("keyup", scroll);
  el.addEventListener("click", scroll);
  onCleanup(() => { el.removeEventListener("scroll", scroll); el.removeEventListener("keyup", scroll); el.removeEventListener("click", scroll); });

  // the mirror's characters, reused by index so a running animation is not cut by the next keystroke
  const spans: HTMLElement[] = [];
  const draw = (st: MaskState, prev: MaskState | null): void => {
    const raw = new Set(st.pos);
    const rest = ph() === "eager" || ph() === "ghost" ? (ph() === "eager" && !st.raw && el.ownerDocument?.activeElement !== el ? "" : st.rest) : "";
    const chars = [...st.text], restChars = [...rest];
    const total = chars.length + restChars.length;
    while (spans.length > total) spans.pop()!.remove();
    for (let i = 0; i < total; i++) {
      let s = spans[i];
      if (!s) { s = h("span", { class: "m-mask-c" }) as HTMLElement; line.append(s); spans.push(s); }
      const isRest = i >= chars.length, ch = isRest ? restChars[i - chars.length]! : chars[i]!;
      const was = s.textContent, wasRest = s.classList.contains("is-ph");
      if (was !== ch) s.textContent = ch;
      s.className = isRest ? "m-mask-c is-ph" : raw.has(i) ? "m-mask-c" : "m-mask-c is-lit";
      if (!prev || isRest || (was === ch && !wasRest)) continue;
      // new on screen: a literal fades in, a typed character grows out of its slot
      if (raw.has(i)) { if (i >= [...prev.text].length || was !== ch) run("fill", s, GROW, { duration: 200, easing: "back" }); }
      else if (i >= [...prev.text].length) run("literal", s, FADE_IN, { duration: 240, easing: "out" });
    }
    scroll();
  };

  let first = true;
  const ctl = maskInput(el, untrack(() => props.mask) ?? "", {
    placeholder: ph() === "ghost" ? "lazy" : ph(), value: props.maskValue,
    onChange: (v) => set(v),
    onUpdate: (prev, next) => draw(next, prev),
    onReject: () => run("reject", box, SHAKE, { duration: 280, easing: "out" }),
    onComplete: (st) => {
      props.onComplete?.(st);
      if (!st.error) announce(props.maskLabels?.complete ?? t`Complete`);
    },
  });
  // the bound value in, a new mask, the state out
  effect(() => { const v = get(); untrack(() => ctl.set(v)); });
  effect(() => { const m = props.mask; if (m != null) untrack(() => ctl.setMask(m)); });
  effect(() => {
    const st = ctl.state();
    untrack(() => {
      if (first) { first = false; draw(st, null); }
      error(st.error);
      props.onMaskState?.(st);
      const on = st.complete && !st.error;
      if (on && !done.peek() && props.maskDone !== false) { done.set(true); run("complete", doneMark, POP, { duration: 320, easing: "back" }); }
      else if (!on) done.set(false);
    });
  });
  // eager: the template comes and goes with the focus
  const redraw = (): void => draw(untrack(ctl.state), null);
  el.addEventListener("focus", redraw);
  el.addEventListener("blur", redraw);
  onCleanup(() => { el.removeEventListener("focus", redraw); el.removeEventListener("blur", redraw); });
  return ctl;
}
