// hadi-march/seo/hydrate — take over HTML written by `march build` (seo.prerender) without a blank frame.
//
//   hydrate(() => <Router />, document.getElementById("app"))      // instead of render(...)
//
// March builds DOM with fine-grained bindings rather than patching markup, so hydration is a swap: the app renders
// off-screen while the prerendered page stays visible (links work, text is selectable, crawlers already have it); once
// the route and its lazy parts are ready the new nodes replace the old ones in one step. Without prerendered content
// it is exactly render(). When the URL shows another route than the one prerendered (an SPA fallback, or a hash
// route such as #/charts on a page prerendered for #/) the stale content is dropped at once, so it never flashes.
import { render } from "../dom/render.ts";
import { _router } from "../router/index.ts";

export interface HydrateOptions {
  /** Ready to swap (default: the router shows its first page and nothing is loading). */
  ready?: () => boolean;
  /** Swap anyway after this many ms (default 4000). */
  timeout?: number;
}

const norm = (p: string): string => p.replace(/\/(index\.html)?$/, "") || "/";

/**
 * True when the URL shows the route prerendered into `el` (data-hm-prerender: "#/x" for hash routing, else "/x").
 * History routing compares the end of the path, so it works under any base; "/" matches only a folder URL.
 */
export function prerenderedFor(el: Element): boolean {
  const pre = el.getAttribute("data-hm-prerender"), l = globalThis.location;
  if (pre == null || !l) return false;
  if (pre[0] === "#") return norm((l.hash.slice(1) || "/").split("?")[0] as string) === norm(pre.slice(1));
  return pre === "/" ? /\/(index\.html)?$/.test(l.pathname) : norm(l.pathname).endsWith(norm(pre));
}

export function hydrate(fn: () => unknown, el: Element, opts: HydrateOptions = {}): () => void {
  if (!el.hasAttribute("data-hm-prerender")) return render(fn, el);
  const fresh = prerenderedFor(el);
  el.removeAttribute("data-hm-prerender");
  if (!fresh) { el.replaceChildren(); return render(fn, el); }
  const box = el.ownerDocument.createElement("div"), S = _router.S, end = Date.now() + (opts.timeout ?? 4000);
  const dispose = render(fn, box);
  const ready = opts.ready ?? ((): boolean => !S.router || (!!S.router.view.peek() && !S.pending.peek() && !box.querySelector("[aria-busy=true]")));
  let done = false;
  const swap = (): void => { if (!done) { done = true; el.replaceChildren(...box.childNodes); } };
  const tick = (): void => { if (!done) { if (ready() || Date.now() > end) swap(); else setTimeout(tick, 16); } };
  tick();
  return () => { swap(); dispose(); };
}
