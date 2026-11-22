// Prerender (static site generation) for `march build` with `seo: { prerender }` in march.config.js.
// The app is bundled once more as a single file for node, then run per route inside March's small test DOM
// (march/testing): the router renders the route as it would in a browser, the page's head tags are applied, and
// the finished <head> + <body> are written as that route's index.html. In the browser hydrate() (march/seo/hydrate)
// takes the markup over. Also writes sitemap.xml and robots.txt.
//
// History routing: every route without params gets its own <route>/index.html (asset paths relative to that depth, or
// under an absolute base), so a static host without rewrites opens each page directly; a route the build could not
// render gets the plain app shell there. Routes with params (/users/:id) are covered by 404.html: it sends the
// address to the app's root (?m-path=/users/7) and the router restores it on start (docs/hosting.md).
//
//   seo: {
//     site: "https://shop.example",        // absolute origin (+ base) — sitemap, robots Sitemap line, canonical
//     prerender: true | ["/", "/about"],   // true: every route without params (hash routing: "/" only)
//     routes: ["/docs/intro"],             // more paths with true (pages under a wildcard route: "/docs/*")
//     exclude: ["/ide"] | (path) => bool,  // routes left out: no <route>/index.html and no sitemap line; 404.html opens
//                                          // them (a page whose content is drawn at run time, a file count to keep)
//     sitemap: true, robots: true | { disallow: ["/admin"] },
//     head: { jsonLd: … },                 // extra head for every prerendered page (build time only, no runtime cost)
//     timeout: 5000, keepStyle: false,     // per route; inline style attributes are dropped (strict CSP)
//   }
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { march } from "./esbuild.js";

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "textarea", "title", "noscript"]);
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
  const k = e.toLowerCase();
  if (k[0] === "#") return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  return { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: "\u00a0" }[k] ?? m;
});
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** Parse simple, well-formed HTML (index.html) into a DOM parent: tags, attributes, text, raw-text elements. */
export function parseInto(doc, parent, html) {
  const stack = [parent];
  const top = () => stack[stack.length - 1];
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/gi;
  let last = 0, m;
  const text = (s) => { if (s) top().appendChild(doc.createTextNode(decode(s))); };
  while ((m = re.exec(html))) {
    text(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[1]) { const name = m[1].toLowerCase(); const i = stack.map((n) => n.localName).lastIndexOf(name); if (i > 0) stack.length = i; continue; }
    if (!m[2]) continue;
    const name = m[2].toLowerCase();
    const el = doc.createElement(name);
    const ar = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    while ((a = ar.exec(m[3] ?? ""))) el.setAttribute(a[1].toLowerCase(), decode(a[2] ?? a[3] ?? a[4] ?? ""));
    top().appendChild(el);
    if (RAW.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, last);
      const body = html.slice(last, end < 0 ? html.length : end);
      if (body) el.appendChild(doc.createTextNode(name === "textarea" || name === "title" ? decode(body) : body));
      if (name === "title") doc.title = decode(body).trim();
      if (end >= 0) { re.lastIndex = html.indexOf(">", end) + 1; last = re.lastIndex; }
      continue;
    }
    if (!VOID.has(name) && !m[4]) stack.push(el);
  }
  text(html.slice(last));
}

/** Serialize a (test) DOM node to HTML: void elements, raw text in script/style, no comments, optional style attributes. */
export function toHtml(n, { keepStyle = false, doc } = {}) {
  const ser = (x) => {
    if (x.nodeType === 3) return RAW.has(x.parentNode?.localName) && x.parentNode.localName !== "title" && x.parentNode.localName !== "textarea" ? x.data : escText(x.data);
    if (x.nodeType === 8) return "";
    if (x.nodeType !== 1) return x.childNodes.map(ser).join("");
    const name = x.localName;
    const attrs = x.getAttributeNames().filter((k) => keepStyle || k !== "style").map((k) => { const v = x.getAttribute(k); return v === "" ? ` ${k}` : ` ${k}="${escAttr(v)}"`; }).join("");
    if (VOID.has(name)) return `<${name}${attrs}>`;
    if (name === "title" && doc) return `<title>${escText(doc.title)}</title>`;
    return `<${name}${attrs}>${x.childNodes.map(ser).join("")}</${name}>`;
  };
  return ser(n);
}

const ORIGIN = "http://prerender.invalid";

/** Head tags (HTML) for build-time `seo.head`, through the same resolver the runtime uses. */
async function staticHead(head, site, path, importSeo) {
  if (!head) return "";
  const { resolveHead, headToHtml } = await importSeo();
  // not marked: static tags of the page, which the run-time head never removes
  return headToHtml(resolveHead([head], { ...(site ? { site } : {}), path }));
}

/**
 * @param {{ cwd: string, cfg: any, esbuild: any, out: string, importSeo: () => Promise<any>, log?: (s: string) => void }} o
 * @returns {Promise<{ routes: string[], failed: string[], mode: string }>}
 */
export async function prerender({ cwd, cfg, esbuild, out, importSeo, log = console.log }) {
  const seo = cfg.seo ?? {};
  const tmp = resolve(cwd, ".march", "prerender");
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const shared = {
    bundle: true, format: "esm", platform: "neutral", target: "es2022", write: true, logLevel: "silent", absWorkingDir: cwd,
    mainFields: ["module", "main"], conditions: ["import", "default"], alias: cfg.alias ?? {},
    define: { "process.env.NODE_ENV": "\"production\"", ...(cfg.define ?? {}) },
    loader: { ".css": "empty", ".svg": "dataurl", ".png": "empty", ".jpg": "empty", ".webp": "empty", ".woff2": "empty" },
    plugins: [march({ components: resolve(cwd, cfg.components ?? "src/components"), dev: false, cssSplit: false, i18nOut: join(tmp, "i18n-keys.json") })],
  };
  const entry = resolve(cwd, cfg.entry).split("\\").join("/");
  // the test DOM and the app: two files, so the DOM exists before the app's first line runs
  await esbuild.build({ ...shared, stdin: { contents: 'export { installDom } from "march/testing";', resolveDir: cwd, loader: "js" }, outfile: join(tmp, "dom.mjs") });
  // (the app namespace is kept as a value: an entry inside a package with "sideEffects" would otherwise be dropped)
  await esbuild.build({ ...shared, stdin: { contents: `export { _router as __router } from "march/router";\nimport * as app from ${JSON.stringify(entry)};\nexport const __app = app;`, resolveDir: cwd, loader: "js" }, outfile: join(tmp, "app.mjs") });
  const { installDom } = await import(pathToFileURL(join(tmp, "dom.mjs")).href);

  const template = readFileSync(join(out, "index.html"), "utf8");
  const doctype = /^\s*<!doctype[^>]*>/i.exec(template)?.[0] ?? "<!doctype html>";
  const relBase = (cfg.base ?? "/") === "./";
  const absBase = relBase ? "/" : (cfg.base ?? "/").replace(/\/?$/, "/");
  // the app finds its root from this while it renders at ORIGIN (the entry script path is relative to the start page)
  const baseMeta = !/<meta[^>]*name="march-base"/.test(template);
  /** Root-relative prefix for a page `depth` folders down: "./", "../../" (relative builds), or the absolute base. */
  const prefix = (depth) => (relBase ? (depth ? "../".repeat(depth) : "./") : absBase);
  const timeout = seo.timeout ?? 5000;

  // timers the app starts (animations, polling) must not keep the build alive
  const timers = new Set();
  const real = { setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval, clearTimeout: globalThis.clearTimeout, clearInterval: globalThis.clearInterval };
  const stubs = ["ResizeObserver", "IntersectionObserver", "MutationObserver"].filter((k) => !(k in globalThis));
  const sleep = (ms) => new Promise((r) => real.setTimeout(r, ms));
  const errors = [];
  const onErr = (e) => { errors.push(e); };

  let mode = "history", patterns = [];
  /** The app shell (index.html as built, nothing prerendered) at <route>/index.html, paths fixed for its depth. */
  const writeShell = (route) => {
    const depth = route.split("/").filter(Boolean).length;
    const html = relBase ? template.replace(/((?:src|href)=")\.\/(?!\.)/g, `$1${"../".repeat(depth)}`) : template;
    const file = join(out, ...route.split("/").filter(Boolean), "index.html");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  };
  const keep = (l) => excludeRoutes(l, seo.exclude);
  let list = Array.isArray(seo.prerender) ? keep(seo.prerender) : null;
  const done = [], failed = [], pages = [];
  let runs = 0;
  for (let i = 0; ; i++) {
    const route = list ? list[i] : "/";
    if (route == null) break;
    errors.length = 0;
    globalThis.setTimeout = (f, ms, ...a) => { const id = real.setTimeout((...x) => { timers.delete(id); f(...x); }, ms, ...a); timers.add(id); return id; };
    globalThis.setInterval = (f, ms, ...a) => { const id = real.setInterval(f, ms, ...a); timers.add(id); return id; };
    for (const k of stubs) globalThis[k] = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    process.on("unhandledRejection", onErr);
    process.on("uncaughtException", onErr);
    // a page is served from its folder (/motion/ → motion/index.html): render it at that address, so relative links match
    const url = mode === "hash" ? `${ORIGIN}${absBase}#${route}` : `${ORIGIN}${absBase.replace(/\/$/, "")}${route}${route === "/" ? "" : "/"}`;
    const dom = installDom({ url });
    const { document } = dom;
    try {
      document.documentElement.replaceChildren(document.head, document.body);
      const htmlAttrs = /<html([^>]*)>/i.exec(template)?.[1] ?? "";
      for (const a of htmlAttrs.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) document.documentElement.setAttribute(a[1], a[2] ?? "");
      parseInto(document, document.head, /<head[^>]*>([\s\S]*?)<\/head>/i.exec(template)?.[1] ?? "");
      if (baseMeta) { const m = document.createElement("meta"); m.setAttribute("name", "march-base"); m.setAttribute("content", absBase); m.setAttribute("data-march-prerender", ""); document.head.appendChild(m); }
      parseInto(document, document.body, /<body[^>]*>([\s\S]*?)<\/body>/i.exec(template)?.[1] ?? "");
      // a fresh copy of the app per page (the query makes node evaluate the module again)
      const mod = await import(`${pathToFileURL(join(tmp, "app.mjs")).href}?run=${++runs}`);
      const S = mod.__router.S;
      // ready: the router has shown the route, nothing is loading, and the markup stopped changing
      const t0 = Date.now();
      let prev = "", stable = 0;
      while (Date.now() - t0 < timeout) {
        await sleep(25);
        const now = toHtml(document.body);
        const idle = S.router && !S.pending.peek() && S.router.view.peek() && !document.body.querySelector('[aria-busy="true"]');
        stable = idle && now === prev ? stable + 1 : 0;
        prev = now;
        if (stable >= 3) break;
      }
      if (!S.router) throw errors[0] ?? new Error("the app did not call createRouter()");
      mode = S.router.mode;
      if (!list) list = seo.prerender === true || seo.prerender == null ? (mode === "hash" ? ["/"] : keep([...new Set([...S.router.routes.filter((r) => !r.keys.length && !r.pattern.includes("*")).map((r) => r.pattern), ...(seo.routes ?? [])])])) : ["/"];
      if (mode === "history") patterns = S.router.routes.map((r) => r.pattern);
      if (route !== list[i]) { i--; continue; }
      // March's boot placeholder (templates, showcase) has nothing to wait for on a prerendered page
      document.getElementById("m-boot")?.remove();
      document.head.querySelector("meta[data-march-prerender]")?.remove();
      const app = document.getElementById(cfg.appId ?? "app");
      if (!app) throw new Error(`no #${cfg.appId ?? "app"} element in index.html`);
      if (errors.length) throw errors[0];
      app.setAttribute("data-m-prerender", mode === "hash" ? `#${route}` : route);
      const depth = mode === "hash" || route === "/" ? 0 : route.split("/").filter(Boolean).length;
      // preloads the router added (chunk JS + CSS): the CSS becomes a stylesheet so the page is styled before JS runs
      for (const l of document.head.querySelectorAll("link[data-march-preload]")) {
        // idle prefetches of linked routes are the browser's business, not the page's
        if (l.getAttribute("rel") === "prefetch") { l.remove(); continue; }
        let href = l.getAttribute("href") ?? "";
        if (href.startsWith(ORIGIN)) href = href.slice(ORIGIN.length);
        const p = href.replace(/^\/+/, "").replace(/^(\.\.\/)+/, "").replace(absBase.replace(/^\//, ""), "");
        l.setAttribute("href", relBase ? `${depth ? "../".repeat(depth) : "./"}${p}` : `${absBase}${p}`);
        if (l.getAttribute("as") === "style") { l.setAttribute("rel", "stylesheet"); l.removeAttribute("as"); }
        l.removeAttribute("data-march-preload");
      }
      let headHtml = toHtml(document.head, { doc: document, keepStyle: true });
      headHtml = headHtml.replace(/^<head[^>]*>|<\/head>$/g, "");
      const extra = await staticHead(seo.head, seo.site, route, importSeo);
      if (extra) headHtml += extra;
      if (relBase && depth) headHtml = headHtml.replace(/((?:src|href)=")\.\/(?!\.)/g, `$1${"../".repeat(depth)}`);
      // public files the page resolved under the app's root (appUrl("media/a.jpg") → http://prerender.invalid/media/a.jpg)
      const atRoot = (h) => h.replaceAll(`="${ORIGIN}${absBase}`, `="${prefix(depth)}`);
      const bodyAttrs = document.body.getAttributeNames().map((k) => ` ${k}="${escAttr(document.body.getAttribute(k))}"`).join("");
      const htmlAttrs2 = document.documentElement.getAttributeNames().map((k) => { const v = document.documentElement.getAttribute(k); return v === "" ? ` ${k}` : ` ${k}="${escAttr(v)}"`; }).join("");
      const body = document.body.childNodes.map((n) => toHtml(n, { keepStyle: !!seo.keepStyle })).join("");
      const html = atRoot(`${doctype}\n<html${htmlAttrs2}>\n<head>${headHtml}</head>\n<body${bodyAttrs}>${body}</body>\n</html>\n`);
      const file = mode === "hash" || route === "/" ? join(out, "index.html") : join(out, ...route.split("/").filter(Boolean), "index.html");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html);
      const robots = /<meta[^>]*name="robots"[^>]*content="([^"]*)"/.exec(headHtml)?.[1] ?? "";
      pages.push({ route, noindex: /noindex/i.test(robots) });
      done.push(route);
    } catch (e) {
      failed.push(route);
      log(`\x1b[33m!\x1b[0m prerender ${route}: ${e?.message ?? e} (left to the browser)`);
      // the page still opens directly: the plain app shell at <route>/index.html (the router renders it in the browser)
      if (mode === "history" && route !== "/" && list) writeShell(route);
    } finally {
      for (const id of timers) { real.clearTimeout(id); real.clearInterval(id); }
      timers.clear();
      Object.assign(globalThis, real);
      for (const k of stubs) delete globalThis[k];
      process.off("unhandledRejection", onErr);
      process.off("uncaughtException", onErr);
      dom.cleanup();
    }
    if (!list) break;
  }
  if (mode === "history" && cfg.fallback404 !== false) write404(out, { template, relBase, absBase, depth: Math.max(1, ...patterns.map((p) => p.split("/").filter(Boolean).length)) });
  // seo.site is the origin (+ base): an absolute march.config.js base completes an origin-only site
  const site = siteRoot(seo.site, relBase ? null : absBase);
  if (seo.sitemap !== false && site && !existsSync(join(out, "sitemap.xml"))) {
    writeFileSync(join(out, "sitemap.xml"), sitemapXml(site, mode === "hash" ? ["/"] : pages.filter((p) => !p.noindex).map((p) => p.route), seo.sitemap?.extra));
  }
  if (seo.robots !== false && (site || seo.robots) && !existsSync(join(out, "robots.txt"))) {
    writeFileSync(join(out, "robots.txt"), robotsTxt({ ...(typeof seo.robots === "object" ? seo.robots : {}), sitemap: site && seo.sitemap !== false ? `${site}/sitemap.xml` : undefined }));
  }
  if (!process.env.MARCH_PRERENDER_KEEP) rmSync(tmp, { recursive: true, force: true });
  return { routes: done, failed, mode };
}

/**
 * The routes `seo.exclude` leaves in: a list of paths or a test. The start page ("/") always stays (404.html and the
 * other pages need its HTML).
 * @param {readonly string[]} routes
 * @param {readonly string[] | ((path: string) => boolean) | undefined} exclude
 */
export function excludeRoutes(routes, exclude) {
  const skip = typeof exclude === "function" ? exclude : Array.isArray(exclude) ? ((x) => (p) => x.has(p))(new Set(exclude)) : () => false;
  return routes.filter((p) => p === "/" || !skip(p));
}

/** sitemap.xml for absolute `site` and route paths. */
export function sitemapXml(site, routes, extra = []) {
  const day = new Date().toISOString().slice(0, 10);
  const urls = [...new Set([...routes, ...extra])].map((r) => `  <url><loc>${escText(r.startsWith("http") ? r : `${site}${r === "/" ? "/" : r}`)}</loc><lastmod>${day}</lastmod></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/** robots.txt: allow all (or `disallow` paths), with the sitemap line. */
export function robotsTxt({ disallow = [], allow = [], sitemap, userAgent = "*" } = {}) {
  const lines = [`User-agent: ${userAgent}`, ...allow.map((p) => `Allow: ${p}`), ...(disallow.length ? disallow.map((p) => `Disallow: ${p}`) : ["Allow: /"])];
  if (sitemap) lines.push("", `Sitemap: ${sitemap}`);
  return `${lines.join("\n")}\n`;
}

/** The site URL for sitemap / robots / canonical: `site` as given, or with the absolute base added when it has no path. */
export function siteRoot(site, absBase) {
  if (!site) return null;
  const u = String(site).replace(/\/+$/, "");
  return absBase && absBase !== "/" && !/^[a-z]+:\/\/[^/]+\/./i.test(u) ? `${u}${absBase.replace(/\/$/, "")}` : u;
}

/** The script 404.html runs: back to the app's root with the address in ?m-path= (the router restores it). */
export const NOT_FOUND_JS = `// March 404 fallback: the host had no file for this address (a route with params, such as /users/7). The app's root
// is where this file lives; go there with the address, the router puts it back without a history entry.
const root = new URL("./", import.meta.url), l = location;
if (!globalThis.__march404 && l.pathname.startsWith(root.pathname) && !/[?&]m-path=/.test(l.search)) {
  globalThis.__march404 = 1;
  l.replace(root.href + "?m-path=" + encodeURIComponent("/" + l.pathname.slice(root.pathname.length) + l.search + l.hash));
}
`;

/**
 * 404.html + march-404.js: a static host (GitHub Pages, S3, Cloudflare Pages, Netlify) serves 404.html for any address
 * without a file. With an absolute base the script path is known; with a relative build the page tries each folder
 * depth up to the deepest route (the one that exists is the app's own; the others are missing files, nothing runs).
 */
export function write404(out, { template, relBase, absBase, depth = 1 }) {
  const lang = /<html[^>]*\slang="([^"]*)"/i.exec(template)?.[1] ?? "en";
  const title = /<title>([\s\S]*?)<\/title>/i.exec(template)?.[1]?.trim() ?? "";
  const icon = /<link[^>]*rel="icon"[^>]*>/i.exec(template)?.[0] ?? "";
  const tr = lang.startsWith("tr");
  const srcs = relBase ? Array.from({ length: Math.min(depth, 8) + 2 }, (_, i) => `${i ? "../".repeat(i) : "./"}march-404.js`) : [`${absBase}march-404.js`];
  const html = `<!doctype html>\n<html lang="${escAttr(lang)}">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">` +
    `<title>${title}</title>${relBase ? "" : icon.replace(/href="\.\//, `href="${absBase}`)}${srcs.map((s) => `<script type="module" src="${s}"></script>`).join("")}</head>\n` +
    `<body><p>${tr ? "Sayfa açılıyor…" : "Opening the page…"}</p><noscript>${tr ? "Bu sayfa bulunamadı." : "This page was not found."}</noscript></body>\n</html>\n`;
  if (!existsSync(join(out, "404.html"))) writeFileSync(join(out, "404.html"), html);
  writeFileSync(join(out, "march-404.js"), NOT_FOUND_JS);
}
