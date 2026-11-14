import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { ReplyQuote } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("ReplyQuote: name and text behind an orange bar, two lines kept", () => {
  const text = signal("See you at 8?");
  const [el, dispose] = mount(() => h(ReplyQuote, { name: "Deniz", text, "data-k": "1" }));
  const q = el.querySelector(".m-reply-quote");
  assert.equal(q.getAttribute("data-m-color"), "brand-orange");
  assert.equal(q.querySelector(".m-reply-quote-name").textContent, "Deniz");
  assert.equal(q.querySelector(".m-clamp-text").textContent, "See you at 8?");
  assert.ok(q.querySelector(".m-clamp-text.is-clamped"));
  assert.equal(q.querySelector("button"), null);
  assert.equal(q.getAttribute("data-k"), "1");
  text.set("Later");
  assert.equal(q.querySelector(".m-clamp-text").textContent, "Later");
  dispose();
});

test("ReplyQuote: cancel button, own icon and name, click, lines, colour, variant, bar", () => {
  const log = [];
  const [el, dispose] = mount(() => [
    mProps(h(ReplyQuote, { name: "Replying to Deniz", text: "Hi", lines: 0, onClose: () => log.push("close"), onClick: () => log.push("jump"), class: "mine" }), { color: "brand-green" }),
    h(ReplyQuote, { name: "A", text: "B", onClose: () => {}, close: "✕", closeLabel: "Drop", variant: "inverse", bar: false }),
    h(ReplyQuote, { name: "A", text: "B", onClose: () => {}, close: false }),
  ]);
  const [a, b, c] = el.querySelectorAll(".m-reply-quote");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.getAttribute("data-m-color"), "brand-green");
  assert.equal(a.querySelector(".m-clamp-text.is-clamped"), null, "lines={0} shows all");
  const [main, close] = a.querySelectorAll("button");
  assert.ok(main.classList.contains("m-reply-quote-main"));
  assert.equal(close.getAttribute("aria-label"), "Cancel reply");
  main.click(); close.click();
  assert.deepEqual(log, ["jump", "close"]);
  assert.ok(b.classList.contains("m-reply-quote-inverse") && b.classList.contains("is-barless"));
  assert.equal(b.querySelector(".m-reply-quote-close").getAttribute("aria-label"), "Drop");
  assert.equal(b.querySelector(".m-reply-quote-close").textContent, "✕");
  assert.equal(c.querySelector("button"), null, "close={false}");
  dispose();
});
