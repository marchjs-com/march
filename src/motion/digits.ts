// Rolling digits: the one odometer behind every animated number (CountRoll in social, Counter in landing). Text is
// drawn as one cell per character; when it changes, only the cells whose character changed roll — the old glyph slides
// out and the new one in, upward when the number grows and downward when it shrinks — on the motion engine. Cells are
// aligned from the end so units stay under units; a change of length rolls every cell.
//   drawDigits(box, "1,204")    rollDigits(box, "1,204", "1,205", { up: true })
import "./digits.css";
import { h } from "../dom/h.ts";
import { animate } from "./engine/playback.ts";

export interface RollOptions {
  /** The number grew (digits roll up) or shrank (down). Default true. */
  up?: boolean;
  /** ms per digit (default 320). */
  duration?: number;
  /** Delay between neighbouring digits, from the last one (default 24 ms). */
  stagger?: number;
}

const cell = (ch: string): HTMLElement => h("span", { class: /\d/.test(ch) ? "m-roll-d" : "m-roll-s" }, ch) as HTMLElement;

/** Draw `text` into `box` without motion (first paint, reduced motion). */
export function drawDigits(box: HTMLElement, text: string): void {
  box.replaceChildren(...[...text].map(cell));
}

/** Roll `box` from `from` to `to`: only the changed characters move. */
export function rollDigits(box: HTMLElement, from: string, to: string, o: RollOptions = {}): void {
  const a = [...from], b = [...to], dur = o.duration ?? 320, each = o.stagger ?? 24, up = o.up !== false;
  const same = a.length === b.length;
  box.replaceChildren(...b.map((ch, i) => {
    const old = same ? a[i] : undefined;
    const el = cell(ch);
    if (old === ch) return el;
    const slot = h("span", { class: "m-roll-slot" }, el) as HTMLElement;
    const delay = (b.length - 1 - i) * each;
    if (old !== undefined) {
      const ghost = h("span", { class: "m-roll-ghost" }, old) as HTMLElement;
      slot.append(ghost);
      const out = animate(ghost, [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${up ? -100 : 100}%)`, opacity: 0 }], { duration: dur, easing: "out", fill: "forwards", delay });
      void out.finished.then(() => ghost.remove(), () => ghost.remove());
    }
    animate(el, [{ transform: `translateY(${up ? 100 : -100}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: dur, easing: "back", fill: "backwards", delay });
    return slot;
  }));
}
