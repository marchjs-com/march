import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const { ChatComposer } = await import("./index.ts");

test("ChatComposer: mic when empty, send when typed, Enter sends and clears, emoji panel, reply preview", async () => {
  const sent = [], reply = signal({ name: "HADİ", text: "Where?" });
  const m = mount(() => h(ChatComposer, { onSend: (t) => sent.push(t), onVoice: () => {}, replyTo: reply, onCancelReply: () => reply.set(null) }));
  const act = m.el.querySelector(".hm-compose-act");
  assert.ok(act.classList.contains("is-mic"));
  assert.equal(act.getAttribute("aria-label"), "Record voice message");
  const ta = m.el.querySelector("textarea");
  assert.equal(ta.getAttribute("aria-label"), "Message");
  ta.value = "hello"; ta.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
  assert.ok(act.classList.contains("is-send"));
  assert.equal(act.getAttribute("aria-label"), "Send");
  ta.dispatchEvent(Object.assign(new globalThis.Event("keydown", { bubbles: true, cancelable: true }), { key: "Enter" }));
  assert.deepEqual(sent, ["hello"]);
  assert.ok(act.classList.contains("is-mic"), "cleared");
  const emoji = m.el.querySelector(".hm-compose-emoji-btn");
  emoji.click();
  assert.equal(emoji.getAttribute("aria-expanded"), "true");
  m.el.querySelector(".hm-compose-emoji button").click();
  assert.ok(act.classList.contains("is-send"), "an emoji is text");
  assert.match(m.el.querySelector(".hm-compose-reply").textContent, /Replying to HADİ/);
  m.el.querySelector(".hm-compose-reply button").click();
  assert.equal(m.el.querySelector(".hm-compose-reply"), null);
  m.dispose();
});

test("ChatComposer: own texts, icons and colors; waveform, dot and motion can be turned off", async () => {
  const mark = document.createElement("i"); mark.className = "own-send";
  const m = mount(() => h(ChatComposer, {
    onSend: () => {}, onVoice: () => {}, class: "mine", motion: false, wave: false, recordingDot: false, micColor: "brand-purple", sendColor: "brand-green", sendIcon: mark, micIcon: "REC",
    labels: { message: "Write", record: "Talk", send: "Go", emoji: "Faces", recording: "On air", replyingTo: (n) => `To ${n}` }, replyTo: { name: "HADİ", text: "x" },
  }));
  assert.ok(m.el.querySelector("form.hm-compose").classList.contains("mine"));
  const act = m.el.querySelector(".hm-compose-act");
  assert.equal(act.getAttribute("aria-label"), "Talk");
  assert.equal(act.getAttribute("data-hm-color"), "brand-purple");
  assert.equal(act.textContent, "REC");
  assert.match(m.el.querySelector(".hm-compose-reply").textContent, /To HADİ/);
  assert.equal(m.el.querySelector(".hm-compose-emoji-btn").getAttribute("aria-label"), "Faces");
  const ta = m.el.querySelector("textarea");
  assert.equal(ta.getAttribute("aria-label"), "Write");
  ta.value = "hi"; ta.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
  assert.equal(act.getAttribute("aria-label"), "Go");
  assert.equal(act.getAttribute("data-hm-color"), "brand-green");
  assert.ok(act.querySelector(".own-send"));
  ta.value = ""; ta.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
  act.click(); // record
  await wait();
  assert.match(m.el.querySelector(".hm-compose-rec").textContent, /On air/);
  assert.equal(m.el.querySelector(".hm-compose-wave"), null);
  assert.equal(m.el.querySelector(".hm-compose-dot"), null);
  m.dispose();
});

test("ChatComposer: disabled and placeholder stay live on the field", () => {
  const off = signal(false), ph = signal("Say hi");
  const m = mount(() => h(ChatComposer, { onSend() {}, disabled: off, placeholder: ph }));
  const field = m.el.querySelector("textarea");
  assert.equal(field.disabled, false);
  assert.equal(field.getAttribute("placeholder"), "Say hi");
  off.set(true); ph.set("Later");
  assert.equal(field.disabled, true);
  assert.equal(field.getAttribute("placeholder"), "Later");
  m.dispose();
});
