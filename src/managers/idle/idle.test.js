// IdleManager: timeout, activity, pause / resume, listeners, events, dispose.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { idle, configureIdle, disposeIdle } = await import("./index.ts");
const { setManagerEmit } = await import("../manager.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("goes idle after the timeout; activity wakes it and calls onActive", async () => {
  const events = [];
  const prev = setManagerEmit((e) => events.push(`${e.manager}:${e.type}`));
  configureIdle({ timeout: 40, throttle: 0 });
  const i = idle();
  let idles = 0, actives = 0, acts = 0;
  i.onIdle(() => idles++); i.onActive(() => actives++); i.onActivity(() => acts++);
  assert.equal(i.idle(), false);
  assert.ok(i.remaining() > 0 && i.remaining() <= 40);
  await tick(70);
  assert.equal(i.idle(), true);
  assert.equal(i.remaining(), 0);
  document.dispatchEvent(new Event("keydown"));
  assert.equal(i.idle(), false);
  assert.deepEqual([idles, actives, acts], [1, 1, 1]);
  assert.deepEqual(events.filter((e) => e.startsWith("idle:")), ["idle:start", "idle:idle", "idle:active"]);
  setManagerEmit(prev);
  disposeIdle();
});

test("pause holds the timer; resume restarts it; reset counts as activity", async () => {
  configureIdle({ timeout: 30, throttle: 0 });
  const i = idle();
  i.pause();
  assert.equal(i.paused(), true);
  await tick(50);
  assert.equal(i.idle(), false, "paused never goes idle");
  i.resume();
  await tick(50);
  assert.equal(i.idle(), true);
  i.reset();
  assert.equal(i.idle(), false);
  disposeIdle();
});

test("dispose removes the listeners; hiddenIsIdle", async () => {
  configureIdle({ timeout: 10_000, hiddenIsIdle: true, throttle: 0 });
  const i = idle();
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(i.idle(), true, "a hidden tab is idle at once");
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(i.idle(), false);
  let acts = 0;
  i.onActivity(() => acts++);
  disposeIdle();
  document.dispatchEvent(new Event("pointerdown"));
  assert.equal(acts, 0);
  configureIdle({ timeout: 60_000, hiddenIsIdle: false, throttle: 250 });
  disposeIdle();
});
