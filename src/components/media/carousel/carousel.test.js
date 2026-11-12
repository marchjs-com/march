import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Carousel } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

test("Carousel: labelled region, per-view class, labelled buttons; previous disabled at the start", async () => {
  const el = mount(() => h(Carousel, { perView: 2, label: "Features" }, [1, 2, 3, 4].map((n) => h("article", null, String(n)))));
  await tick();
  const root = el.querySelector(".hm-carousel");
  assert.equal(root.getAttribute("aria-roledescription"), "carousel");
  assert.equal(root.getAttribute("aria-label"), "Features");
  assert.ok(root.classList.contains("hm-carousel-2"));
  assert.equal(root.querySelector(".hm-carousel-track").children.length, 4);
  assert.ok(root.querySelector(".hm-carousel-prev").disabled);
  assert.equal(root.querySelector(".hm-carousel-next").getAttribute("aria-label"), "Next");
  assert.equal(root.querySelectorAll(".hm-carousel-dot").length, 3);
});
