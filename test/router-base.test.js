// Router addresses under a base path: base "auto" (a <base>, the base march build wrote, the entry script's folder),
// relative link hrefs, the hash fallback where the address cannot change, old #/ links and the 404.html hand-over.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));
const B = await import("../src/base/index.ts");
const page = (k) => async () => ({ default: () => k });
const ROUTES = { "/": page("home"), "/motion": page("motion"), "/motion/svg": page("svg"), "/users/:id": page("user") };

/** A fresh document at `url`, with an entry script or a march-base meta, and a router on it. */
async function boot(url, { script, meta, mode, base } = {}) {
  const dom = installDom({ url });
  B._resetAppBase();
  if (meta) { const m = document.createElement("meta"); m.setAttribute("name", "march-base"); m.setAttribute("content", meta); document.head.appendChild(m); }
  if (script) { const s = document.createElement("script"); s.setAttribute("type", "module"); s.setAttribute("src", script); document.head.appendChild(s); }
  const R = await import("../src/router/index.ts");
  R._resetRouter();
  R.createRouter({ routes: ROUTES, ...(mode ? { mode } : {}), ...(base ? { base } : {}) });
  await tick();
  return { R, dom, done: () => { R._resetRouter(); dom.cleanup(); } };
}

test("base auto: from the entry script's folder, also on a prerendered sub-page", async () => {
  const a = await boot("http://h.test/march/motion/", { script: "../assets/main.js" });
  assert.equal(B.appBase(), "/march");
  assert.equal(a.R.path(), "/motion");
  assert.equal(B.appUrl("media/a.jpg"), "http://h.test/march/media/a.jpg", "public files resolve under the root, not the route");
  assert.equal(B.appUrl("/media/a.jpg"), "http://h.test/march/media/a.jpg", "a leading / means the app root");
  assert.equal(B.appUrl("https://x.test/a.jpg"), "https://x.test/a.jpg");
  await a.R.navigate("/motion/svg");
  assert.equal(location.pathname, "/march/motion/svg");
  assert.equal(a.R.path(), "/motion/svg");
  a.done();
});

test("base auto: the base march build wrote wins over the script; an explicit base wins over both", async () => {
  let a = await boot("http://h.test/app/users/7", { meta: "/app/", script: "/elsewhere/assets/main.js" });
  assert.equal(a.R.path(), "/users/7");
  assert.equal(a.R.params().id, "7");
  a.done();
  a = await boot("http://h.test/x/motion", { base: "/x/" });
  assert.equal(a.R.path(), "/motion");
  a.done();
});

test("hrefOf: links are relative to the current address (right under any base, also in a new tab)", async () => {
  const a = await boot("http://h.test/march/", { script: "./assets/main.js" });
  assert.equal(a.R.hrefOf("/motion"), "motion");
  assert.equal(a.R.hrefOf("/"), "./");
  await a.R.navigate("/motion/svg");
  assert.equal(a.R.hrefOf("/"), "../");
  assert.equal(a.R.hrefOf("/motion"), "../motion");
  assert.equal(a.R.hrefOf("/users/3?tab=a"), "../users/3?tab=a");
  for (const to of ["/", "/motion", "/users/3?tab=a", "/motion/svg"]) assert.equal(new URL(a.R.hrefOf(to), location.href).href, `http://h.test/march${to}`, to);
  a.done();
});

test("old hash links (#/motion) and the 404 hand-over (?hm-path=) become the normal address, no extra history entry", async () => {
  let a = await boot("http://h.test/march/#/motion/svg", { script: "./assets/main.js" });
  assert.equal(location.pathname, "/march/motion/svg");
  assert.equal(location.hash, "");
  assert.equal(a.R.path(), "/motion/svg");
  assert.equal(history._stack.length, 1);
  a.done();
  a = await boot(`http://h.test/march/?hm-path=${encodeURIComponent("/users/9?tab=b#top")}`, { script: "./assets/main.js" });
  assert.equal(`${location.pathname}${location.search}${location.hash}`, "/march/users/9?tab=b#top");
  assert.equal(a.R.params().id, "9");
  a.done();
  // an in-page anchor is not a route
  a = await boot("http://h.test/march/motion#section", { script: "./assets/main.js" });
  assert.equal(a.R.path(), "/motion");
  assert.equal(location.hash, "#section");
  a.done();
});

test("file:// : hash fallback with the same routes; a prerendered sub-page file opens as its route", async () => {
  const a = await boot("file:///D:/dist/motion/index.html", { script: "../assets/main.js" });
  assert.equal(a.R.path(), "/motion", "the route comes from the file's place under the root");
  assert.equal(a.R.hrefOf("/motion/svg"), "#/motion/svg");
  await a.R.navigate("/motion/svg");
  assert.equal(location.hash, "#/motion/svg");
  assert.equal(location.pathname, "/D:/dist/motion/index.html", "the file stays");
  assert.equal(a.R.path(), "/motion/svg");
  history.back(); await tick();
  assert.equal(a.R.path(), "/motion", "back returns to the file's own route");
  a.done();
});

test("a sandbox that refuses pushState: the first navigation falls back to hash, nothing breaks", async () => {
  const dom = installDom({ url: "https://sandbox.test/" });
  B._resetAppBase();
  const R = await import("../src/router/index.ts");
  R._resetRouter();
  const real = history.pushState.bind(history);
  history.pushState = (s, t, u) => { if (!String(u).startsWith("#")) throw new Error("SecurityError"); real(s, t, u); };
  R.createRouter({ routes: ROUTES });
  await tick();
  await R.navigate("/motion");
  assert.equal(location.hash, "#/motion");
  assert.equal(R.path(), "/motion");
  assert.equal(R.hrefOf("/motion/svg"), "#/motion/svg");
  history.back(); await tick();
  R._resetRouter(); dom.cleanup();
});

test("Link: a plain getter href (Button href=…) is called, not turned into text", async () => {
  const a = await boot("http://h.test/");
  const { h } = await import("../src/dom/h.ts");
  const el = h(a.R.Link, { href: () => "/motion", children: "go" });
  document.body.appendChild(el);
  await tick();
  assert.equal(el.getAttribute("href"), "motion", "the getter's value, relative to the current folder");
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  await tick();
  assert.equal(a.R.path(), "/motion");
  a.done();
});

test("route keep: the page stays while only its params change (pageKey without params)", async () => {
  const R = await import("../src/router/index.ts");
  const { _router } = await import("../src/router/router.ts");
  const kept = { pattern: "/api/*", keep: true }, fresh = { pattern: "/users/:id" };
  assert.equal(_router.pageKey(kept, { rest: "core/batch" }), _router.pageKey(kept, { rest: "core/computed" }));
  assert.notEqual(_router.pageKey(fresh, { id: "1" }), _router.pageKey(fresh, { id: "2" }));
  assert.ok(R);
});

test("route keep: moving between params of a kept page skips the page transition", async () => {
  const dom = installDom({ url: "http://h.test/" });
  B._resetAppBase();
  const R = await import("../src/router/index.ts");
  R._resetRouter();
  let wraps = 0;
  R.createRouter({ routes: [{ path: "/", load: page("home") }, { path: "/api/*", load: page("api"), keep: true }, { path: "/other", load: page("o") }] });
  await tick();
  R.setNavigationWrapper((apply) => { wraps++; apply(); });
  await R.navigate("/api/core/batch"); await tick();
  const first = wraps;
  await R.navigate("/api/core/computed"); await tick();
  assert.equal(wraps, first, "same kept page: no transition");
  await R.navigate("/other"); await tick();
  assert.equal(wraps, first + 1, "another page: transition");
  R._resetRouter(); dom.cleanup();
});
