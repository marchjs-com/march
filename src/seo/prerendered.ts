// Does the address show the route that `march build` prerendered into this element? Tiny (no router): an entry can ask
// before it loads anything else, and drop stale markup at once.

import { appBase } from "../base/index.ts";

const norm = (p: string): string => p.replace(/\/(index\.html?)?$/, "") || "/";

/**
 * True when the URL shows the route prerendered into `el` (data-hm-prerender: "#/x" for hash routing, else "/x").
 * History routing compares the path under the app's base (appBase()), so it works in any sub-folder. An address
 * that names another route — an old hash link (#/x), the hash fallback, or the ?hm-path= of a 404 fallback — never
 * matches a path-prerendered page.
 */
export function prerenderedFor(el: Element): boolean {
  const pre = el.getAttribute("data-hm-prerender"), l = globalThis.location;
  if (pre == null || !l) return false;
  if (pre[0] === "#") return norm((l.hash.slice(1) || "/").split("?")[0] as string) === norm(pre.slice(1));
  if (/^#\//.test(l.hash) || /[?&]hm-path=/.test(l.search)) return false;
  const base = appBase(), p = l.pathname;
  return norm(base && (p === base || p.startsWith(`${base}/`)) ? p.slice(base.length) : p) === norm(pre);
}
