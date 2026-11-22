// The numbers sites show about March (data/stats.json on cdn.marchjs.com, tools/cdn-data.mjs) come from their sources
// (tools/gen-home-stats.js: registry, api-coverage, icon packs, motion catalogues, managers, tests), none typed by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const { homeStats } = await import("../tools/gen-home-stats.js");

const ROOT = fileURLToPath(new URL("..", import.meta.url));

test("home stats come from their sources", async () => {
  const s = await homeStats();
  const reg = readFileSync(join(ROOT, "src/components/registry.gen.ts"), "utf8");
  assert.equal(s.registered, [...reg.matchAll(/^import m\d+ from/gm)].length, "registered = registry entries");
  assert.equal(s.categories.reduce((a, c) => a + c.components, 0), s.registered, "categories add up to the registry");
  assert.ok(s.components >= s.registered && s.exports > s.components, "api-coverage counts");
  assert.ok(s.icons.total >= s.icons.builtIn && s.icons.builtIn > 0);
  assert.ok(s.animations.text > 0 && s.animations.pageFx > 0 && s.managers > 0 && s.tests > 0);
  assert.equal(s.budget, undefined, "budgets are the site's own (its march.config.js)");
});
