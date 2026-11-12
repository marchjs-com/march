# SEO (`hadi-march/seo`)

Head tags per route, Open Graph / Twitter cards, JSON-LD, build-time prerendering with hydration, `sitemap.xml`,
`robots.txt` and a page check. Integrated with the router: a route (or its page module) declares its `head`, the
router hands it over on every navigation.

## Head tags

```tsx
import { installSeo, useHead, ld } from "hadi-march/seo";

installSeo({
  site: "https://shop.example",          // origin (+ base): canonical, og:url, absolute og:image
  titleTemplate: "%s · Shop",            // or (title) => string
  defaults: { og: { siteName: "Shop", image: "/og.png" }, twitter: { site: "@shop" }, lang: "en" },
});

createRouter({ routes: {
  "/": { load: () => import("./pages/home.tsx"), head: { title: "Home", description: "…" } },
  "/products/:id": { load: () => import("./pages/product.tsx") },  // the page module exports `head`
} });

// pages/product.tsx
export const head = (to) => ({ title: `Product ${to.params.id}`, robots: "index,follow" });
export default function Product(props) {
  const p = query(() => api.product(props.params.id));
  // reactive: re-runs when p() changes; removed when the page is left
  useHead(() => p() && { title: p().name, description: p().summary, og: { type: "product", image: { url: p().photo, alt: p().name } },
    jsonLd: ld.product({ name: p().name, price: p().price, currency: "EUR", availability: "InStock" }) });
  …
}
```

`HeadInput`: `title`, `titleTemplate`, `description`, `canonical` (URL or `true`), `robots`, `lang`, `meta[]`,
`link[]`, `og`, `twitter`, `jsonLd` (object or array).

- **Merge order:** `defaults` → the route's `head` (a page module's `head` export wins over the route table's) →
  `useHead()` calls in creation order. Later values win; `meta` / `link` merge by key (`name`, `property`, `rel` +
  `hreflang`), JSON-LD blocks add up.
- **Titles:** `titleTemplate` applies to head titles. A route without a head title keeps the router's own title
  (`createRouter({ title })`, a page's `title`) as it is.
- **Cards:** `og` fills `og:title` / `og:description` / `og:url` from the head; `twitter` falls back to the Open Graph
  values and picks `summary_large_image` when there is an image. `og: false` / `twitter: false` turn them off.
- **Canonical:** with `site`, every route gets `<link rel="canonical">` built from the path (history routing). Hash
  routing never gets an automatic canonical: every route is the same document.
- **Not found:** gets `robots: noindex` (`noindexNotFound: false` to turn off).
- **DOM:** tags are updated in place. A tag that was in the static HTML is restored when nothing sets it any more;
  tags added by March (`data-hm-head`) are removed. No `innerHTML`: elements are built with `createElement`,
  JSON-LD with a text node, and a JSON-LD block already in the HTML (prerendered) is reused when its text is the same.
- **Trusted Types:** under `require-trusted-types-for 'script'` the browser blocks (and reports) script text written at
  run time, JSON-LD included. Use `installSeo({ jsonLd: false })` there and put structured data in at build time
  (`seo.head` or the route heads, which prerender writes into the HTML; parser-inserted blocks are not affected).
- `headTags()` (reactive) is the list written now; `resolveHead(inputs, { site, path })` and `headToHtml(tags)` are the
  pure functions behind it (previews, servers).

## JSON-LD

`ld.website({ name, url, search })`, `ld.organization`, `ld.breadcrumbs([[name, path]…], site)`, `ld.article`,
`ld.product`, `ld.faq([[question, answer]…])` return schema.org objects. `jsonLdText(x)` is the JSON written into the
`<script type="application/ld+json">`: `<`, `>` and `&` are escaped, so text can never close the element.

## Prerender and hydration

```js
// march.config.js
export default {
  seo: {
    site: "https://shop.example",
    prerender: true,               // or ["/", "/about"]; true = every route without params
    sitemap: true,                 // { extra: ["/products/1"] } adds URLs
    robots: { disallow: ["/admin"] },
    head: { jsonLd: { "@context": "https://schema.org", "@type": "WebSite", name: "Shop", url: "https://shop.example" } },
    timeout: 5000,                 // per route
    // ↑ `head`: static tags of every prerendered page (not managed at run time: never removed by the browser)
    keepStyle: false,              // inline style attributes are dropped (strict style-src)
  },
};
```

`march build` bundles the app once more for node, runs each route inside March's test DOM (`hadi-march/testing`) and
writes `dist/<route>/index.html` with the page markup and its head. The CSS of the route's chunks becomes
`<link rel="stylesheet">` and its JS `<link rel="modulepreload">`, so the page is styled before any script runs.
Timers the app starts are cleared; a route that throws is left to the browser (a warning, not a failure).
Browser APIs the test DOM lacks (`ResizeObserver`, `IntersectionObserver`…) are no-op stubs during prerender.

In the browser, `hydrate()` replaces `render()`:

```tsx
import { hydrate } from "hadi-march/seo/hydrate";
hydrate(() => <Router />, document.getElementById("app"));
```

March builds DOM with fine-grained bindings rather than patching markup, so hydration is a swap: the app renders
off-screen while the prerendered page stays visible, and once the router shows its page (nothing loading) the new
nodes replace the old ones in one step (`ready`, `timeout` options). The container carries
`data-hm-prerender="/about"`; when the URL shows another route (an SPA fallback serving the root page, or a hash route
such as `#/charts` on a page prerendered for `#/`) the stale content is dropped at once, so it never flashes.
`hydrate()` without prerendered content is `render()`.

With a tight entry budget, keep `hydrate` out of the entry: compare the marker yourself (one line) and load it only on
the prerendered route; every other URL renders at once, as before.

```tsx
const app = () => <Router />;
if (el.getAttribute("data-hm-prerender") === `#${location.hash.slice(1) || "/"}`) void import("hadi-march/seo/hydrate").then((m) => m.hydrate(app, el));
else { el.replaceChildren(); render(app, el); }
```
(`hadi-march/seo/hydrate` is about 1 KB; under a `chunks.minSize` add it to `chunks.allow`.)

**Hash routing** (static hosting, artifacts): only the start page is prerendered into `index.html`; other routes load
as before. No sitemap entries for hash routes and no automatic canonical.

`sitemap.xml` and `robots.txt` need `site`; a file of the same name in `public/` wins.

## `march seo check`

```sh
march build && march seo check            # every .html under outdir
march seo check --dir out --no-canonical
```

Errors: missing `<title>`, missing description, missing or relative canonical (pages that are not `noindex`; off for
hash-routed pages and without `seo.site`), `<img>` without `alt`, invalid JSON-LD. Warnings: title over 60 characters,
description outside 50–160, no `lang`, zero or several `<h1>`, no viewport meta, Open Graph card without `og:image`.
The same check runs anywhere: `checkHtml(document.documentElement.outerHTML)` → `SeoIssue[]`.
