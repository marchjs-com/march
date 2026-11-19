import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const E = await import("./engine.ts");
const { NetworkThrottle, formatSpeed, throttleLabel } = await import("./index.ts");

const fakeFetch = async () => new Response("x".repeat(20_000), { status: 200 });

test("throttledFetch: latency and bandwidth slow a request; offline fails it; the request is logged", async () => {
  E.clearThrottleRequests();
  E.setThrottle({ latency: 60, down: 800 });   // 20 kB at 800 kb/s ≈ 200 ms
  const t0 = performance.now();
  const r = await E.throttledFetch(fakeFetch, "http://localhost/data.json");
  assert.equal((await r.text()).length, 20_000);
  const took = performance.now() - t0;
  assert.ok(took >= 230, `slowed (${Math.round(took)} ms)`);
  const rec = E.throttleRequests().at(-1);
  assert.equal(rec.url, "http://localhost/data.json");
  assert.equal(rec.bytes, 20_000);
  assert.ok(rec.end >= rec.first && rec.first >= rec.start);
  E.setThrottle({ offline: true });
  await assert.rejects(E.throttledFetch(fakeFetch, "http://localhost/x"), TypeError);
  assert.equal(E.throttleRequests().at(-1).error, true);
  E.setThrottle(null);
});

test("installThrottle: only the scope's calls are slowed; uninstall restores fetch", async () => {
  const before = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  const off = E.installThrottle();
  E.setThrottle({ latency: 150 });
  E.setThrottleScope((stack) => stack.includes("previewCode"));
  let t0 = performance.now();
  await fetch("http://localhost/page");
  assert.ok(performance.now() - t0 < 100, "the page is not slowed");
  t0 = performance.now();
  await (function previewCode() { return fetch("http://localhost/preview"); })();
  assert.ok(performance.now() - t0 >= 140, "the preview is");
  t0 = performance.now();
  await E.throttleBypass(function previewCode() { return fetch("http://localhost/tool"); });
  assert.ok(performance.now() - t0 < 100, "a bypassed load is not");
  off();
  assert.equal(globalThis.fetch, fakeFetch);
  globalThis.fetch = before;
  E.setThrottle(null); E.setThrottleScope(null);
});

test("throttledLoad: a lazy chunk waits as a request would", async () => {
  E.setThrottle({ latency: 120 });
  const t0 = performance.now();
  assert.equal(await E.throttledLoad(async () => 42, { key: "part" }), 42);
  assert.ok(performance.now() - t0 >= 110);
  E.setThrottle(null);
  const t1 = performance.now();
  await E.throttledLoad(async () => 1);
  assert.ok(performance.now() - t1 < 50, "no limit: no wait");
});

test("NetworkThrottle: presets set the network, the label follows, the parts can go", () => {
  E.setThrottle(null); E.clearThrottleRequests();
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(NetworkThrottle, {}), host);
  const chip = (re) => [...host.querySelectorAll(".m-nt-presets button")].find((b) => re.test(b.textContent));
  chip(/Yavaş 3G/).click();
  assert.deepEqual(E.getThrottle(), { down: 400, up: 400, latency: 2000 });
  assert.equal(throttleLabel(), "Yavaş 3G");
  chip(/Çevrimdışı|Offline/).click();
  assert.equal(E.getThrottle().offline, true);
  chip(/Kısıtsız/).click();
  assert.equal(E.throttled(), false);
  assert.equal(formatSpeed(1440), "1.4 Mb/s");
  assert.equal(formatSpeed(null), "∞");
  assert.ok(host.querySelector(".m-nt-gauge svg"), "the gauge");
  assert.ok(host.querySelector(".m-nt-log"), "the waterfall");
  dispose();
  const d2 = render(() => h(NetworkThrottle, { gauge: false, custom: false, requests: false }), host);
  assert.equal(host.querySelector(".m-nt-gauge"), null);
  assert.equal(host.querySelector(".m-nt-custom"), null);
  assert.equal(host.querySelector(".m-nt-log"), null);
  d2();
});
