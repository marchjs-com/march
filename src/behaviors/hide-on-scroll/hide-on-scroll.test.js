import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { scrollHider, hideOnScroll } = await import("./index.ts");

test("scrollHider: hides on the way down past `after`, shows on the way up; small moves do not flip", () => {
  const hidden = scrollHider();
  assert.equal(hidden(60), false, "near the top it shows");
  assert.equal(hidden(200), true, "down, past 120");
  assert.equal(hidden(202), true, "a jitter keeps the state");
  assert.equal(hidden(150), false, "up");
  assert.equal(hidden(152), false, "a jitter keeps the state");
  assert.equal(hidden(400), true);
  let keep = true;
  const kept = scrollHider({ after: 10, tolerance: 0, keep: () => keep });
  assert.equal(kept(100), false, "the veto keeps it shown");
  keep = false;
  assert.equal(kept(200), true);
});

test("hideOnScroll: follows a scroll box, reports changes only, shows again when stopped", () => {
  const box = document.createElement("div");
  document.body.append(box);
  const log = [];
  const scrollTo = (y) => { box.scrollTop = y; box.dispatchEvent(new Event("scroll")); };
  const stop = hideOnScroll({ source: box, onChange: (h) => log.push(h) });
  scrollTo(50); scrollTo(300); scrollTo(600); scrollTo(100);
  assert.deepEqual(log, [true, false]);
  scrollTo(500);
  stop();
  assert.deepEqual(log, [true, false, true, false]);
  scrollTo(900);
  assert.equal(log.length, 4);
});
