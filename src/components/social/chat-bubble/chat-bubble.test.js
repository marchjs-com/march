import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const { ChatBubble } = await import("./index.ts");

test("ChatBubble: mine/theirs, run position, ticks, reply quote, reaction chips, emoji-only", () => {
  const status = signal("sent");
  const reacted = [];
  const m = mount(() => [
    h(ChatBubble, { mine: true, text: "Hi", position: "last", status, time: new Date(2026, 0, 1, 9, 5), reply: { name: "HADİ", text: "Hello?" }, reactions: [{ emoji: "❤️", count: 2, mine: true }], onReact: (e) => reacted.push(e), onReply: () => {} }),
    h(ChatBubble, { text: "🎉", sender: "Beta", senderColor: 2 }),
  ]);
  const [a, b] = m.el.querySelectorAll(".m-msg");
  assert.ok(a.classList.contains("m-msg-mine") && a.classList.contains("m-msg-last"));
  assert.equal(a.querySelector(".m-msg-tick").getAttribute("aria-label"), "Sent");
  status.set("read");
  assert.equal(a.querySelector(".m-msg-tick").getAttribute("aria-label"), "Read");
  assert.equal(a.querySelectorAll(".m-msg-2tick .m-svg").length, 2);
  assert.match(a.querySelector(".m-msg-quote").textContent, /HADİHello\?/);
  const chip = a.querySelector(".m-msg-react");
  assert.equal(chip.getAttribute("aria-pressed"), "true");
  chip.click();
  assert.deepEqual(reacted, ["❤️"]);
  assert.ok(a.querySelector(".m-msg-tool[aria-label=Reply]"));
  assert.ok(b.classList.contains("is-emoji"));
  assert.ok(b.classList.contains("m-msg-theirs"));
  assert.equal(b.querySelector(".m-msg-sender").textContent, "Beta");
  assert.ok(b.querySelector(".m-msg-sender").classList.contains("m-msg-c3"));
  m.dispose();
});

test("ChatBubble: own texts, color, ticks off / own, time format, no hint, no tools, own icons", () => {
  const m = mount(() => [
    mProps(h(ChatBubble, { mine: true, text: "Hi", status: "read", edited: true, time: new Date(2026, 0, 1, 9, 5), formatTime: (d) => `at ${d.getHours()}`,
      labels: { read: "Seen", edited: "changed", reply: "Answer" }, ticks: (s) => h("b", { class: "own-tick" }, s), replyIcon: h("i", { class: "own-reply" }), onReply: () => {} }), { color: "brand-purple" }),
    h(ChatBubble, { mine: true, text: "Yo", status: "failed", ticks: false, replyHint: false, tools: false, labels: { retry: "Again" }, onReply: () => {}, onRetry: () => {} }),
  ]);
  const [a, b] = m.el.querySelectorAll(".m-msg");
  assert.equal(a.getAttribute("data-m-color"), "brand-purple");
  assert.equal(a.querySelector(".m-msg-tick").getAttribute("aria-label"), "Seen");
  assert.equal(a.querySelector(".m-msg-tick .own-tick").textContent, "read");
  assert.equal(a.querySelector(".m-msg-edited").textContent, "changed");
  assert.equal(a.querySelector("time").textContent, "at 9");
  assert.equal(a.querySelector(".m-msg-tool-reply").getAttribute("aria-label"), "Answer");
  assert.ok(a.querySelector(".m-msg-tool-reply .own-reply"));
  assert.ok(a.querySelector(".m-msg-hint"));
  assert.equal(b.getAttribute("data-m-color"), null);
  assert.equal(b.querySelector(".m-msg-tick"), null);
  assert.equal(b.querySelector(".m-msg-hint"), null);
  assert.equal(b.querySelector(".m-msg-tools"), null);
  assert.equal(b.querySelector(".m-msg-retry").textContent, "Again");
  m.dispose();
});
