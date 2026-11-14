// Spotlight: one light that follows the pointer over a set of cards. Every card near the pointer is lit from the real
// pointer position (also from the gap between two cards), so the light reads as one. The helper writes the pointer's
// place inside each near card to two custom properties and toggles a class; the look is CSS (`.m-spotlight` in
// motion.css, or your own rules reading the variables). Work is coalesced to one pass per frame on the motion clock.
// Touch pointers are ignored.
//   const off = spotlight(document, { selector: ".card" })
import { nextFrame } from "./engine/clock.ts";

export interface SpotlightOptions {
  /** The cards (matched under `root` each time the pointer moves, so cards added later are found). */
  selector: string;
  /** How near the pointer must be to a card's box, px (default 340). */
  reach?: number | undefined;
  /** Class every matched card gets once (default "m-spotlight": the ready look); false: none, style the cards yourself. */
  look?: string | false | undefined;
  /** Class of a lit card (default "is-lit"). */
  litClass?: string | undefined;
  /** Custom properties that take the pointer's place inside the card, px (default "--m-spot-x" / "--m-spot-y"). */
  xVar?: string | undefined;
  yVar?: string | undefined;
}

/** Light the cards under `root` from the pointer. Returns a function that stops it and puts the lights out. */
export function spotlight(root: Document | Element, o: SpotlightOptions): () => void {
  const reach = o.reach ?? 340, lit = o.litClass ?? "is-lit", look = o.look === undefined ? "m-spotlight" : o.look;
  const xVar = o.xVar ?? "--m-spot-x", yVar = o.yVar ?? "--m-spot-y";
  const target = root as Element; // Document and Element share the listener and query methods used here
  let point: { x: number; y: number } | null = null, queued = false, on = true, cancel: (() => void) | null = null;
  const cards = (): HTMLElement[] => Array.from(target.querySelectorAll<HTMLElement>(o.selector));
  const out = (): void => { for (const c of cards()) c.classList.remove(lit); };
  const pass = (): void => {
    queued = false;
    if (!on) return;
    if (!point) { out(); return; }
    const { x, y } = point, list = cards();
    // read every box first, then write (no layout between the writes)
    const boxes = list.map((c) => c.getBoundingClientRect());
    list.forEach((c, i) => {
      const r = boxes[i]!;
      // distance from the pointer to the card's box (0 inside it)
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
      const near = r.width > 0 && dx * dx + dy * dy < reach * reach;
      if (look && !c.classList.contains(look)) c.classList.add(look);
      if (near) { c.style.setProperty(xVar, `${Math.round(x - r.left)}px`); c.style.setProperty(yVar, `${Math.round(y - r.top)}px`); }
      c.classList.toggle(lit, near);
    });
  };
  const queue = (): void => { if (!queued && on) { queued = true; cancel = nextFrame(pass, "update"); } };
  const move = (e: Event): void => {
    const p = e as PointerEvent;
    if (p.pointerType === "touch") return;
    point = { x: p.clientX, y: p.clientY };
    queue();
  };
  const scroll = (): void => { if (point) queue(); };
  const leave = (): void => { point = null; queue(); };
  const doc = (target.ownerDocument ?? target) as unknown as Document;
  target.addEventListener("pointermove", move, { passive: true });
  target.addEventListener("pointerleave", leave, { passive: true });
  doc.addEventListener("scroll", scroll, { passive: true, capture: true });
  return () => {
    on = false; cancel?.();
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerleave", leave);
    doc.removeEventListener("scroll", scroll, { capture: true });
    out();
  };
}
