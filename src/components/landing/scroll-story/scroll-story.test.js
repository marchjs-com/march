import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ScrollStory } = await import("./index.ts");

test("ScrollStory: steps and media, the first is active, others hidden, colour from the active step", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const steps = [{ title: "A", media: h("b", {}, "1"), color: "brand-blue" }, { title: "B", media: h("b", {}, "2") }];
  const dispose = render(() => h(ScrollStory, { steps }), el);
  const root = el.querySelector("section.hm-story");
  assert.equal(root.querySelectorAll(".hm-story-step").length, 2);
  const media = root.querySelectorAll(".hm-story-media");
  assert.ok(media[0].className.includes("is-active"));
  assert.equal(media[1].getAttribute("aria-hidden"), "true");
  assert.equal(root.getAttribute("data-hm-color"), "brand-blue");
  dispose();
});

test("ScrollStory: narrow (its own width) stacks — every picture moves into its step card, nothing is hidden", async () => {
  const { installDom } = await import("../../../testing/dom.ts");
  const { h, render } = await import("../../../index.ts");
  const { ScrollStory } = await import("./index.ts");
  const host = document.createElement("div"); document.body.appendChild(host);
  let roCb; const RO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { constructor(cb) { roCb = cb; } observe() {} disconnect() {} };
  const dispose = render(() => h(ScrollStory, { steps: [{ title: "A", media: "pa" }, { title: "B", media: "pb" }] }), host);
  const root = host.querySelector(".hm-story");
  Object.defineProperty(root, "clientWidth", { configurable: true, get: () => 390 });
  roCb([{ contentRect: { width: 390, height: 600 } }]);
  assert.ok(root.classList.contains("is-stacked"));
  const cards = root.querySelectorAll(".hm-story-step");
  assert.equal(cards[1].querySelector(".hm-story-media").textContent, "pb", "the picture is in its own card");
  assert.equal(cards[1].querySelector(".hm-story-media").getAttribute("aria-hidden"), null);
  Object.defineProperty(root, "clientWidth", { configurable: true, get: () => 1200 });
  roCb([{ contentRect: { width: 390, height: 600 } }]);
  assert.ok(!root.classList.contains("is-stacked"));
  assert.equal(root.querySelector(".hm-story-stage").children.length, 2, "wide: back in the pinned stage");
  dispose(); globalThis.ResizeObserver = RO; void installDom;
});

test("ScrollStory: no dots, no numbers / own numbers", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const steps = () => [{ title: "A", media: "1" }, { title: "B", media: "2" }];
  const dispose = render(() => [
    h(ScrollStory, { steps: steps(), class: "one", dots: false, numbers: false, transition: "none" }),
    h(ScrollStory, { steps: steps(), class: "two", numbers: (i) => `Step ${i + 1}`, transition: () => {} }),
  ], el);
  const one = el.querySelector(".one");
  assert.equal(one.querySelector(".hm-story-dots"), null);
  assert.equal(one.querySelector(".hm-story-num"), null);
  const two = el.querySelector(".two");
  assert.ok(two.querySelector(".hm-story-dots"));
  assert.deepEqual([...two.querySelectorAll(".hm-story-num")].map((n) => n.textContent), ["Step 1", "Step 2"]);
  dispose();
});
