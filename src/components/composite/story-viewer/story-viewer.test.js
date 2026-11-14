import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { StoryViewer } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const groups = [
  { id: "a", name: "HADİ", items: [{ id: "a1", src: "1.svg" }, { id: "a2", src: "2.svg" }] },
  { id: "b", name: "Beta", items: [{ id: "b1", src: "3.svg" }] },
];
const key = (el, k) => el.dispatchEvent(Object.assign(new globalThis.Event("keydown", { bubbles: true, cancelable: true }), { key: k }));

test("StoryViewer: opens at the start person, arrows move through stories and people, seen callbacks, close", async () => {
  const open = signal(true), seen = [];
  let closed = 0;
  const m = mount(() => h(StoryViewer, { open, onClose: () => { closed++; open.set(false); }, groups, start: "a", onSeen: (g, s) => seen.push(s.id), onReply: () => {} }));
  const dlg = document.querySelector(".hm-story-dlg");
  assert.ok(dlg);
  assert.equal(dlg.getAttribute("aria-label"), "Stories");
  const story = document.querySelector(".hm-story");
  assert.match(story.querySelector("[aria-live]").textContent, /HADİ: story 1 of 2/);
  key(story, "ArrowRight");
  assert.match(story.querySelector("[aria-live]").textContent, /HADİ: story 2 of 2/);
  key(story, "ArrowRight");
  assert.match(story.querySelector("[aria-live]").textContent, /Beta: story 1 of 1/);
  key(story, "ArrowLeft");
  assert.match(story.querySelector("[aria-live]").textContent, /HADİ/);
  assert.deepEqual(seen.slice(0, 3), ["a1", "a2", "b1"]);
  const pause = [...story.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Pause");
  pause.click();
  assert.equal(pause.getAttribute("aria-pressed"), "true");
  assert.ok(story.classList.contains("is-paused"));
  assert.ok(story.querySelector(".hm-story-input"), "reply field shown with onReply");
  [...story.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Close").click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(closed, 1);
  m.dispose();
});

test("StoryViewer: parts can be turned off, texts replaced, class on the dialog", () => {
  const open = signal(true);
  const m = mount(() => h(StoryViewer, { open, onClose: () => open.set(false), groups, onReply: () => {}, onLike: () => {}, class: "mine",
    progress: false, avatar: false, time: false, pauseButton: false, arrows: false,
    labels: { dialog: "Moments", close: "Leave", send: "Post", like: "Heart", reply: (g) => `Answer ${g.name}`, replyPlaceholder: (g) => `Write to ${g.name}`, status: (g, i, n) => `${g.name} ${i + 1}/${n}` } }));
  const dlg = [...document.querySelectorAll(".hm-story-dlg")].at(-1);
  assert.ok(dlg.classList.contains("mine"));
  assert.equal(dlg.getAttribute("aria-label"), "Moments");
  assert.equal(dlg.querySelector("[role=progressbar]"), null, "progress={false}");
  assert.equal(dlg.querySelector(".hm-avatar"), null);
  assert.equal(dlg.querySelector(".hm-story-time"), null);
  assert.equal(dlg.querySelector(".hm-story-pause"), null);
  assert.equal(dlg.querySelector(".hm-story-nav"), null);
  assert.equal(dlg.querySelector(".hm-story-close").getAttribute("aria-label"), "Leave");
  assert.equal(dlg.querySelector(".hm-story-send").getAttribute("aria-label"), "Post");
  assert.equal(dlg.querySelector(".hm-story-input").getAttribute("aria-label"), "Answer HADİ");
  assert.equal(dlg.querySelector(".hm-story-input").getAttribute("placeholder"), "Write to HADİ");
  assert.equal(dlg.querySelector("[aria-live=polite].hm-sr-only").textContent, "HADİ 1/2");
  m.dispose();
});
