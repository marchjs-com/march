// Router outlets: layouts mount once and survive navigation below them, each level has its own error boundary, named
// outlets live in the URL, modal routes open over the current page and close with back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h, render, signal } = await import("../src/index.ts");
const R = await import("../src/router/index.ts");
const tick = (ms = 15) => new Promise((r) => setTimeout(r, ms));

function app(routes, opts = {}) {
  globalThis.history.replaceState(null, "", "/");
  R.createRouter({ routes, ...opts });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = render(() => h("div", { class: "shell" }, h(R.Router, {}), h(R.Outlet, { name: "modal" }), opts.outlets ? h(R.Outlet, { name: "aside" }) : null), host);
  return { host, done: () => { dispose(); host.remove(); } };
}
const page = (k) => async () => ({ default: () => h("section", { class: "pg" }, k) });

test("layouts mount once; only the level that changes is rebuilt; state in a layout survives", async () => {
  let mounts = 0, innerMounts = 0;
  const text = signal("");
  const Shell = async () => ({ default: (p) => { mounts++; return h("div", { class: "lay" }, h("input", { class: "q", value: text, onInput: (e) => text.set(e.target.value) }), h(R.Outlet, {})); } });
  const Inner = async () => ({ default: (p) => { innerMounts++; return h("div", { class: "inner" }, p.children); } });
  const a = app({
    "/": { load: page("home"), layouts: [Shell] },
    "/a": { load: page("a"), layouts: [Shell, Inner] },
    "/b": { load: page("b"), layouts: [Shell, Inner] },
    "/c": { load: page("c"), layouts: [Shell] },
    "/users/:id": { load: page("user"), layouts: [Shell] },
  });
  await tick();
  const input = a.host.querySelector(".q");
  input.value = "kept"; input.dispatchEvent(new Event("input"));
  for (const to of ["/a", "/b", "/c", "/users/1", "/users/2", "/a"]) { await R.navigate(to); await tick(); }
  assert.equal(mounts, 1, "the shell layout mounted once over 6 navigations");
  assert.equal(innerMounts, 2, "the inner layout: mounted for /a, kept for /b, mounted again after /c");
  assert.equal(a.host.querySelector(".q"), input, "the same input element");
  assert.equal(a.host.querySelector(".q").value, "kept", "typed text kept");
  assert.equal(a.host.querySelectorAll(".lay").length, 1);
  assert.equal(a.host.querySelectorAll(".pg").length, 1);
  assert.equal(a.host.querySelector(".pg").textContent, "a");
  a.done();
});

test("a failing page shows an error with retry at its own level; the layout above stays", async () => {
  let fail = true, mounts = 0;
  const Shell = async () => ({ default: () => { mounts++; return h("div", { class: "lay" }, h(R.Outlet, {})); } });
  const a = app({ "/": { load: page("home"), layouts: [Shell] }, "/bad": { load: async () => { if (fail) throw new Error("chunk failed"); return { default: () => h("section", { class: "pg" }, "ok now") }; }, layouts: [Shell] } });
  await tick();
  await R.navigate("/bad"); await tick();
  const err = a.host.querySelector(".lay .m-route-error");
  assert.ok(err, "error inside the layout");
  assert.match(err.textContent, /chunk failed/);
  fail = false;
  err.querySelector("button").click(); await tick(30);
  assert.equal(a.host.querySelector(".pg")?.textContent, "ok now", "retry loads it");
  assert.equal(mounts, 1, "the layout never re-mounted");
  a.done();
});

test("named outlet: ?~aside=/path in the URL, rendered beside the page, closed with openOutlet(name, null)", async () => {
  const a = app({ "/": page("list") }, { outlets: { aside: { "/detail/:id": async () => ({ default: (p) => h("aside", { class: "det" }, `detail ${p.params.id}`) }) } } });
  await tick();
  await R.openOutlet("aside", "/detail/7"); await tick();
  assert.equal(new URLSearchParams(globalThis.location.search).get("~aside"), "/detail/7");
  assert.equal(a.host.querySelector(".det")?.textContent, "detail 7");
  assert.equal(a.host.querySelector(".pg").textContent, "list", "the page stays");
  assert.equal(R.outletRoute("aside")?.params.id, "7");
  await R.openOutlet("aside", null); await tick();
  assert.equal(a.host.querySelector(".det"), null);
  assert.doesNotMatch(globalThis.location.search, /aside/);
  a.done();
});

test("modal route: opens over the list, back closes it, forward opens it again; a reload shows it in full", async () => {
  let listMounts = 0;
  const routes = { "/": async () => ({ default: () => { listMounts++; return h("section", { class: "pg" }, "list"); } }), "/photo/:id": async () => ({ default: (p) => h("section", { class: "pg photo" }, `photo ${p.params.id}`) }) };
  const a = app(routes);
  await tick();
  await R.navigate("/photo/3", { modal: true }); await tick();
  assert.equal(globalThis.location.pathname, "/photo/3", "the URL is the photo's");
  assert.equal(a.host.querySelector(".m-outlet[data-depth=0] .pg").textContent, "list", "the list stays behind");
  assert.equal(a.host.querySelector("[data-outlet=modal] .photo")?.textContent, "photo 3");
  globalThis.history.back(); await tick(30);
  assert.equal(a.host.querySelector("[data-outlet=modal] .photo"), null, "back closes the modal");
  assert.equal(a.host.querySelector(".pg").textContent, "list");
  globalThis.history.forward(); await tick(30);
  assert.equal(a.host.querySelector("[data-outlet=modal] .photo")?.textContent, "photo 3", "forward opens it again");
  assert.equal(listMounts, 1, "the list never re-mounted");
  a.done();
  // reload of a modal URL: full page
  globalThis.history.replaceState({ mModal: true, mBg: "/" }, "", "/photo/3");
  R.createRouter({ routes });
  const host = document.createElement("div"); document.body.appendChild(host);
  const d = render(() => [h(R.Router, {}), h(R.Outlet, { name: "modal" })], host);
  await tick();
  assert.equal(host.querySelector(".m-outlet[data-depth=0] .photo")?.textContent, "photo 3", "full page");
  assert.equal(host.querySelector("[data-outlet=modal] .photo"), null);
  d(); host.remove();
});

test("outlet children wrap a named outlet (dialog), and get close()", async () => {
  const a = app({ "/": page("list"), "/p/:id": page("p") });
  a.done();
  globalThis.history.replaceState(null, "", "/");
  R.createRouter({ routes: { "/": page("list"), "/p/:id": page("p") } });
  const host = document.createElement("div"); document.body.appendChild(host);
  let closeFn = null;
  const d = render(() => [h(R.Router, {}), h(R.Outlet, { name: "modal" }, (pg, close) => { closeFn = close; return h("div", { class: "dlg", role: "dialog" }, pg()); })], host);
  await tick();
  await R.navigate("/p/1", { modal: true }); await tick();
  assert.ok(host.querySelector(".dlg .pg"));
  closeFn(); await tick(30);
  assert.equal(host.querySelector(".dlg"), null, "close() = back");
  assert.equal(globalThis.location.pathname, "/");
  d(); host.remove();
});
