// Instant navigation: the URL state changes on the click, a page that is not here in 100 ms shows its skeleton in
// place of the changing level (layouts stay), the progress bar and the link spinner show after 150 ms, a newer click
// aborts the older navigation, and a guard that says no puts everything back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h, render } = await import("../src/index.ts");
const R = await import("../src/router/index.ts");
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

function app(routes, props = {}) {
  globalThis.history.replaceState(null, "", "/");
  R.createRouter({ routes });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = render(() => h("div", {}, h(R.Link, { href: "/slow", class: "to-slow" }, "slow"), h(R.Router, props)), host);
  return { host, done: () => { dispose(); host.remove(); } };
}
const page = (k) => async () => ({ default: () => h("section", { class: "pg" }, k) });
const slowPage = (k, ms) => () => new Promise((r) => setTimeout(() => r({ default: () => h("section", { class: "pg" }, k) }), ms));
const Shell = async () => ({ default: () => h("div", { class: "lay" }, h(R.Outlet, {})) });

test("path changes on the click; skeleton after 100 ms inside the kept layout; bar and link spinner after 150 ms", async () => {
  const a = app({
    "/": { load: page("home"), layouts: [Shell] },
    "/slow": { load: slowPage("slow", 260), layouts: [Shell], skeleton: () => h("div", { class: "own-skel" }) },
  }, { skeleton: () => h("div", { class: "router-skel" }) });
  await tick();
  const lay = a.host.querySelector(".lay");
  const nav = R.navigate("/slow");
  await tick(5);
  assert.equal(R.path(), "/slow", "path is the new one at once");
  assert.equal(a.host.querySelector(".pg")?.textContent, "home", "the old page stays for the first 100 ms");
  await tick(115);
  assert.ok(a.host.querySelector(".lay .own-skel"), "the route's own skeleton wins over the Router's");
  assert.equal(a.host.querySelector(".pg"), null, "the old page is gone");
  assert.equal(a.host.querySelector(".lay"), lay, "the layout stayed");
  await tick(60);
  assert.equal(a.host.querySelector(".m-nav-bar").hidden, false, "progress bar after 150 ms");
  assert.equal(a.host.querySelector(".to-slow").getAttribute("aria-busy"), "true", "spinner on the link being opened");
  await nav; await tick();
  assert.equal(a.host.querySelector(".pg")?.textContent, "slow");
  assert.equal(a.host.querySelector(".own-skel"), null);
  assert.equal(a.host.querySelector(".m-nav-bar").hidden, true, "bar hides when done");
  assert.equal(a.host.querySelector(".to-slow").getAttribute("aria-busy"), null);
  a.done();
});

test("a fast page never shows the skeleton; the Router skeleton is the fallback", async () => {
  let shown = 0;
  const a = app({ "/": { load: page("home"), layouts: [Shell] }, "/fast": { load: slowPage("fast", 30), layouts: [Shell] }, "/slow2": { load: slowPage("s2", 200), layouts: [Shell] } },
    { skeleton: () => { shown++; return h("div", { class: "router-skel" }); } });
  await tick();
  await R.navigate("/fast"); await tick(120);
  assert.equal(shown, 0, "no skeleton flash under 100 ms");
  const nav = R.navigate("/slow2"); await tick(130);
  assert.ok(a.host.querySelector(".lay .router-skel"), "Router skeleton when the route has none");
  await nav; await tick();
  a.done();
});

test("a newer navigation aborts the older one; only the last page shows", async () => {
  const a = app({ "/": { load: page("home") }, "/one": { load: slowPage("one", 120) }, "/two": { load: slowPage("two", 20) } });
  await tick();
  const first = R.navigate("/one");
  await tick(5);
  const sig = R.navigationSignal();
  assert.equal(sig.aborted, false);
  const second = R.navigate("/two");
  assert.equal(sig.aborted, true, "the first navigation's signal is aborted");
  await Promise.all([first, second]); await tick();
  assert.equal(a.host.querySelector(".pg")?.textContent, "two");
  assert.equal(R.path(), "/two");
  a.done();
});

test("a guard that says no restores the path and the page", async () => {
  const a = app({ "/": { load: page("home") }, "/locked": { load: async () => ({ default: () => h("section", { class: "pg" }, "locked"), guard: () => new Promise((r) => setTimeout(() => r(false), 130)) }) } });
  await tick();
  await R.navigate("/locked"); await tick();
  assert.equal(R.path(), "/", "path back");
  assert.equal(a.host.querySelector(".pg")?.textContent, "home", "the page that was there is back");
  a.done();
});
