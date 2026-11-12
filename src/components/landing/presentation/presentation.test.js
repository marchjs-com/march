import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Presentation, Slide, Appear } = await import("./index.ts");

const key = (el, k) => el.dispatchEvent(Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key: k }));

test("Presentation: keys walk slides and fragments, index is controlled, only the current slide is exposed", () => {
  const idx = signal(0);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Presentation, { index: idx, setIndex: (i) => idx.set(i), sync: false, transition: "none" },
    h(Slide, { layout: "title", notes: "Hi" }, h("h1", {}, "One")),
    h(Slide, {}, h("h2", {}, "Two"), h(Appear, {}, h("li", {}, "a"), h("li", {}, "b"))),
    h(Slide, {}, h("h2", {}, "Three"))), el);
  const deck = el.querySelector(".hm-deck");
  const slides = deck.querySelectorAll(".hm-slide");
  assert.equal(slides.length, 3);
  assert.ok(slides[0].classList.contains("is-current"));
  assert.equal(slides[1].getAttribute("aria-hidden"), "true");
  assert.equal(deck.querySelector(".hm-deck-count").textContent, "Slide 1 of 3");
  key(deck, "ArrowRight");
  assert.equal(idx(), 1);
  const items = slides[1].querySelectorAll(".hm-appear li");
  assert.ok(!items[0].classList.contains("is-shown"));
  key(deck, "ArrowRight"); // first fragment
  assert.ok(items[0].classList.contains("is-shown") && !items[1].classList.contains("is-shown"));
  key(deck, " "); key(deck, "ArrowRight"); // second fragment, then slide 3
  assert.equal(idx(), 2);
  key(deck, "ArrowLeft"); // back to slide 2 with every step shown
  assert.equal(idx(), 1);
  assert.ok(items[1].classList.contains("is-shown"));
  key(deck, "Home");
  assert.equal(idx(), 0);
  idx.set(2);
  assert.ok(slides[2].classList.contains("is-current"));
  dispose();
});

test("Presentation: speaker view shows notes and the next slide", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Presentation, { presenter: true, sync: false }, h(Slide, { notes: "Say hello" }, h("h1", {}, "A")), h(Slide, {}, h("h1", {}, "B"))), el);
  assert.equal(el.querySelector(".hm-deck-note").textContent, "Say hello");
  assert.equal(el.querySelector(".hm-deck-preview h1").textContent, "B");
  assert.equal(el.querySelector(".hm-deck-timer").getAttribute("role"), "timer");
  dispose();
});
