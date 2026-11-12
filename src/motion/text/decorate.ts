// Decorations: marks drawn on or across the text (highlight marker, underline, strike, gradient sweep, SVG stroke).
// Marks are background gradients on the line parts (no extra elements), drawn along the reading direction.
// highlight / underline / strike keep their mark at the end; stop() removes it.
import { run, colorOf, type TextOptions, type TextAnimation, type Resolved, type SplitText } from "./core.ts";
import type { Playback } from "../engine/playback.ts";
import { css, isRtl } from "./split.ts";

type El = HTMLElement;
export interface MarkOptions extends TextOptions {
  /** Mark color (any CSS color). */
  color?: string;
}

function mark(el: El, o: MarkOptions, y: string, h: string, color: string): TextAnimation {
  const x = isRtl(el) ? "100%" : "0%";
  return run(el, o, { by: "line", duration: 700, easing: "in-out", keep: true }, (s: SplitText, tl: Playback, r: Resolved) => {
    s.parts.forEach((p, i) => {
      css(p, { "background-image": `linear-gradient(${o.color ?? color}, ${o.color ?? color})`, "background-repeat": "no-repeat", "background-position": `${x} ${y}` });
      tl.add(p, { backgroundSize: [`0% ${h}`, `100% ${h}`] }, { at: 0, delay: r.at(i), duration: r.duration, easing: r.easing, direction: r.direction, fill: "both" });
    });
  });
}

/** A marker pen highlights each line. */
export const highlight = (el: El, o: MarkOptions = {}): TextAnimation => mark(el, o, "85%", "45%", "color-mix(in oklab, var(--hm-warning, #facc15) 55%, transparent)");
/** An underline draws itself under each line. */
export const underline = (el: El, o: MarkOptions = {}): TextAnimation => mark(el, o, "100%", "0.08em", "currentColor");
/** A line strikes through the text. */
export const strike = (el: El, o: MarkOptions = {}): TextAnimation => mark(el, o, "58%", "0.08em", "currentColor");

/** A band of color sweeps once across the text (gradient text), leaving it as it was. */
export const gradientSweep = (el: El, o: MarkOptions = {}): TextAnimation => {
  const c = colorOf(el), a = o.color ?? "var(--hm-primary, #6366f1)", rtl = isRtl(el);
  return run(el, o, { by: "line", duration: 1400, easing: "in-out" }, (s, tl, r) => {
    s.parts.forEach((p, i) => {
      css(p, { "background-image": `linear-gradient(90deg, ${c} 0%, ${c} 33%, ${a} 45%, color-mix(in oklab, ${a}, #ec4899) 55%, ${c} 67%, ${c} 100%)`, "background-size": "300% 100%", "-webkit-background-clip": "text", "background-clip": "text", color: "transparent" });
      tl.add(p, { backgroundPosition: rtl ? ["0% 0%", "100% 0%"] : ["100% 0%", "0% 0%"] }, { at: 0, delay: r.at(i), duration: r.duration, easing: r.easing, direction: r.direction, fill: "both" });
    });
  });
};

const NS = "http://www.w3.org/2000/svg";
/** The letter outlines are drawn with a pen (SVG stroke), then filled. */
export const strokeDraw = (el: El, o: MarkOptions = {}): TextAnimation => run(el, o, { by: "line", duration: 2200, easing: "in-out" }, (s, tl, r) => {
  const doc = el.ownerDocument, rtl = isRtl(el);
  const box = s.visual.getBoundingClientRect?.();
  const w = Math.max(1, Math.ceil(box?.width || s.text.length * 12)), h = Math.max(1, Math.ceil(box?.height || 24));
  const svg = doc.createElementNS(NS, "svg");
  for (const [k, v] of [["width", w], ["height", h], ["viewBox", `0 0 ${w} ${h}`]] as const) svg.setAttribute(k, String(v));
  css(svg, { overflow: "visible", "vertical-align": "bottom" });
  const t = doc.createElementNS(NS, "text");
  for (const [k, v] of [["x", rtl ? w : 0], ["y", Math.round(h * 0.8)], ["direction", rtl ? "rtl" : "ltr"], ["fill", o.color ?? "currentColor"], ["stroke", o.color ?? "currentColor"], ["stroke-width", 1]] as const) t.setAttribute(k, String(v));
  t.textContent = s.text;
  const len = Math.ceil(w * 6);
  css(t, { "stroke-dasharray": `${len}px ${len}px` });
  svg.appendChild(t);
  s.visual.replaceChildren(svg);
  tl.add(t, [{ strokeDashoffset: `${len}px`, fillOpacity: 0 }, { strokeDashoffset: "0px", fillOpacity: 0, offset: 0.7 }, { strokeDashoffset: "0px", fillOpacity: 1 }],
    { at: 0, delay: o.delay ?? 0, duration: r.duration, easing: r.easing, direction: r.direction, fill: "both" });
});
