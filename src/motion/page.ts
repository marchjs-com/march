// Page transitions for the router: View Transitions API where supported (cross-fade / slide of the old and new page),
// a short fade-in of the new page elsewhere. Reduced motion: instant.
//   pageTransitions({ type: "slide" })   — call once at startup, after createRouter()
import { setNavigationWrapper, transitionOutlet } from "../router/index.ts";
import { animate } from "./animate.ts";
import { reducedMotion } from "./env.ts";

export interface PageTransitionOptions { type?: "fade" | "slide"; duration?: number; target?: string }

interface ViewTransitionLike { updateCallbackDone: Promise<void>; finished: Promise<void> }
type StartVT = (cb: () => void) => ViewTransitionLike;

export function pageTransitions(o: PageTransitionOptions = {}): () => void {
  const root = globalThis.document?.documentElement;
  root?.setAttribute("data-hm-page-transition", o.type ?? "fade");
  setNavigationWrapper(async (apply: () => void, { pop }: { pop: boolean }) => {
    const doc = globalThis.document as Document & { startViewTransition?: StartVT };
    if (reducedMotion() || !doc) { apply(); return; }
    root?.setAttribute("data-hm-nav", pop ? "back" : "forward");
    // only the outlet whose content changes takes part (the shell and the layouts above it stay still)
    const pageEl = (): HTMLElement | null => (transitionOutlet()?.firstElementChild as HTMLElement | null) ?? null;
    const name = (el: HTMLElement | null, on: boolean): void => { if (on) el?.style.setProperty("view-transition-name", "hm-page"); else el?.style.removeProperty("view-transition-name"); };
    if (typeof doc.startViewTransition === "function") {
      const old = pageEl();
      if (old) { root?.setAttribute("data-hm-vt-scope", "outlet"); name(old, true); }
      const vt = doc.startViewTransition(() => { name(old, false); apply(); if (old) name(pageEl(), true); }) as ReturnType<StartVT> & { ready?: Promise<unknown>; finished?: Promise<unknown> };
      void Promise.resolve(vt.finished).catch(() => undefined).then(() => { name(pageEl(), false); root?.removeAttribute("data-hm-vt-scope"); });
      // an aborted transition (resize, a second navigation) is not an error: the DOM update still happened
      vt.ready?.catch(() => undefined); vt.finished?.catch(() => undefined);
      await vt.updateCallbackDone.catch(() => undefined);
      return;
    }
    apply();
    const main = o.target ? doc.querySelector(o.target) : pageEl() ?? doc.querySelector("main");
    if (main) animate(main, o.type === "slide" ? [{ opacity: 0, transform: `translateX(${pop ? -16 : 16}px)` }, { opacity: 1, transform: "none" }] : [{ opacity: 0 }, { opacity: 1 }], { duration: o.duration ?? 200 });
  });
  return () => setNavigationWrapper(null);
}
