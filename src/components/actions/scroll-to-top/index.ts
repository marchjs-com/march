// ScrollToTop (hadi-march/ui): a "back to top" button that shows once the page is scrolled down and, when pressed,
// scrolls back to the top smoothly (at once with reduced motion). By default it puts
// itself into the page corner (BottomRightControls), so it never overlaps other corner controls; `inline` renders it
// where it is written instead. It follows whatever scrolls — the window or an app shell's scrolling main area.
//
//   <ScrollToTop />                    // once per app: appears after 320 px of scrolling
//   <ScrollToTop threshold={600} order={-1} />
//   <ScrollToTop icon={chevronUp} color="brand-blue" motion="fade" />   // every part can be replaced or turned off
import "./scroll-to-top.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { signal, effect, onCleanup } from "../../../core/reactive.ts";
import { listen } from "../../../core/util.ts";
import { IconButton } from "../../../ui/button.ts";
import { glyph, icon, cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { animate } from "../../../motion/animate.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { addBottomRightControl } from "../../layout/bottom-right-controls/index.ts";

export interface ScrollToTopProps {
  /** Scrolled distance (px) after which the button shows. Default 320. */
  threshold?: number | undefined;
  /** Place in the page corner (lower = nearer the edge). Default 0. */
  order?: number | undefined;
  /** Render in place instead of in the page corner. */
  inline?: boolean | undefined;
  /** What to follow and scroll; default: the page — the window, or the app's main area when that is what scrolls.
   *  Boxes that scroll inside the page (a demo, a list, a code block) are never taken over. */
  target?: Element | Window | undefined;
  /** Accessible name and tooltip (default: "Back to top", translated). */
  label?: MaybeFn<string | undefined>;
  /** The icon (default: an up arrow): your own node / icon. */
  icon?: unknown;
  /** Theme color token of the icon and border (default: text colour, the theme's primary on hover). */
  color?: ColorToken | undefined;
  /** How the button appears and leaves: "pop" (default), "fade", "slide", "none" / false, or `(el, shown) => …` (your own animation). */
  motion?: "pop" | "fade" | "slide" | "none" | false | ((el: HTMLElement, shown: boolean) => unknown) | undefined;
  /** Scroll back smoothly (default true); false jumps at once. */
  smooth?: boolean | undefined;
  class?: ClassProp;
}

const SHOWN = { opacity: 1, transform: "none" };
const HIDDEN = { pop: { opacity: 0, transform: "translateY(12px) scale(0.85)" }, fade: { opacity: 0, transform: "none" }, slide: { opacity: 0, transform: "translateY(12px)" } };

type Scroller = Element | Window;
const topOf = (s: Scroller): number => (s instanceof Element ? s.scrollTop : (s as Window).scrollY ?? 0);
const setTop = (s: Scroller, y: number): void => { if (s instanceof Element) s.scrollTop = y; else (s as Window).scrollTo(0, y); };

/** A button that scrolls the page back to the top; hidden until the page is scrolled past `threshold`. */
export function ScrollToTop(props: ScrollToTopProps = {}): Node {
  const threshold = props.threshold ?? 320;
  const shown = signal(false);
  const win = globalThis.window as Window | undefined;
  let scroller: Scroller | undefined = props.target ?? win;

  // scroll does not bubble, but it can be caught on the way down: one listener sees the window and the page's own
  // scrolling main area (an app shell); a box scrolling inside the page is not the page and is left alone
  const doc = globalThis.document;
  const isPage = (tg: EventTarget | null | undefined): boolean =>
    tg === doc || tg === doc?.documentElement || tg === doc?.body || (tg instanceof Element && tg.matches("main, .hm-shell-main, [data-hm-scroll-root]"));
  const read = (e?: Event): void => {
    const tg = e?.target;
    if (props.target) { if (tg && tg !== props.target && !(props.target === win && isPage(tg))) return; }
    else if (tg) { if (!isPage(tg)) return; scroller = tg === doc || tg === doc?.documentElement || tg === doc?.body ? win : (tg as Element); }
    if (scroller) shown.set(topOf(scroller) > threshold);
  };
  onCleanup(listen(globalThis.document, { scroll: read }, { capture: true, passive: true }));

  // the browser's own smooth scroll: it keeps its aim while content above loads and changes height (scroll anchoring),
  // and gives way when the user scrolls; reduced motion jumps at once
  const toTop = (): void => {
    const s = scroller;
    if (!s) return;
    if (props.smooth === false || reducedMotion() || typeof s.scrollTo !== "function") return setTop(s, 0);
    s.scrollTo({ top: 0, behavior: "smooth" });
  };

  const btn = h(IconButton, { class: () => cx("hm-to-top", val(props.class)), variant: "secondary", color: props.color, label: () => val(props.label) ?? t`Back to top`, onClick: toTop },
    props.icon == null || props.icon === true || props.icon === false ? glyph(arrowUp) : icon(props.icon)) as HTMLElement;
  btn.setAttribute("data-shown", "false");
  btn.inert = true;
  effect(() => {
    const on = shown();
    if (btn.getAttribute("data-shown") === String(on)) return;
    btn.setAttribute("data-shown", String(on));
    btn.inert = !on;
    const motion = props.motion ?? "pop";
    if (typeof motion === "function") { motion(btn, on); return; }
    if (motion === "none" || motion === false) return; // the stylesheet shows and hides it at once
    const off = HIDDEN[motion] ?? HIDDEN.pop;
    animate(btn, on ? [off, SHOWN] : [SHOWN, off], { duration: on ? 260 : 180, easing: on ? "easeOutBack" : "easeInCubic", fill: "forwards" });
  });
  read();

  if (props.inline) return btn;
  addBottomRightControl(btn, props.order ?? 0);
  return globalThis.document.createComment("scroll-to-top");
}
