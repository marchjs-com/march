// ScrollToTop (hadi-march/ui): a "back to top" button that shows once the page is scrolled down and, when pressed,
// scrolls back to the top on the motion engine (global speed, "stop all" and reduced motion apply). By default it puts
// itself into the page corner (BottomRightControls), so it never overlaps other corner controls; `inline` renders it
// where it is written instead. It follows whatever scrolls — the window or an app shell's scrolling main area.
//
//   <ScrollToTop />                    // once per app: appears after 320 px of scrolling
//   <ScrollToTop threshold={600} order={-1} />
import "./scroll-to-top.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { signal, effect, onCleanup } from "../../../core/reactive.ts";
import { listen } from "../../../core/util.ts";
import { IconButton } from "../../../ui/button.ts";
import { glyph } from "../../../ui/util.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { animate } from "../../../motion/animate.ts";
import { animateValue } from "../../../motion/engine/value.ts";
import { addBottomRightControl } from "../../layout/bottom-right-controls/index.ts";

export interface ScrollToTopProps {
  /** Scrolled distance (px) after which the button shows. Default 320. */
  threshold?: number | undefined;
  /** Place in the page corner (lower = nearer the edge). Default 0. */
  order?: number | undefined;
  /** Render in place instead of in the page corner. */
  inline?: boolean | undefined;
  /** What to scroll; default: whatever the user last scrolled (the window or a scrolling container). */
  target?: Element | Window | undefined;
  label?: string | undefined;
}

type Scroller = Element | Window;
const topOf = (s: Scroller): number => (s instanceof Element ? s.scrollTop : (s as Window).scrollY ?? 0);
const setTop = (s: Scroller, y: number): void => { if (s instanceof Element) s.scrollTop = y; else (s as Window).scrollTo(0, y); };

/** A button that scrolls the page back to the top; hidden until the page is scrolled past `threshold`. */
export function ScrollToTop(props: ScrollToTopProps = {}): Node {
  const threshold = props.threshold ?? 320;
  const shown = signal(false);
  const win = globalThis.window as Window | undefined;
  let scroller: Scroller | undefined = props.target ?? win;

  // scroll does not bubble, but it can be caught on the way down: one listener follows the window and any container
  const read = (e?: Event): void => {
    const tg = e?.target;
    if (!props.target && tg) scroller = tg === globalThis.document || tg === globalThis.document?.documentElement ? win : (tg as Element);
    if (scroller) shown.set(topOf(scroller) > threshold);
  };
  onCleanup(listen(globalThis.document, { scroll: read }, { capture: true, passive: true }));

  let run: { cancel(): void } | null = null;
  const toTop = (): void => {
    const s = scroller;
    if (!s) return;
    run?.cancel();
    const from = topOf(s);
    run = animateValue(from, 0, { duration: Math.min(900, 300 + from / 6), easing: "easeOutCubic", onUpdate: (y: number) => setTop(s, y) });
  };
  // the user taking over (wheel, touch, keys) stops the ride
  onCleanup(listen(globalThis.document, { wheel: () => run?.cancel(), touchstart: () => run?.cancel(), keydown: () => run?.cancel() }, { passive: true }));

  const btn = h(IconButton, { class: "hm-to-top", variant: "secondary", label: () => props.label ?? t`Back to top`, onClick: toTop }, glyph(arrowUp)) as HTMLElement;
  btn.setAttribute("data-shown", "false");
  btn.inert = true;
  effect(() => {
    const on = shown();
    if (btn.getAttribute("data-shown") === String(on)) return;
    btn.setAttribute("data-shown", String(on));
    btn.inert = !on;
    animate(btn, on
      ? [{ opacity: 0, transform: "translateY(12px) scale(0.85)" }, { opacity: 1, transform: "none" }]
      : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(12px) scale(0.85)" }],
    { duration: on ? 260 : 180, easing: on ? "easeOutBack" : "easeInCubic", fill: "forwards" });
  });
  read();

  if (props.inline) return btn;
  addBottomRightControl(btn, props.order ?? 0);
  return globalThis.document.createComment("scroll-to-top");
}
