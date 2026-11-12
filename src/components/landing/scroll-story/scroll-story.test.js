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
