// data/components.json gives each component `added`, the day its folder first appeared (tools/cdn-data.mjs addedDates):
// sites show a "New" badge from it. From git history, following renames; the CDN workflow checks out the whole history.
import { test } from "node:test";
import assert from "node:assert/strict";
const { addedDates } = await import("../tools/cdn-data.mjs");
const { components } = await import("../tools/gen-registry.js");

test("every committed component folder has the day it first appeared", async () => {
  const days = addedDates();
  assert.ok(days.size > 0, "git history is readable");
  const today = new Date().toISOString().slice(0, 10);
  for (const c of await components()) {
    const d = days.get(c.folder);
    if (d === undefined) continue; // not committed yet: the data gives it today
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/, c.folder);
    assert.ok(d >= "2026-11-11" && d <= today, `${c.folder}: ${d}`);
  }
  assert.equal(days.get("actions/button"), "2026-11-12", "an early component keeps its first day");
});
