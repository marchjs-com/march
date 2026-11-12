import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const { ChatThread, dayLabel } = await import("./index.ts");
const now = new Date();
const at = (min) => new Date(now.getTime() - min * 60_000);

test("ChatThread: log, runs, day separator, typing, keyed updates, reaction picker", async () => {
  const msgs = signal([
    { id: "1", senderId: "a", senderName: "Acme", text: "one", time: at(10) },
    { id: "2", senderId: "a", senderName: "Acme", text: "two", time: at(9) },
    { id: "3", mine: true, text: "three", time: at(1), status: "sent" },
  ]);
  const typing = signal([]), reacts = [];
  const m = mount(() => h(ChatThread, { messages: msgs, typing, group: true, onReact: (msg, e) => reacts.push([msg.id, e]) }));
  const log = m.el.querySelector("[role=log]");
  assert.equal(log.getAttribute("aria-label"), "Messages");
  assert.equal(log.querySelector(".hm-chat-day").textContent, "Today");
  const rows = log.querySelectorAll(".hm-chat-row");
  assert.equal(rows.length, 3);
  assert.ok(rows[0].classList.contains("is-first") && rows[1].classList.contains("is-last") && rows[2].classList.contains("is-single"));
  assert.equal(rows[0].querySelector(".hm-msg-sender").textContent, "Acme");
  assert.equal(rows[1].querySelector(".hm-msg-sender"), null, "sender only on the first of a run");
  const third = rows[2];
  msgs.set(msgs().map((x) => (x.id === "3" ? { ...x, status: "read" } : x)));
  assert.equal(log.querySelectorAll(".hm-chat-row")[2], third, "same key: the row is kept");
  assert.equal(third.querySelector(".hm-msg-tick").getAttribute("aria-label"), "Read");
  typing.set(["Acme"]);
  assert.match(log.querySelector(".hm-typing-text").textContent, /Acme is typing/);
  rows[0].querySelector(".hm-msg-tool[aria-label=React]").click();
  const pick = log.querySelector(".hm-chat-pick [role=toolbar]");
  assert.ok(pick);
  pick.querySelector("button").click();
  assert.deepEqual(reacts, [["1", "❤️"]]);
  assert.equal(log.querySelector(".hm-chat-pick"), null);
  assert.equal(dayLabel(new Date(now.getTime() - 86_400_000), now), "Yesterday");
  m.dispose();
});
