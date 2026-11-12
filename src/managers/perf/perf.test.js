// PerformanceManager: ratings, marks and measures, time() for sync / async / errors, reports, vitals from observers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { perf, disposePerf, rateVital } = await import("./index.ts");

test("ratings follow the web.dev limits", () => {
  assert.equal(rateVital("lcp", 2000), "good");
  assert.equal(rateVital("lcp", 3000), "needs-improvement");
  assert.equal(rateVital("cls", 0.3), "poor");
  assert.equal(rateVital("inp", 200), "good");
});

test("mark / measure / time and reports", async () => {
  disposePerf();
  const p = perf();
  const seen = [];
  p.onReport((m) => seen.push(m.name));
  p.mark("a");
  for (let i = 0; i < 1e5; i++);
  p.mark("b");
  assert.ok(p.measure("a→b", "a", "b") >= 0);
  assert.equal(p.time("sync", () => 42), 42);
  assert.equal(await p.time("async", async () => "ok"), "ok");
  await assert.rejects(p.time("fails", async () => { throw new Error("x"); }));
  await new Promise((r) => setTimeout(r, 0));
  const names = p.measures().map((m) => m.name);
  assert.deepEqual(names.slice(0, 4).sort(), ["a→b", "async", "fails", "sync"].sort());
  assert.equal(p.measures().find((m) => m.name === "fails").ok, false);
  assert.ok(seen.includes("sync"));
});

test("vitals come from PerformanceObserver entries", () => {
  disposePerf();
  const obs = [];
  const prev = globalThis.PerformanceObserver;
  globalThis.PerformanceObserver = class { constructor(fn) { this.fn = fn; obs.push(this); } observe(o) { this.type = o.type; } disconnect() {} static supportedEntryTypes = ["largest-contentful-paint", "layout-shift", "event", "paint"]; };
  try {
    const p = perf();
    const fire = (type, entries) => { for (const o of obs) if (o.type === type) o.fn({ getEntries: () => entries }); };
    fire("largest-contentful-paint", [{ startTime: 1200 }, { startTime: 2600 }]);
    fire("layout-shift", [{ startTime: 100, value: 0.05, hadRecentInput: false }, { startTime: 300, value: 0.08, hadRecentInput: false }, { startTime: 400, value: 1, hadRecentInput: true }]);
    fire("event", [{ interactionId: 1, duration: 90 }, { interactionId: 2, duration: 320 }, { interactionId: 0, duration: 999 }]);
    assert.deepEqual(p.vital("lcp"), { name: "lcp", value: 2600, rating: "needs-improvement" });
    assert.equal(p.vital("cls").value, 0.13);
    assert.equal(p.vital("inp").value, 320);
    assert.equal(p.vital("inp").rating, "needs-improvement");
  } finally { globalThis.PerformanceObserver = prev; disposePerf(); }
});
