// splitText(): the one shared piece every text animation stands on. It breaks an element's text into parts (characters,
// words or lines) that can be moved one by one, and keeps the text accessible while it is split:
//   - the element gets a visually hidden copy of its text (read by screen readers, found by search) and the moving
//     parts sit in an aria-hidden wrapper, so a reader never hears "M e r h a b a";
//   - characters are grapheme clusters (Intl.Segmenter): "İ", "ğ", flags, skin-tone and family emoji stay whole;
//   - scripts whose letters join (Arabic, Syriac, N'Ko, Mongolian, Indic) fall back to words, so shaping never breaks;
//   - parts follow the text direction (RTL text moves right to left, logical order is the DOM order);
//   - nested markup (<b>, <a>) is kept inside the split for chars and words; revert() puts the original nodes back.
// Styles are set through CSSOM only (CSP safe, no style attribute strings, no CSS file needed).

export type SplitBy = "char" | "word" | "line";

export interface SplitText {
  readonly el: HTMLElement;
  /** The unit actually used ("char" becomes "word" for joining scripts). */
  readonly by: SplitBy;
  /** The moving parts, in reading order. Each has `--i` set to its index. */
  readonly parts: HTMLElement[];
  /** The aria-hidden wrapper holding the parts. */
  readonly visual: HTMLElement;
  /** The element's text (what the hidden copy says). */
  readonly text: string;
  /** Put the original nodes back. */
  revert(): void;
}

const K = Symbol.for("hm.textSplit");
const JOINING = /[؀-ࣿऀ-෿᠀-᢯ﭐ-﷿ﹰ-﻿]/;
let seg: { segment(s: string): Iterable<{ segment: string }> } | null | undefined;
/** Grapheme clusters of a string (Intl.Segmenter; code points where it is missing). */
export function graphemes(s: string): string[] {
  if (seg === undefined) {
    const S = (Intl as { Segmenter?: new (l?: string, o?: { granularity: string }) => typeof seg }).Segmenter;
    seg = S ? new S(undefined, { granularity: "grapheme" }) : null;
  }
  return seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s);
}

/** Set CSS properties through CSSOM. */
export function css(el: Element, props: Record<string, string>): void {
  const s = (el as HTMLElement).style;
  for (const k in props) s.setProperty(k, props[k]!);
}

const span = (doc: Document, cls: string): HTMLElement => {
  const s = doc.createElement("span");
  s.className = cls;
  return s;
};
const HIDDEN = { position: "absolute", width: "1px", height: "1px", margin: "-1px", padding: "0", overflow: "hidden", "clip-path": "inset(50%)", "white-space": "nowrap", border: "0" };

/** True when the element's text runs right to left. */
export function isRtl(el: Element): boolean {
  try {
    const d = globalThis.getComputedStyle?.(el)?.direction;
    if (d) return d === "rtl";
  } catch { /* detached */ }
  return el.closest?.("[dir]")?.getAttribute("dir") === "rtl";
}

/** Split `el` into characters, words or lines (see the module comment). Splitting again reverts the earlier split. */
export function splitText(el: HTMLElement, by: SplitBy = "char"): SplitText {
  (el as { [K]?: SplitText })[K]?.revert();
  const doc = el.ownerDocument;
  const originals = Array.from(el.childNodes);
  const text = el.textContent ?? "";
  const unit: SplitBy = by === "char" && JOINING.test(text) ? "word" : by;
  const parts: HTMLElement[] = [];
  const sr = span(doc, "hm-tx-sr");
  css(sr, HIDDEN);
  sr.textContent = text;
  const visual = span(doc, "hm-tx");
  visual.setAttribute("aria-hidden", "true");

  const words = (s: string, into: Node): void => {
    for (const piece of s.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) { into.appendChild(doc.createTextNode(piece)); continue; }
      const w = span(doc, "hm-tx-word");
      css(w, { display: "inline-block", "white-space": "nowrap" });
      if (unit === "char") {
        for (const g of graphemes(piece)) { const c = span(doc, "hm-tx-char"); css(c, { display: "inline-block" }); c.textContent = g; w.appendChild(c); parts.push(c); }
      } else { w.textContent = piece; parts.push(w); }
      into.appendChild(w);
    }
  };
  const copy = (from: Node, into: Node): void => {
    for (const n of Array.from(from.childNodes)) {
      if (n.nodeType === 3) words((n as Text).data, into);
      else if (n.nodeType === 1) { const c = n.cloneNode(false); copy(n, c); into.appendChild(c); }
    }
  };
  if (unit === "line") words(text, visual); else copy(el, visual);
  el.replaceChildren(sr, visual);

  if (unit === "line") {
    // group the words by their top edge (layout read once, before any write); without layout it is one line
    const nodes = Array.from(visual.childNodes), tops = parts.map((w) => w.offsetTop ?? 0);
    parts.length = 0;
    visual.replaceChildren();
    let line: HTMLElement | null = null, top = NaN, gap = "", wi = 0;
    for (const n of nodes) {
      if (n.nodeType === 3) { gap += (n as Text).data; continue; }
      const t = tops[wi++];
      if (!line || t !== top) {
        if (line) visual.appendChild(doc.createTextNode(" "));
        line = span(doc, "hm-tx-line");
        css(line, { display: "inline-block", "white-space": "nowrap" });
        visual.appendChild(line);
        parts.push(line);
        top = t!;
      } else if (gap) line.appendChild(doc.createTextNode(gap));
      gap = "";
      line.appendChild(n);
    }
  }
  parts.forEach((p, i) => p.style.setProperty("--i", String(i)));

  const s: SplitText = {
    el, by: unit, parts, visual, text,
    revert() {
      if ((el as { [K]?: SplitText })[K] !== s) return;
      delete (el as { [K]?: SplitText })[K];
      el.replaceChildren(...originals);
    },
  };
  (el as { [K]?: SplitText })[K] = s;
  return s;
}
