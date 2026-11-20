# Hosting: normal addresses under any base path

A March app uses normal addresses (`/motion`, `/users/7`), not `#/motion`. The same build works at a domain root, in a
sub-folder (`example.com/app/`), on a static host with or without rewrite rules, from files (`file://`) and inside an
iframe. Nothing in the app names an absolute path: routes, links and public files are resolved under the app's **base**.

```tsx
createRouter({ routes })                              // mode "history" and base "auto" are the defaults
createRouter({ routes, mode: "history", base: "auto" })   // the same, spelled out
createRouter({ routes, base: "/app" })                // a fixed base
createRouter({ routes, history: memoryHistory() })    // an address of its own: the page's address, title and back button stay
```

`history: memoryHistory(start = "/")` is for a router that is not the page's: a preview (MarchIDE uses it), a test, a widget inside another
app. Links and `navigate()` work as usual; `back()` walks the router's own list.

## How the base is found

`base: "auto"` takes the first of:

1. a `<base href="…">` element in the page;
2. the base `march build` wrote into `index.html` (`<meta name="march-base" content="/app/">`, from
   `march.config.js` › `base` when it is a path such as `"/app/"`);
3. the folder the entry script was loaded from (`march build` puts it in `<root>/assets/`, so `./assets/main.js` on
   the start page and `../assets/main.js` on `motion/index.html` both point at the same root);
4. otherwise the domain root (or the page's folder for `file://`).

`march/base` gives the same answer to app code: `appBase()` is the path (`"/app"`, `""` at the root), `appUrl()`
resolves a public file under it on every route, `setAppBase()` sets it yourself.

```tsx
import { appUrl } from "march/base";
<img src={appUrl("media/photo.jpg")} alt="" />      // /app/media/photo.jpg on /app/, /app/users/7, /app/motion/svg…
```

A relative path such as `media/photo.jpg` written straight into the page would resolve against the *route's* address
(`/app/users/media/photo.jpg`); use `appUrl()` for anything in `public/`. Theme stylesheets (`setColorTheme`) and the
chunk preloader already resolve under the base.

## Links and navigation

`navigate("/users/7")` and `<Link href="/users/7">` take route paths; the router adds the base. A Link's `href` is
written relative to the current address (`../users/7`), so it is right under any base, also when opened in a new tab or
copied from prerendered HTML.

Where the page cannot change its address — `file://`, a sandboxed iframe with an opaque origin, or a browser that
refuses `pushState` — the router switches to `#/users/7` addresses by itself, with the same routes. A prerendered
sub-page opened from files (`dist/motion/index.html`) shows `/motion`; links inside it become `#/…`. Old hash links
(`…/#/motion`) are turned into `…/motion` on start, without an extra history entry.

## What `march build` writes

- `index.html` for the start page and, with `seo: { prerender: true }`, **`<route>/index.html` for every route without
  params** (`seo.routes` adds paths under a wildcard route, such as `/docs/intro` for `/docs/*`). Asset paths are
  relative to each page's folder (`base: "./"`) or absolute under a fixed base (`base: "/app/"`). A route the build
  could not render still gets the plain app shell there, so it opens directly too.
- **`404.html` + `march-404.js`** for routes with params (`/users/:id`) and any other address without a file: the host
  serves 404.html, which sends the address to the app's root (`?m-path=/users/7`); the router restores
  `/users/7` on start, without a history entry. With a relative build the page tries each folder depth for
  `march-404.js` (only the app's own copy exists), so it works in any sub-folder. Off with `fallback404: false`.
- `_headers` (caching; off with `headers: false`) and, with `redirects: true`, `_redirects` for Cloudflare Pages /
  Netlify (existing files always win over it). An absolute base gets `/app/*  /app/index.html  200`. A relative build
  gets `/*  /404.html  200`: its `index.html` cannot load its files from a deeper address, 404.html hands the address
  to the root instead. Do not write a `/* /index.html 200` rule by hand for a relative build.
- `sitemap.xml` / `robots.txt` with `seo.site`. `site` is the origin plus the base (`https://example.com/app`); an
  origin alone is completed with an absolute `base`. Canonical links (`canonical: true`) use the same root.

## Each host

**Cloudflare Pages.** Upload `dist/`. Every prerendered page is a folder (`/motion/` → `motion/index.html`); Pages
redirects `/motion` to `/motion/`, and the router treats both as `/motion`. Addresses with params get 404.html. For an
app in a sub-folder of a Pages project, set `base: "/app/"` and build into that folder. `redirects: true` writes the
matching `_redirects` (optional: 404.html already covers every address without a file).

**Netlify.** Same as Cloudflare Pages: upload `dist/`; 404.html is used automatically for addresses without a file.
`redirects: true` writes `_redirects` (see above), which Netlify applies only where no file exists. If the site serves
`/motion` without redirecting to `/motion/`, use an absolute `base` (relative asset paths count folders from the
address).

**GitHub Pages.** A project site lives in `/<repo>/`. The default relative build (`base: "./"`) works there as is;
`base: "/<repo>/"` makes the asset paths absolute. GitHub Pages has no rewrites: each prerendered page opens from its
folder and 404.html covers the rest. Add an empty `.nojekyll` to `public/` if a file name starts with `_`.

**S3, a CDN bucket, any plain file server.** No rewrites needed. Set the bucket's error document to `404.html`
(S3 static website hosting: "Error document"). A server that lists folders instead of serving `index.html` must have
directory indexes turned on.

**A sub-folder of another site** (`devs.example.com/march/`). Copy `dist/` into the folder. A relative build needs
nothing else. If the site's own server owns 404 handling, point the folder's not-found page at `march/404.html`, or
rewrite `/march/*` to `/march/index.html` with an absolute `base: "/march/"`.

**Files (`file://`).** Open `dist/index.html` or any `dist/<route>/index.html`. The router uses `#/` addresses; the
start page and every prerendered page open directly. (Module scripts from files need a browser that allows them, or a
local server: `node examples/showcase/build.mjs --serve`.)

**An iframe / an artifact.** The app runs as on any host. If the frame may not change its address (sandbox without
`allow-same-origin`), the router keeps the address and uses `#/` ones. If it may, reloading the frame loads the frame's
own `src` again (usually the start page); upload the `<route>/index.html` files too, so that a reload of a sub-page
address finds its page. Nothing breaks in either case: the worst outcome is the start page.

## Checking a build

```sh
node examples/showcase/build.mjs
node tools/menu-audit.mjs            # every menu page: direct visit, reload, back/forward, under each server mode
```
