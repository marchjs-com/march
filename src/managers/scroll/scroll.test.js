// ScrollManager: position + direction, nested lock, save / restore (sessionStorage), scrollspy, to().
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { scroll, configureScroll, disposeScroll } = await import("./index.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const calls = [];
window.scrollTo = globalThis.scrollTo = (o) => { calls.push(o); if (typeof o.top === "number") { window.scrollY = globalThis.scrollY = o.top; } };
const setY = (y) => { window.scrollY = globalThis.scrollY = y; window.dispatchEvent(new Event("scroll")); };

test("y and direction follow scroll events", async () => {
  disposeScroll();
  const s = scroll();
  setY(0);
  assert.equal(s.y(), 0);
  assert.equal(s.direction(), "none");
  setY(300);
  await tick(20);
  assert.equal(s.y(), 300);
  assert.equal(s.direction(), "down");
  setY(100);
  await tick(20);
  assert.equal(s.direction(), "up");
});

test("lock nests and restores the root style", () => {
  const s = scroll();
  const root = document.documentElement;
  const a = s.lock(), b = s.lock();
  assert.equal(s.locked(), true);
  assert.equal(root.style.getPropertyValue("overflow"), "hidden");
  a(); a();
  assert.equal(s.locked(), true, "still one lock; a release twice counts once");
  b();
  assert.equal(s.locked(), false);
  assert.equal(root.style.getPropertyValue("overflow"), "");
});

test("save / restore by key, kept in sessionStorage", () => {
  configureScroll({ storageKey: "t.scroll" });
  setY(420);
  scroll().save("inbox");
  assert.ok(sessionStorage.getItem("t.scroll").includes("inbox"));
  disposeScroll();
  setY(0);
  assert.equal(scroll().restore("inbox"), true, "a new instance reads the stored positions");
  assert.equal(calls.at(-1).top, 420);
  assert.equal(scroll().restore("nope"), false);
});

test("scrollspy picks the last section above the line; to() leaves the offset", async () => {
  configureScroll({ offset: 50 });
  const tops = { a: 0, b: 400, c: 900 };
  for (const id of Object.keys(tops)) {
    const el = document.createElement("section");
    el.id = id;
    el.getBoundingClientRect = () => ({ top: tops[id] - globalThis.scrollY, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 });
    document.body.appendChild(el);
  }
  setY(0);
  const spy = scroll().spy(["a", "#b", document.getElementById("c")]);
  assert.equal(spy.active(), "a");
  setY(360);
  await tick(20);
  assert.equal(spy.active(), "b");
  scroll().to("c");
  assert.equal(calls.at(-1).top, 900 - 360 - 50 + 360 - 0, "element top in the page minus offset");
  spy.stop();
  disposeScroll();
});
