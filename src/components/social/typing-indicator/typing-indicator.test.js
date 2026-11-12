import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const { TypingIndicator, typingText } = await import("./index.ts");

test("TypingIndicator: polite status, sentence, hides when nobody types", () => {
  const names = signal(["Acme"]);
  const m = mount(() => h(TypingIndicator, { names }));
  const el = m.el.querySelector(".hm-typing");
  assert.equal(el.getAttribute("role"), "status");
  assert.equal(el.querySelector(".hm-typing-text").textContent, "Acme is typing…");
  assert.ok(el.querySelector(".hm-typing-text").classList.contains("hm-sr-only"), "bubble: the sentence is for screen readers");
  names.set(["Acme", "Beta"]);
  assert.equal(el.querySelector(".hm-typing-text").textContent, "Acme and Beta are typing…");
  names.set([]);
  assert.ok(el.classList.contains("is-off"));
  assert.equal(typingText(["a", "b", "c"]), "3 people are typing…");
  m.dispose();
});
