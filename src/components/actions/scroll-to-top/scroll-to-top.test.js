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
  const btn = host.querySelector(".hm-to-top");
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
  assert.ok(cornerControls("bottom-end").querySelector(".hm-to-top"));
  dispose();
  assert.equal(cornerControls("bottom-end").querySelector(".hm-to-top"), null);
});

test("ScrollToTop: the page button follows the page (window or an app's scrolling main), not a box scrolling inside it", () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(ScrollToTop, { threshold: 100 }), host);
  const btn = cornerControls("bottom-end").querySelector(".hm-to-top");
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
