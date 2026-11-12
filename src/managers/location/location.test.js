// LocationManager: locate, errors, watch / stop, consent gate, distance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
let next = { ok: { coords: { latitude: 41.0082, longitude: 28.9784, accuracy: 20, altitude: null, heading: NaN, speed: null }, timestamp: 1000 } };
let watchFn = null, cleared = 0;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
  geolocation: {
    getCurrentPosition: (ok, fail) => setTimeout(() => (next.ok ? ok(next.ok) : fail(next.err)), 1),
    watchPosition: (ok) => { watchFn = ok; return 7; },
    clearWatch: () => { cleared++; watchFn = null; },
  },
  permissions: { query: async () => Object.assign(new EventTarget(), { state: "granted" }) },
} });
const { locator, disposeLocation, distance } = await import("./index.ts");
const { configurePermissions } = await import("../permission/index.ts");
const { consent, configureConsent } = await import("../consent/index.ts");

test("locate fills position; errors set status", async () => {
  disposeLocation();
  const l = locator();
  assert.equal(l.status(), "idle");
  const p = l.locate();
  assert.equal(l.status(), "locating");
  const pos = await p;
  assert.equal(pos.lat, 41.0082);
  assert.equal(pos.heading, null);
  assert.equal(l.status(), "idle");
  assert.equal(l.position().accuracy, 20);
  next = { err: { code: 1, message: "User denied" } };
  await assert.rejects(l.locate(), /denied/);
  assert.equal(l.status(), "denied");
  assert.equal(l.error(), "User denied");
  assert.equal(l.position().lat, 41.0082, "last position kept");
});

test("watch and stop; distance", () => {
  const l = locator();
  const stop = l.watch();
  assert.equal(l.watching(), true);
  watchFn({ coords: { latitude: 39.9334, longitude: 32.8597, accuracy: 5 }, timestamp: 2 });
  assert.equal(l.position().lng, 32.8597);
  const km = l.distanceTo({ lat: 41.0082, lng: 28.9784 }) / 1000;
  assert.ok(km > 340 && km < 360, `about 350 km, got ${km}`);
  stop();
  assert.equal(l.watching(), false);
  assert.equal(cleared, 1);
  assert.equal(distance({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }), 0);
});

test("consent category blocks the request without a prompt", async () => {
  configureConsent({ storageKey: "t.loc.consent" });
  consent.rejectAll();
  configurePermissions({ consent: { geolocation: "preferences" } });
  disposeLocation();
  next = { ok: { coords: { latitude: 1, longitude: 1, accuracy: 1 }, timestamp: 1 } };
  await assert.rejects(locator().locate(), /blocked/);
  assert.equal(locator().status(), "blocked");
  locator().watch();
  assert.equal(watchFn, null, "no watch started");
  configurePermissions({ consent: {} });
  disposeLocation();
});
