import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Reveal, revealFrames } = await import("./index.ts");

test("Reveal: pending until visible, then revealed (no IntersectionObserver = at once)", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Reveal, { effect: "up" }, h("p", {}, "a"), h("p", {}, "b")), el);
  const box = el.querySelector(".m-reveal");
  assert.ok(box);
  assert.ok(box.classList.contains("is-revealed"));
  assert.ok(!box.classList.contains("is-pending"));
  assert.equal(box.children.length, 2);
  dispose();
});

test("revealFrames: start / end mirror in RTL, blur adds a filter", () => {
  assert.match(String(revealFrames("start", 20, false).from.transform), /-20px/);
  assert.match(String(revealFrames("start", 20, true).from.transform), /\(20px/);
  assert.equal(revealFrames("blur", 20, false).to.filter, "blur(0px)");
  assert.equal(revealFrames("fade", 20, false).from.transform, undefined);
});

test("Reveal: effect none hides nothing; own frames and easing are accepted", async () => {
  const { revealOnScroll } = await import("./index.ts");
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => [
    h(Reveal, { effect: "none", class: "none" }, h("p", {}, "a")),
    h(Reveal, { effect: { from: { opacity: 0, transform: "rotate(-8deg)" }, to: { opacity: 1, transform: "rotate(0deg)" } }, easing: "out", class: "own" }, h("p", {}, "b")),
  ], el);
  const none = el.querySelector(".none");
  assert.ok(none.classList.contains("is-revealed") && !none.classList.contains("is-pending"));
  assert.ok(el.querySelector(".own").classList.contains("is-revealed"));
  // "none" with a selector: the picked descendants are never hidden
  const box = document.createElement("div"); box.append(document.createElement("i"));
  revealOnScroll(box, { effect: "none", select: "i" });
  assert.ok(!box.querySelector("i").classList.contains("m-reveal-item"));
  dispose();
});
