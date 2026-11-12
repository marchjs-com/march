// Every exported runtime API is explained in the showcase API page (#/api): each export of each package subpath has a
// JSDoc summary (English) and a one-line Turkish summary in docs/api.tr.json (tools/api-coverage.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { generate, TR } = await import("../tools/api-coverage.js");

test("every package export has a JSDoc summary", () => {
  const { missing } = generate();
  assert.deepEqual(missing, [], "write a /** one-line summary */ on these declarations");
});

test("every package export has a Turkish summary", () => {
  const { trMissing, trStale } = generate();
  assert.deepEqual(trMissing, [], `add a one-line Turkish summary to ${TR} (under the subpath shown)`);
  assert.deepEqual(trStale, [], `${TR} lists names that are not exported under that subpath: remove or move them`);
});

test("Turkish summaries are complete one-liners that keep code names", () => {
  const tr = JSON.parse(readFileSync(new URL(`../${TR}`, import.meta.url), "utf8"));
  const bad = [];
  for (const [sub, names] of Object.entries(tr)) for (const [name, text] of Object.entries(names)) {
    if (typeof text !== "string" || !text.trim() || text.includes("\n") || / …$/.test(text) || text.length > 260) bad.push(`${sub} › ${name}`);
  }
  assert.deepEqual(bad, []);
});
