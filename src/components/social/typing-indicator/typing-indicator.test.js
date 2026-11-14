import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const { TypingIndicator, typingText } = await import("./index.ts");

test("TypingIndicator: polite status, sentence, hides when nobody types", () => {
  const names = signal(["HADİ"]);
  const m = mount(() => h(TypingIndicator, { names }));
  const el = m.el.querySelector(".m-typing");
  assert.equal(el.getAttribute("role"), "status");
  assert.equal(el.querySelector(".m-typing-text").textContent, "HADİ is typing…");
  assert.ok(el.querySelector(".m-typing-text").classList.contains("m-sr-only"), "bubble: the sentence is for screen readers");
  names.set(["HADİ", "Beta"]);
  assert.equal(el.querySelector(".m-typing-text").textContent, "HADİ and Beta are typing…");
  names.set([]);
  assert.ok(el.classList.contains("is-off"));
  assert.equal(typingText(["a", "b", "c"]), "3 people are typing…");
  m.dispose();
});

test("TypingIndicator: own sentence, no dots, own dots, motion none", () => {
  const m = mount(() => [
    h(TypingIndicator, { names: ["a", "b"], label: (n) => `${n.length} writing`, dots: false, text: true, class: "mine" }),
    h(TypingIndicator, { names: ["a"], dots: h("b", { class: "own-dots" }), motion: "none" }),
    h(TypingIndicator, { names: ["a"], motion: "none" }),
  ]);
  const [a, b, c] = m.el.querySelectorAll(".m-typing");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.querySelector(".m-typing-text").textContent, "2 writing");
  assert.equal(a.querySelector(".m-typing-dots"), null);
  assert.ok(b.querySelector(".m-typing-dots.is-own .own-dots"));
  assert.equal(b.querySelectorAll(".m-typing-dots .m-status-dot").length, 0);
  assert.equal(c.querySelectorAll(".m-typing-dots .m-status-dot").length, 3);
  m.dispose();
});
