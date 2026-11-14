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
  const deck = el.querySelector(".m-deck");
  const slides = deck.querySelectorAll(".m-slide");
  assert.equal(slides.length, 3);
  assert.ok(slides[0].classList.contains("is-current"));
  assert.equal(slides[1].getAttribute("aria-hidden"), "true");
  assert.equal(deck.querySelector(".m-deck-count").textContent, "Slide 1 of 3");
  key(deck, "ArrowRight");
  assert.equal(idx(), 1);
  const items = slides[1].querySelectorAll(".m-appear li");
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
  assert.equal(el.querySelector(".m-deck-note").textContent, "Say hello");
  assert.equal(el.querySelector(".m-deck-preview h1").textContent, "B");
  assert.equal(el.querySelector(".m-deck-timer").getAttribute("role"), "timer");
  dispose();
});

test("Presentation: parts off, own counter, own labels and icons, coloured progress, own transition", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const seen = [];
  const dispose = render(() => [
    h(Presentation, { sync: false, counter: (i, n) => `${i + 1}/${n}`, progressColor: "brand-orange", fullscreen: false, labels: { previous: "Back", next: "Forward" }, icons: { next: h("i", { class: "mine" }) }, transition: (a, b, d) => seen.push([a.textContent, b.textContent, d]), class: "one" },
      h(Slide, {}, h("h1", {}, "A")), h(Slide, {}, h("h1", {}, "B"))),
    h(Presentation, { sync: false, controls: false, progress: false, class: "two" }, h(Slide, {}, h("h1", {}, "A"))),
    h(Presentation, { sync: false, counter: false, presenter: true, timer: false, labels: { notes: "Remarks", noNotes: "Nothing" }, class: "three" }, h(Slide, {}, h("h1", {}, "A"))),
  ], el);
  const one = el.querySelector(".one");
  assert.equal(one.querySelector(".m-deck-count").textContent, "1/2");
  assert.equal(one.querySelector(".m-deck-bar").getAttribute("data-m-color"), "brand-orange");
  assert.equal(one.querySelector(".m-deck-full"), null);
  assert.equal(one.querySelector(".m-deck-pages .m-page-prev").getAttribute("aria-label"), "Back");
  assert.equal(one.querySelector(".m-deck-pages .m-page-next").getAttribute("aria-label"), "Forward");
  assert.ok(one.querySelector(".m-deck-pages .m-page-next .mine"));
  key(one, "ArrowRight");
  assert.equal(one.querySelector(".m-deck-count").textContent, "2/2");
  assert.deepEqual(seen, [["B", "A", 1]], "the own transition gets the incoming and the outgoing slide");
  const two = el.querySelector(".two");
  assert.equal(two.querySelector(".m-deck-controls"), null);
  assert.equal(two.querySelector(".m-deck-bar"), null);
  const three = el.querySelector(".three");
  assert.equal(three.querySelector(".m-deck-count"), null);
  assert.equal(three.querySelector(".m-deck-timer"), null);
  assert.equal(three.querySelector(".m-deck-notes .m-deck-cap").textContent, "Remarks");
  assert.equal(three.querySelector(".m-deck-note").textContent, "Nothing");
  dispose();
});
