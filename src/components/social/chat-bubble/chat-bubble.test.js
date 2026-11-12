import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
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
  const [a, b] = m.el.querySelectorAll(".hm-msg");
  assert.ok(a.classList.contains("hm-msg-mine") && a.classList.contains("hm-msg-last"));
  assert.equal(a.querySelector(".hm-msg-tick").getAttribute("aria-label"), "Sent");
  status.set("read");
  assert.equal(a.querySelector(".hm-msg-tick").getAttribute("aria-label"), "Read");
  assert.equal(a.querySelectorAll(".hm-msg-2tick .hm-svg").length, 2);
  assert.match(a.querySelector(".hm-msg-quote").textContent, /HADİHello\?/);
  const chip = a.querySelector(".hm-msg-react");
  assert.equal(chip.getAttribute("aria-pressed"), "true");
  chip.click();
  assert.deepEqual(reacted, ["❤️"]);
  assert.ok(a.querySelector(".hm-msg-tool[aria-label=Reply]"));
  assert.ok(b.classList.contains("is-emoji"));
  assert.ok(b.classList.contains("hm-msg-theirs"));
  assert.equal(b.querySelector(".hm-msg-sender").textContent, "Beta");
  assert.ok(b.querySelector(".hm-msg-sender").classList.contains("hm-msg-c3"));
  m.dispose();
});
