// Content effects: the shown characters change while the accessible copy keeps the real text (typewriter, scramble,
// decode, matrix, split-flap, counter, odometer, word cycle, morph). They run on the engine clock as one 0..1 value,
// so global speed and "pause all" apply; reduced motion shows the end state at once.
import { run, ticker, type TextOptions, type TextAnimation, type SplitText } from "./core.ts";
import { css, graphemes } from "./split.ts";

type El = HTMLElement;
const vis = (p: HTMLElement, on: boolean): void => { p.style.visibility = on ? "" : "hidden"; };
/** Deterministic noise in [0, 1) for part i at step k (changes a glyph every ~50 ms, not every frame). */
const noise = (i: number, k: number): number => (((Math.imul(k + 1, 2654435761) ^ Math.imul(i + 7, 40503)) >>> 0) % 1000) / 1000;
/** Keep each character's own width while it shows other glyphs (no layout jitter). Layout read once. */
function pin(s: SplitText): string[] {
  const finals = s.parts.map((p) => p.textContent ?? "");
  for (const p of s.parts) { const w = p.offsetWidth; if (w) css(p, { width: `${w}px`, "text-align": "center" }); }
  return finals;
}
const srOf = (s: SplitText): HTMLElement => s.el.firstChild as HTMLElement;

export interface TypeOptions extends TextOptions {
  /** Show a caret while typing (default true). */
  caret?: boolean;
}
function caretEl(s: SplitText): HTMLElement {
  const c = s.el.ownerDocument.createElement("span");
  c.className = "hm-tx-caret";
  css(c, { display: "inline-block", width: "0.08em", height: "1em", "margin-inline": "0.04em", "vertical-align": "-0.12em", background: "currentColor" });
  return c;
}

/** Types the text one character at a time, with a caret. `out: true` deletes it. */
export const typewriter = (el: El, o: TypeOptions = {}): TextAnimation => ticker(el, o, { msPerPart: 55, easing: "linear" }, (s) => {
  const c = o.caret === false ? null : caretEl(s);
  const n = s.parts.length;
  return (p) => {
    const k = Math.round(p * n);
    s.parts.forEach((part, i) => vis(part, i < k));
    if (c) { const at = s.parts[k - 1]; if (at) at.parentNode!.insertBefore(c, at.nextSibling); else s.visual.prepend(c); if (p >= 1) c.remove(); }
  };
});

export interface CycleOptions extends TextOptions {
  /** The words to cycle through (default: the element's text split at "|"). */
  words?: string[];
  /** Time each word stays (ms). */
  hold?: number;
}
const wordsOf = (s: SplitText, o: CycleOptions): string[] => (o.words?.length ? o.words : s.text.split("|").map((w) => w.trim()).filter(Boolean));

/** Types a word, deletes it, types the next one: forever. */
export const typeLoop = (el: El, o: CycleOptions = {}): TextAnimation => {
  const hold = o.hold ?? 1200, speed = 70;
  return run(el, { ...o, by: "word" }, { iterations: Infinity, keep: true }, (s, tl) => {
    const words = wordsOf(s, o).map(graphemes);
    srOf(s).textContent = words.map((w) => w.join("")).join(", ");
    const spans = words.map((w) => w.length * speed * 2 + hold + 300);
    const total = spans.reduce((a, b) => a + b, 0);
    const text = s.el.ownerDocument.createTextNode("");
    const c = caretEl(s);
    s.visual.replaceChildren(text, c);
    const st = { t: 0 };
    tl.add(st, { t: [0, total] }, { at: 0, duration: total, easing: "linear", iterations: o.iterations ?? Infinity });
    const draw = (): void => {
      let t = st.t, i = 0;
      while (i < spans.length - 1 && t >= spans[i]!) t -= spans[i++]!;
      const w = words[i]!, typeEnd = w.length * speed;
      const k = t < typeEnd ? Math.floor(t / speed) : t < typeEnd + hold ? w.length : Math.max(0, w.length - Math.floor((t - typeEnd - hold) / speed));
      text.data = w.slice(0, k).join("");
    };
    tl.onUpdate = draw;
    draw();
  });
};

export interface ScrambleOptions extends TextOptions {
  /** Glyphs shown while a character is unresolved. */
  chars?: string;
}
function scrambler(el: El, o: ScrambleOptions, chars: string, mode: "scramble" | "decode" | "matrix" | "flap", d: { duration?: number; from?: "start" | "random"; easing?: string }): TextAnimation {
  return ticker(el, o, { easing: "linear", ...d }, (s, r) => {
    const finals = pin(s), set = graphemes(o.chars ?? chars), n = s.parts.length, dur = r.duration;
    return (p) => {
      const k = Math.floor((p * dur) / 50);
      s.parts.forEach((part, i) => {
        const done = (r.rank[i]! + 1) / n * 0.85 + 0.15, start = mode === "scramble" || mode === "flap" ? 0 : done - 0.35;
        let g = finals[i]!;
        if (p < done) {
          if (mode === "flap") { const target = Math.max(0, set.indexOf(g)); g = set[Math.floor(((p - start) / (done - start)) * (target + set.length)) % set.length]!; }
          else g = p >= start ? set[Math.floor(noise(i, k) * set.length)]! : "";
        }
        if (part.textContent !== g) part.textContent = g;
        if (mode === "matrix") { const on = p < done && p >= start; part.style.color = on ? "#22c55e" : ""; part.style.textShadow = on ? "0 0 8px #22c55e" : ""; }
        if (mode === "decode" || mode === "matrix") vis(part, p >= start || p >= done);
      });
    };
  });
}
/** Characters spin through random glyphs and settle one by one. */
export const scramble = (el: El, o: ScrambleOptions = {}): TextAnimation => scrambler(el, o, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=?", "scramble", { duration: 1400 });
/** Characters appear as flickering binary in random order, then decode. */
export const decode = (el: El, o: ScrambleOptions = {}): TextAnimation => scrambler(el, o, "01", "decode", { duration: 1600, from: "random" });
/** Green glyphs rain into place and turn into the text. */
export const matrix = (el: El, o: ScrambleOptions = {}): TextAnimation => scrambler(el, o, "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789", "matrix", { duration: 1800, from: "random" });
/** A split-flap board: each character flips through the alphabet to its letter. */
export const splitFlap = (el: El, o: ScrambleOptions = {}): TextAnimation => scrambler(el, o, " ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789", "flap", { duration: 2000 });

export interface CounterOptions extends TextOptions {
  /** Start value (default 0). */
  start?: number;
  /** End value (default: the number in the text). */
  end?: number;
  /** Fraction digits (default: as in the text). */
  decimals?: number;
  /** Number format locale (default: the nearest lang attribute). */
  locale?: string;
}
const NUMBER = /-?\d[\d.,   ]*\d|\d/;
/** Parse the first number in a text: "₺12.500,75" → 12500.75, "1,250.5" → 1250.5. */
export function parseNumber(t: string): { value: number; decimals: number; before: string; after: string } | null {
  const m = NUMBER.exec(t);
  if (!m) return null;
  const raw = m[0].replace(/[   ]/g, "");
  const last = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  const frac = last >= 0 && raw.length - last - 1 !== 3 ? raw.slice(last + 1) : "";
  const int = (frac ? raw.slice(0, last) : raw).replace(/[.,]/g, "");
  return { value: Number(`${int}${frac ? `.${frac}` : ""}`), decimals: frac.length, before: t.slice(0, m.index), after: t.slice(m.index + m[0].length) };
}
/** Counts up to the number in the text, formatted for the locale. */
export const counter = (el: El, o: CounterOptions = {}): TextAnimation => ticker(el, { ...o, by: "word" }, { duration: 1600, easing: "expo" }, (s) => {
  const n = parseNumber(s.text) ?? { value: 0, decimals: 0, before: s.text, after: "" };
  const end = o.end ?? n.value, start = o.start ?? 0, dec = o.decimals ?? n.decimals;
  const fmt = new Intl.NumberFormat(o.locale ?? (s.el.closest?.("[lang]")?.getAttribute("lang") || undefined), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const node = s.el.ownerDocument.createTextNode("");
  s.visual.replaceChildren(node);
  return (p) => { node.data = n.before + fmt.format(start + (end - start) * p) + n.after; };
});

/** Each digit rolls like a mechanical counter wheel. */
export const odometer = (el: El, o: TextOptions = {}): TextAnimation => run(el, { ...o, by: "char" }, { duration: 1800, easing: "expo", stagger: 90, from: "end" }, (s, tl, r) => {
  const doc = s.el.ownerDocument;
  s.parts.forEach((p, i) => {
    const d = Number(p.textContent);
    if (!/^\d$/.test(p.textContent ?? "")) return;
    css(p, { height: "1.2em", "line-height": "1.2em", overflow: "hidden", "vertical-align": "bottom" });
    const col = doc.createElement("span");
    css(col, { display: "block" });
    for (let k = 0; k < 20; k++) { const g = doc.createElement("span"); css(g, { display: "block" }); g.textContent = String(k % 10); col.appendChild(g); }
    p.replaceChildren(col);
    tl.add(col, { transform: ["translateY(0em)", `translateY(${-(10 + d) * 1.2}em)`] }, { at: 0, delay: r.at(i), duration: r.duration, easing: r.easing, direction: r.direction, fill: "both" });
  });
});

/** Stack every word in one cell (stable width), return the word spans. */
function stack(s: SplitText, words: string[]): HTMLElement[] {
  srOf(s).textContent = words.join(", ");
  css(s.visual, { display: "inline-grid", "vertical-align": "bottom", overflow: "hidden" });
  const spans = words.map((w) => { const e = s.el.ownerDocument.createElement("span"); e.textContent = w; css(e, { "grid-area": "1 / 1", "white-space": "nowrap" }); return e; });
  s.visual.replaceChildren(...spans);
  return spans;
}
/** Cycle loop over the words: show(spans, index, local 0..1, fade window). */
function cycle(el: El, o: CycleOptions, show: (spans: HTMLElement[], i: number, t: number, w: number) => void): TextAnimation {
  return run(el, { ...o, by: "word" }, { iterations: Infinity, keep: true }, (s, tl) => {
    const spans = stack(s, wordsOf(s, o));
    const each = (o.hold ?? 1600) + 500, total = each * spans.length;
    const st = { t: 0 };
    tl.add(st, { t: [0, total] }, { at: 0, duration: total, easing: "linear", iterations: o.iterations ?? Infinity });
    const draw = (): void => { const i = Math.min(spans.length - 1, Math.floor(st.t / each)); show(spans, i, (st.t - i * each) / each, 500 / each); };
    tl.onUpdate = draw;
    draw();
  });
}
const ease = (x: number): number => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
/** Words roll in from below and out at the top, one after another. */
export const wordCycle = (el: El, o: CycleOptions = {}): TextAnimation => cycle(el, o, (spans, i, t, w) => spans.forEach((e, j) => {
  e.style.visibility = j === i ? "" : "hidden";
  if (j !== i) return;
  const h = w / 2, enter = t < h ? ease(t / h) : 1, leave = t > 1 - h ? ease((t - 1 + h) / h) : 0;
  e.style.transform = `translateY(${((1 - enter) - leave) * 100}%)`;
  e.style.opacity = String(enter - leave);
}));
/** Texts melt into each other with a blur. */
export const morph = (el: El, o: CycleOptions = {}): TextAnimation => cycle(el, o, (spans, i, t, w) => {
  const k = t > 1 - w ? (t - 1 + w) / w : 0, next = (i + 1) % spans.length;
  spans.forEach((e, j) => {
    const a = j === i ? 1 - k : j === next && next !== i ? k : 0;
    e.style.opacity = String(a);
    e.style.filter = a > 0 && a < 1 ? `blur(${((1 - a) * 8).toFixed(2)}px)` : "";
  });
});
