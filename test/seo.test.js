// hadi-march/seo: head resolution, DOM writer, router integration, JSON-LD, the check, prerender helpers, hydrate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/index.ts";
import { signal, createRoot } from "../src/index.ts";
import { resolveHead, applyHead, headToHtml, jsonLdText, ld, checkHtml, installSeo, useHead, headTags, _resetSeo, _resetHead } from "../src/seo/index.ts";
import { hydrate, prerenderedFor } from "../src/seo/hydrate.ts";
import { createRouter, _resetRouter, navigate } from "../src/router/index.ts";
import { parseInto, toHtml, sitemapXml, robotsTxt } from "../compiler/prerender.js";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const metaOf = (doc, k, v) => doc.head.querySelector(`meta[${k}="${v}"]`)?.getAttribute("content");

test("resolveHead: merge order, template, og/twitter fallbacks, canonical", () => {
  const tags = resolveHead([
    { titleTemplate: "%s · Shop", og: { siteName: "Shop", image: "/og.png" }, twitter: { site: "@shop" } },
    { title: "Shoes", description: "All the shoes", canonical: true },
    { description: "Red shoes" },
  ], { site: "https://shop.example/", path: "/shoes" });
  const html = headToHtml(tags);
  assert.match(html, /<title>Shoes · Shop<\/title>/);
  assert.match(html, /name="description" content="Red shoes"/);
  assert.match(html, /property="og:title" content="Shoes"/);
  assert.match(html, /property="og:url" content="https:\/\/shop.example\/shoes"/);
  assert.match(html, /property="og:image" content="https:\/\/shop.example\/og.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:description" content="Red shoes"/);
  assert.match(html, /rel="canonical" href="https:\/\/shop.example\/shoes"/);
  // a raw (router) title is not templated
  assert.equal(resolveHead([{ titleTemplate: "%s · X" }, { titleRaw: "Done · Y" }])[0].text, "Done · Y");
  // og: false turns the card off
  assert.ok(!headToHtml(resolveHead([{ og: { title: "a" } }, { og: false }])).includes("og:"));
});

test("jsonLdText cannot close its script element", () => {
  const t = jsonLdText({ name: "</script><script>alert(1)</script>", x: "a & b" });
  assert.ok(!t.includes("<") && !t.includes(">") && !t.includes("&"));
  assert.equal(JSON.parse(t).name, "</script><script>alert(1)</script>");
  const b = ld.breadcrumbs([["Home", "/"], ["Shoes", "/shoes"]], "https://s.example");
  assert.equal(b.itemListElement[1].item, "https://s.example/shoes");
  assert.equal(ld.product({ name: "P", price: 9, currency: "EUR", availability: "InStock" }).offers.availability, "https://schema.org/InStock");
});

test("applyHead updates static tags in place, restores and removes", () => {
  const { document, cleanup } = installDom();
  _resetHead();
  try {
    parseInto(document, document.head, '<title>Static</title><meta name="description" content="static desc">');
    applyHead(resolveHead([{ title: "A", description: "first", og: { title: "A" }, jsonLd: { "@type": "Thing" } }]));
    assert.equal(document.title, "A");
    assert.equal(metaOf(document, "name", "description"), "first");
    assert.equal(document.head.querySelectorAll('meta[name="description"]').length, 1);
    assert.equal(metaOf(document, "property", "og:title"), "A");
    assert.equal(document.head.querySelector("script").textContent, '{"@type":"Thing"}');
    applyHead(resolveHead([{ title: "B" }]));
    assert.equal(document.title, "B");
    assert.equal(metaOf(document, "name", "description"), "static desc", "restored");
    assert.equal(metaOf(document, "property", "og:title"), undefined, "removed");
    assert.equal(document.head.querySelector("script"), null);
    applyHead([]);
    assert.equal(document.title, "Static");
    // scripts: false leaves JSON-LD blocks of the build alone
    parseInto(document, document.head, '<script type="application/ld+json" data-hm-head>{"a":1}</script>');
    applyHead(resolveHead([{ title: "C", jsonLd: { b: 2 } }]), { scripts: false });
    assert.deepEqual([...document.head.querySelectorAll("script")].map((x) => x.textContent), ['{"a":1}']);
  } finally { _resetHead(); cleanup(); }
});

test("useHead is reactive and leaves with its owner; routes hand their head over", async () => {
  const { document, cleanup } = installDom({ url: "http://localhost/about" });
  _resetHead();
  try {
    createRouter({ routes: {
      "/": { component: () => null, head: { title: "Home" } },
      "/about": { component: () => null, title: "About (router)", head: (to) => ({ description: `About page ${to.path}` }) },
    } });
    installSeo({ site: "https://x.example", titleTemplate: "%s · X", defaults: { og: { siteName: "X" } } });
    await tick(5);
    assert.equal(document.title, "About (router)", "router title kept, not templated");
    assert.equal(metaOf(document, "name", "description"), "About page /about");
    assert.equal(document.head.querySelector('link[rel="canonical"]').getAttribute("href"), "https://x.example/about");
    const name = signal("Ada");
    let dispose;
    createRoot((d) => { dispose = d; useHead(() => ({ title: name(), jsonLd: ld.website({ name: name(), url: "https://x.example" }) })); });
    assert.equal(document.title, "Ada · X");
    name.set("Lin");
    assert.equal(document.title, "Lin · X");
    assert.ok(headTags().some((t) => t.tag === "script" && t.text.includes("Lin")));
    dispose();
    assert.equal(document.title, "About (router)");
    await navigate("/");
    await tick(5);
    assert.equal(document.title, "Home · X");
    assert.equal(document.head.querySelector('link[rel="canonical"]').getAttribute("href"), "https://x.example/");
    assert.equal(metaOf(document, "property", "og:site_name"), "X");
  } finally { _resetSeo(); _resetRouter(); _resetHead(); cleanup(); }
});

test("hash routing gets no automatic canonical", async () => {
  const { document, cleanup } = installDom({ url: "http://localhost/#/a" });
  _resetHead();
  try {
    createRouter({ mode: "hash", routes: { "/a": { component: () => null, head: { title: "A" } } } });
    installSeo({ site: "https://x.example" });
    await tick(5);
    assert.equal(document.title, "A");
    assert.equal(document.head.querySelector('link[rel="canonical"]'), null);
  } finally { _resetSeo(); _resetRouter(); _resetHead(); cleanup(); }
});

test("checkHtml reports missing title, description, canonical, alt", () => {
  const bad = checkHtml('<html><head></head><body><img src="a.png"><h1>x</h1></body></html>');
  const rules = bad.filter((i) => i.level === "error").map((i) => i.rule).sort();
  assert.deepEqual(rules, ["canonical", "description", "img-alt", "title"]);
  const good = checkHtml('<html lang="en"><head><meta name="viewport" content="x"><title>Shoes · Shop</title><meta name="description" content="Every shoe in the shop, sorted by size, colour and price, with free returns."><link rel="canonical" href="https://s.example/shoes"></head><body><h1>Shoes</h1><img src="a.png" alt=""></body></html>');
  assert.deepEqual(good, []);
  assert.ok(!checkHtml("<title>t</title>", { canonical: false }).some((i) => i.rule === "canonical"));
  assert.ok(checkHtml('<script type="application/ld+json">{bad</script>').some((i) => i.rule === "json-ld"));
});

test("prerender helpers: parse/serialize round trip, sitemap, robots", () => {
  const { document, cleanup } = installDom();
  try {
    document.body.replaceChildren();
    parseInto(document, document.body, '<div id="app" class="a"><p>x &amp; y</p><br><img src="a.png" alt="" style="color:red"></div><script type="application/json">{"a":"<"}</script>');
    const html = document.body.childNodes.map((n) => toHtml(n)).join("");
    assert.equal(html, '<div id="app" class="a"><p>x &amp; y</p><br><img src="a.png" alt></div><script type="application/json">{"a":"<"}</script>');
    assert.match(sitemapXml("https://s.example", ["/", "/a"]), /<loc>https:\/\/s.example\/a<\/loc>/);
    assert.equal(robotsTxt({ disallow: ["/admin"], sitemap: "https://s.example/sitemap.xml" }), "User-agent: *\nDisallow: /admin\n\nSitemap: https://s.example/sitemap.xml\n");
  } finally { cleanup(); }
});

test("hydrate: renders without prerender, swaps when ready, drops stale content", async () => {
  const { document, cleanup } = installDom({ url: "http://localhost/#/b" });
  try {
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.setAttribute("data-hm-prerender", "#/");
    el.appendChild(document.createTextNode("old"));
    assert.equal(prerenderedFor(el), false);
    hydrate(() => "new", el, { ready: () => true });
    assert.equal(el.textContent, "new", "stale (another hash route): replaced at once");

    location.hash = "#/";
    const el2 = document.createElement("div");
    document.body.appendChild(el2);
    el2.setAttribute("data-hm-prerender", "#/");
    el2.appendChild(document.createTextNode("pre"));
    let ok = false;
    hydrate(() => "fresh", el2, { ready: () => ok });
    assert.equal(el2.textContent, "pre", "prerendered content stays until ready");
    ok = true;
    await tick(40);
    assert.equal(el2.textContent, "fresh");

    const el3 = document.createElement("div");
    hydrate(() => "plain", el3);
    assert.equal(el3.textContent, "plain");
  } finally { cleanup(); }
});

test("march build with seo.prerender: a page per route, head, sitemap, robots; march seo check passes", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const CLI = fileURLToPath(new URL("../cli/march.js", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "march-seo-"));
  try {
    mkdirSync(join(dir, "src/pages/users"), { recursive: true });
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    const desc = (s) => `${s}: a page of the example shop with enough words to pass the description length check.`;
    writeFileSync(join(dir, "src/pages/index.jsx"), `export const head = { title: "Home", description: ${JSON.stringify(desc("Home"))} }\nexport default function Home() { let $n = 0; setInterval(() => $n++, 1000); return <main><h1>Welcome</h1><img src="/a.png" alt="" /><button on:click={() => $n++}>{$n}</button></main> }\n`);
    writeFileSync(join(dir, "src/pages/about.jsx"), `export const head = (to) => ({ title: "About", description: ${JSON.stringify(desc("About"))} })\nexport default function About() { return <main><h1>About us</h1></main> }\n`);
    writeFileSync(join(dir, "src/pages/users/[id].jsx"), "export default function User(p) { return <h1>{p.params.id}</h1> }\n");
    writeFileSync(join(dir, "src/main.jsx"), [
      "import { installSeo } from 'hadi-march/seo'",
      "import { hydrate } from 'hadi-march/seo/hydrate'",
      "import routes from './routes.gen.js'",
      "installSeo({ site: 'https://shop.example', titleTemplate: '%s · Shop', defaults: { og: { siteName: 'Shop' } } })",
      "createRouter({ routes })",
      "hydrate(() => <Router />, document.getElementById('app'))",
    ].join("\n"));
    writeFileSync(join(dir, "march.config.js"), "export default { chunks: false, seo: { site: 'https://shop.example', prerender: true, robots: { disallow: ['/admin'] }, head: { jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Shop' } } } }\n");
    try { execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe", timeout: 120000 }); } catch (e) { assert.fail(String(e.stderr) + String(e.stdout)); }
    const home = readFileSync(join(dir, "dist/index.html"), "utf8");
    const about = readFileSync(join(dir, "dist/about/index.html"), "utf8");
    assert.match(home, /<div id="app" data-hm-prerender="\/">.*<h1>Welcome<\/h1>/s);
    assert.match(home, /<title>Home · Shop<\/title>/);
    assert.match(home, /<link data-hm-head rel="canonical" href="https:\/\/shop.example\/">/);
    assert.match(home, /<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"WebSite"/);
    assert.doesNotMatch(home, /id="hm-boot"/, "the boot placeholder is gone");
    assert.match(about, /<h1>About us<\/h1>/);
    assert.match(about, /<title>About · Shop<\/title>/);
    assert.match(about, /property="og:url" content="https:\/\/shop.example\/about"/);
    assert.match(about, /<script type="module" src="\/assets\/main-[\w-]+\.js">/);
    assert.ok(!existsSync(join(dir, "dist/users")), "routes with params stay client-side");
    const sm = readFileSync(join(dir, "dist/sitemap.xml"), "utf8");
    assert.match(sm, /<loc>https:\/\/shop.example\/<\/loc>/);
    assert.match(sm, /<loc>https:\/\/shop.example\/about<\/loc>/);
    assert.equal(readFileSync(join(dir, "dist/robots.txt"), "utf8"), "User-agent: *\nDisallow: /admin\n\nSitemap: https://shop.example/sitemap.xml\n");
    const out = execFileSync(process.execPath, [CLI, "seo", "check"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /2 page\(s\): 0 error\(s\)/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("hydrate: <html data-hm-hydrating> while the app builds off-screen; reveal skips what is already on screen", async () => {
  const { document, cleanup } = installDom({ url: "http://localhost/#/" });
  try {
    const { reveal } = await import("../src/motion/scroll.ts");
    // an observer that never fires: a revealed element stays hidden until it would scroll into view
    const IO = globalThis.IntersectionObserver;
    globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
    const el = document.createElement("div");
    document.body.appendChild(el);
    el.setAttribute("data-hm-prerender", "#/");
    el.appendChild(document.createTextNode("pre"));
    let ok = false, seen = false, card;
    hydrate(() => { seen = document.documentElement.hasAttribute("data-hm-hydrating"); card = document.createElement("p"); reveal(card); return card; }, el, { ready: () => ok });
    assert.equal(seen, true, "set while rendering");
    const hidden = (x) => /opacity/.test(x.getAttribute("style") ?? "") || x.style.getPropertyValue?.("opacity") === "0";
    assert.equal(hidden(card), false, "a revealed element is not hidden during the takeover");
    ok = true;
    await tick(40);
    assert.equal(document.documentElement.hasAttribute("data-hm-hydrating"), false, "cleared after the swap");
    const later = document.createElement("p");
    document.body.appendChild(later);
    reveal(later);
    assert.equal(hidden(later), true, "after the takeover reveal hides until visible again");
    globalThis.IntersectionObserver = IO;
  } finally { cleanup(); }
});
