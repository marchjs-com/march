import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { Window } = await import("./index.ts");

const mount = (props) => {
  const host = document.createElement("div"); document.body.appendChild(host);
  let api; const dispose = render(() => h(Window, { title: "Notlar", ...props, ref: (a) => { api = a; } }, h("p", {}, "içerik")), host);
  return { host, api, dispose, win: host.querySelector(".m-win") };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

test("Window: titled section, three buttons, chrome class; fill, fold and restore by buttons and keys", async () => {
  const changes = [];
  const { host, win, api, dispose } = mount({ chrome: "mac", onStateChange: (s) => changes.push(s) });
  await tick();
  assert.equal(win.tagName.toLowerCase(), "section");
  assert.equal(host.querySelector(`#${win.getAttribute("aria-labelledby")}`).textContent, "Notlar");
  assert.match(win.getAttribute("class"), /m-win-mac/);
  assert.match(win.getAttribute("class"), /is-normal/);
  const btn = (cls) => host.querySelector(`.${cls}`);
  assert.equal(btn("m-win-max").getAttribute("aria-label"), "Fill the area");
  btn("m-win-max").click();
  assert.match(win.getAttribute("class"), /is-maximized/);
  assert.equal(btn("m-win-max").getAttribute("aria-label"), "Restore");
  const bar = host.querySelector(".m-win-bar");
  bar.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.match(win.getAttribute("class"), /is-normal/);
  btn("m-win-min").click();
  assert.match(win.getAttribute("class"), /is-minimized/);
  assert.equal(host.querySelector(".m-win-body").hasAttribute("hidden"), true, "a folded window shows only its title bar");
  api.set("start");
  assert.match(win.getAttribute("class"), /is-start/);
  assert.deepEqual(changes, ["maximized", "normal", "minimized", "start"]);
  dispose();
});

test("Window: arrows move it, Shift and arrows resize it; close hides it or follows `open`", async () => {
  const { host, win, dispose } = mount({ x: 10, y: 20, width: 300, height: 200 });
  await tick();
  const bar = host.querySelector(".m-win-bar");
  const px = (k) => parseFloat(win.style.getPropertyValue(k));
  const x0 = px("--m-win-x"), w0 = px("--m-win-w");
  bar.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(px("--m-win-x"), x0 + 16);
  bar.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }));
  assert.equal(px("--m-win-w"), w0 + 16);
  host.querySelector(".m-win-close").click();
  assert.equal(win.hasAttribute("hidden"), true);
  dispose();

  const open = signal(true);
  let closed = 0;
  const m = mount({ open, onClose: () => { closed++; open.set(false); } });
  m.host.querySelector(".m-win-close").click();
  assert.equal(closed, 1);
  assert.equal(m.win.hasAttribute("hidden"), true);
  open.set(true);
  assert.equal(m.win.hasAttribute("hidden"), false);
  m.dispose();
});

test("Window: your own labels and button icons, colour token, stripe and transition off", async () => {
  const { host, win, dispose } = mount({ labels: { close: "Shut", maximize: "Grow", restore: "Back", move: "Drag me" }, icons: { close: "X", restore: h("i", {}, "r") },
    color: "brand-orange", stripe: false, animated: false });
  await tick();
  const btn = (cls) => host.querySelector(`.${cls}`);
  assert.equal(btn("m-win-close").getAttribute("aria-label"), "Shut");
  assert.equal(btn("m-win-close").textContent, "X");
  assert.equal(btn("m-win-max").getAttribute("aria-label"), "Grow");
  assert.ok(btn("m-win-max").querySelector(".m-svg"), "no own icon given: the built-in glyph");
  assert.equal(btn("m-win-min").getAttribute("aria-label"), "Minimize");
  btn("m-win-max").click();
  assert.equal(btn("m-win-max").getAttribute("aria-label"), "Back");
  assert.equal(btn("m-win-max").textContent, "r");
  const bar = host.querySelector(".m-win-bar");
  assert.equal(bar.getAttribute("aria-label"), "Drag me");
  assert.equal(bar.getAttribute("data-m-color"), "brand-orange");
  assert.equal(host.querySelector(".m-win-snap").getAttribute("data-m-color"), "brand-orange");
  assert.match(win.getAttribute("class"), /m-win-no-stripe/);
  assert.match(win.getAttribute("class"), /is-static/);
  dispose();
  const d = mount({});
  assert.doesNotMatch(d.win.getAttribute("class"), /no-stripe|is-static/);
  assert.equal(d.host.querySelector(".m-win-bar").hasAttribute("data-m-color"), false);
  d.dispose();
});
