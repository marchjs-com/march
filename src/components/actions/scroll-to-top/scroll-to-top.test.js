import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ScrollToTop } = await import("./index.ts");
const { cornerControls } = await import("../../layout/bottom-right-controls/index.ts");

test("ScrollToTop: hidden until the scrolled box passes the threshold; labelled; inline renders in place", () => {
  const box = document.createElement("div"); document.body.appendChild(box);
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(ScrollToTop, { inline: true, target: box, threshold: 100 }), host);
  const btn = host.querySelector(".m-to-top");
  assert.ok(btn);
  assert.equal(btn.getAttribute("aria-label"), "Back to top", "translated through t() (tr: Başa dön)");
  assert.equal(btn.getAttribute("data-shown"), "false");
  box.scrollTop = 250;
  box.dispatchEvent(new Event("scroll"));
  assert.equal(btn.getAttribute("data-shown"), "true", "shown past the threshold (scroll caught on the way down)");
  box.scrollTop = 20;
  box.dispatchEvent(new Event("scroll"));
  assert.equal(btn.getAttribute("data-shown"), "false");
  dispose();
});

test("ScrollToTop: by default it goes into the bottom-end corner and leaves with its component", () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(ScrollToTop, {}), host);
  assert.ok(cornerControls("bottom-end").querySelector(".m-to-top"));
  dispose();
  assert.equal(cornerControls("bottom-end").querySelector(".m-to-top"), null);
});

test("ScrollToTop: the page button follows the page (window or an app's scrolling main), not a box scrolling inside it", () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(ScrollToTop, { threshold: 100 }), host);
  const btn = cornerControls("bottom-end").querySelector(".m-to-top");
  const inner = document.createElement("div"); document.body.appendChild(inner);
  inner.scrollTop = 500;
  inner.dispatchEvent(new Event("scroll"));
  assert.equal(btn.getAttribute("data-shown"), "false", "a demo box scrolling inside the page is left alone");
  const main = document.createElement("main"); document.body.appendChild(main);
  main.scrollTop = 500;
  main.dispatchEvent(new Event("scroll"));
  assert.equal(btn.getAttribute("data-shown"), "true", "an app shell's scrolling main is the page");
  dispose(); inner.remove(); main.remove();
});

test("ScrollToTop: your own icon, class, colour and motion (a function, or none)", () => {
  const box = document.createElement("div"); document.body.appendChild(box);
  const host = document.createElement("div"); document.body.appendChild(host);
  const calls = [];
  const dispose = render(() => [
    h(ScrollToTop, { inline: true, target: box, threshold: 100, icon: "^", class: "mine", color: "brand-blue", label: () => "Up", motion: (el, shown) => calls.push([el, shown]) }),
    h(ScrollToTop, { inline: true, target: box, threshold: 100, motion: "none", smooth: false }),
  ], host);
  const [a, b] = host.querySelectorAll(".m-to-top");
  assert.ok(a.className.includes("mine"));
  assert.equal(a.textContent, "^");
  assert.equal(a.querySelector("svg"), null);
  assert.equal(a.getAttribute("data-m-color"), "brand-blue");
  assert.equal(a.getAttribute("aria-label"), "Up");
  assert.ok(b.querySelector("svg"), "the default arrow");
  box.scrollTop = 250;
  box.dispatchEvent(new Event("scroll"));
  assert.deepEqual(calls, [[a, true]]);
  assert.equal(b.getAttribute("data-shown"), "true");
  assert.equal(b.inert, false);
  b.click();
  assert.equal(box.scrollTop, 0, "smooth={false}: jumps at once");
  box.dispatchEvent(new Event("scroll"));
  assert.deepEqual(calls.map((c) => c[1]), [true, false]);
  dispose(); box.remove();
});
