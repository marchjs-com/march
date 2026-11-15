// march/seo/hydrate — take over HTML written by `march build` (seo.prerender) without a blank frame.
//
//   hydrate(() => <Router />, document.getElementById("app"))      // instead of render(...)
//
// March builds DOM with fine-grained bindings rather than patching markup, so hydration is a swap: the app renders
// off-screen while the prerendered page stays visible (links work, text is selectable, crawlers already have it); once
// the route and its lazy parts are ready the new nodes replace the old ones in one step. Without prerendered content
// it is exactly render(). When the URL shows another route than the one prerendered (an SPA fallback, or a hash
// route such as #/charts on a page prerendered for #/) the stale content is dropped at once, so it never flashes.
import { render } from "../dom/render.ts";
import { _router } from "../router/router.ts";

export interface HydrateOptions {
  /** Ready to swap (default: the router shows its first page and nothing is loading). */
  ready?: () => boolean;
  /** Swap anyway after this many ms (default 4000). */
  timeout?: number;
}

import { prerenderedFor } from "./prerendered.ts";
export { prerenderedFor };

/** Set on <html> while hydrate() builds the app off-screen: what renders then is already on screen as prerendered HTML,
 *  so entrance animations (motion reveal) skip it and the swap shows no change. A DOM attribute, not an import:
 *  the motion code needs no dependency on this chunk. */
export const HYDRATING_ATTR = "data-m-hydrating";

/** Take over prerendered HTML (data-m-prerender) without a flash, or render normally when there is none. */
export function hydrate(fn: () => unknown, el: Element, opts: HydrateOptions = {}): () => void {
  if (!el.hasAttribute("data-m-prerender")) return render(fn, el);
  const fresh = prerenderedFor(el);
  el.removeAttribute("data-m-prerender");
  if (!fresh) { el.replaceChildren(); return render(fn, el); }
  const box = el.ownerDocument.createElement("div"), S = _router.S, end = Date.now() + (opts.timeout ?? 4000);
  const html = el.ownerDocument.documentElement;
  html.setAttribute(HYDRATING_ATTR, "");
  const dispose = render(fn, box);
  const ready = opts.ready ?? ((): boolean => !S.router || (!!S.router.view.peek() && !S.pending.peek() && !box.querySelector("[aria-busy=true]")));
  let done = false;
  const swap = (): void => { if (!done) { done = true; el.replaceChildren(...box.childNodes); html.removeAttribute(HYDRATING_ATTR); } };
  const tick = (): void => { if (!done) { if (ready() || Date.now() > end) swap(); else setTimeout(tick, 16); } };
  tick();
  return () => { swap(); dispose(); };
}
