// hadi-march/base — the app's root URL (its base path): the folder that holds index.html, assets/, themes/ and the
// public files, whatever route the page shows. One answer for the router, the chunk preloader, theme stylesheets and public files, so an app
// works at the domain root, in a sub-folder (example.com/app/), from files (file://) and inside an iframe alike.
//
//   appUrl("media/photo.jpg")   → "https://example.com/app/media/photo.jpg" on any route (never relative to the route)
//   appBase()                   → "/app" (the path part, no trailing slash; "" at the domain root)
//
// Found in this order: a <base href> element, the base `march build` wrote into index.html (<meta name="march-base">,
// from march.config.js `base` when it is a path such as "/app/"), then the place the entry script was loaded from
// (march build puts it in <root>/assets/). Without any of them: the domain root (http) or the page's folder (file://).

let cached: URL | null | undefined;
let custom: string | null = null;

/** Set the root yourself ("/app/", or a full URL); null goes back to finding it. */
export function setAppBase(base: string | null): void { custom = base; cached = undefined; }

/** The app's root folder as a URL (ends with "/"), or null outside a browser. */
export function appBaseUrl(): URL | null {
  if (cached !== undefined) return cached;
  const d = globalThis.document, l = globalThis.location;
  if (!l?.href) return null;
  const q = (s: string): string | null | undefined => d?.querySelector?.(s)?.getAttribute(s[0] === "m" ? "content" : s[0] === "b" ? "href" : "src");
  const dir = (s: string): string => s.replace(/\/?$/, "/");
  // the entry script: <root>/assets/main.js (also on a prerendered sub-page: ../assets/main.js)
  const src = q("script[type=module][src]"), meta = q('meta[name="march-base"]');
  let u: URL | null;
  try {
    u = custom != null ? new URL(dir(custom), l.href) : q("base[href]") != null ? new URL("./", d.baseURI)
      : meta ? new URL(dir(meta), l.href) : src && /\/assets\/[^/]*$/.test(new URL(src, l.href).pathname) ? new URL("../", new URL(src, l.href))
      : new URL(l.protocol === "file:" ? "./" : "/", l.href);
  } catch { u = null; }
  // not kept before the document can answer (a module runs after parsing, so this is rare)
  if (d?.querySelector) cached = u;
  return u;
}

/** The base path: "/app" for an app in /app/, "" at the domain root (no trailing slash). */
export function appBase(): string { return (appBaseUrl()?.pathname ?? "/").replace(/\/$/, ""); }

/**
 * A public file or app path as a full URL under the app's root: appUrl("media/a.jpg"), appUrl("/media/a.jpg") (a
 * leading "/" means the app root, not the domain root). Full URLs, data:, blob: and "#…" pass through.
 */
export function appUrl(path: string): string {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) return path;
  const root = appBaseUrl();
  const rel = path.replace(/^(\.\/|\/)+/, "");
  return root ? new URL(rel, root).href : rel;
}

/** Forget the cached root (tests, or after the document changed its <base>). */
export function _resetAppBase(): void { cached = undefined; custom = null; }
