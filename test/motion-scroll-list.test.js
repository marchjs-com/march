// Scroll-linked and list animation: scrollFraction (range windows, a scroll box as source), scrollTimeline seeks an
// engine Playback by scroll, scrollIndicator grows from the inline start (RTL: the end), listFrames (RTL slide,
// in / out), animateList: enter, exit ghost, FLIP move; staggerIn returns one Playback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const M = await import("../src/motion/index.ts");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const rect = (el, top, h, left = 0, w = 100) => { el.getBoundingClientRect = () => ({ top, left, height: h, width: w, bottom: top + h, right: left + w }); return el; };

test("scrollFraction: passage of an element through a scroll box, with a range window", () => {
  const box = rect(document.createElement("div"), 0, 200);
  const card = rect(document.createElement("div"), 200, 100);
  assert.equal(M.scrollFraction({ source: box, track: card }), 0, "just below the port");
  rect(card, 50, 100);
  assert.equal(M.scrollFraction({ source: box, track: card }), 0.5, "half way through");
  assert.equal(M.scrollFraction({ source: box, track: card, range: [0, 0.5] }), 1, "window [0, .5] already complete");
  const doc = rect({ scrollTop: 50, scrollHeight: 300, clientHeight: 200 }, 0, 200);
  assert.equal(M.scrollFraction({ source: doc }), 0.5, "no track: the scroll position");
});

test("scrollTimeline: a paused Playback seeked by scroll; stop cancels it", async () => {
  const box = rect(document.createElement("div"), 0, 200);
  const card = rect(document.createElement("div"), 50, 100);
  document.body.append(box);
  const tl = M.timeline();
  let seeks = 0;
  const seek = tl.seek.bind(tl);
  tl.seek = (t) => { seeks++; return seek(t); };
  const stop = M.scrollTimeline(tl, null, { source: box, track: card });
  await tick(40);
  assert.ok(seeks >= 1, "seeked on start");
  stop();
  box.remove();
});

test("listFrames: in / out, RTL mirrors slide", () => {
  assert.equal(M.listFrames("slide", "in")[0].transform, "translateX(-24px)");
  assert.equal(M.listFrames("slide", "in", true)[0].transform, "translateX(24px)");
  assert.equal(M.listFrames("pop", "out").at(-1).opacity, 0);
});

test("animateList: added children enter, removed ones leave as an inert ghost", async () => {
  // the test DOM has no MutationObserver: a stand-in that the test drives
  let fire = null;
  globalThis.MutationObserver = class { constructor(cb) { fire = cb; } observe() {} disconnect() {} };
  M.setReducedMotion(false);
  const ul = document.createElement("ul");
  document.body.append(ul);
  const a = document.createElement("li"), b = document.createElement("li");
  ul.append(a, b);
  const off = M.animateList(ul, { duration: 40 });
  const c = document.createElement("li");
  ul.append(c);
  b.remove();
  fire([{ addedNodes: [c], removedNodes: [b] }]);
  const ghost = [...ul.children].find((x) => x.getAttribute("inert") != null);
  assert.ok(ghost, "exit ghost added");
  assert.equal(ghost.getAttribute("aria-hidden"), "true");
  await tick(150);
  assert.equal([...ul.children].some((x) => x.getAttribute("inert") != null), false, "ghost removed after the exit");
  off();
  ul.remove();
  delete globalThis.MutationObserver;
  M.setReducedMotion(null);
});

test("staggerIn: one Playback over all targets", () => {
  const els = [1, 2, 3].map(() => document.createElement("div"));
  const pb = M.staggerIn(els, { each: 10, from: "center" });
  assert.ok(pb instanceof M.Playback);
  pb.cancel();
});
