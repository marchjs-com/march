// AnnouncerManager: polite / assertive regions in the layer stack, text set on the next frame, clear, dedupe, history.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { effect } = await import("../../index.ts");
const { layers } = await import("../../dom/portal.ts");
const { announce, announcer, disposeAnnouncer, configureAnnouncer } = await import("./index.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("regions are created lazily, in an fx layer, with aria-live", () => {
  disposeAnnouncer();
  const before = layers().length;
  const r = announcer.regions();
  assert.equal(layers().length, before + 1);
  assert.equal(layers().at(-1).kind, "fx");
  assert.equal(r.polite.getAttribute("aria-live"), "polite");
  assert.equal(r.assertive.getAttribute("aria-live"), "assertive");
  assert.equal(r.assertive.getAttribute("role"), "alert");
  disposeAnnouncer();
  assert.equal(layers().length, before, "dispose removes the layer");
});

test("announce sets the text a moment later and clears it later; assertive goes to its own region", async () => {
  configureAnnouncer({ clearAfter: 30, dedupeMs: 0 });
  announce("Saved");
  const r = announcer.regions();
  assert.equal(r.polite.textContent, "", "cleared first");
  await tick(60);
  assert.equal(r.polite.textContent, "Saved");
  announce("Offline", { politeness: "assertive", clearAfter: 0 });
  await tick(60);
  assert.equal(r.assertive.textContent, "Offline");
  await tick(40);
  assert.equal(r.polite.textContent, "", "cleared after clearAfter");
  assert.equal(r.assertive.textContent, "Offline", "clearAfter: 0 keeps it");
  configureAnnouncer({ clearAfter: 7000, dedupeMs: 250 });
});

test("dedupe a burst of the same text; history is newest first and reactive", () => {
  disposeAnnouncer();
  const sizes = [];
  const stop = effect(() => sizes.push(announcer.history().length));
  announce("3 results"); announce("3 results"); announce("4 results"); announce("   ");
  assert.deepEqual(announcer.history().map((a) => a.text), ["4 results", "3 results"]);
  assert.deepEqual(sizes, [0, 1, 2]);
  stop();
});
