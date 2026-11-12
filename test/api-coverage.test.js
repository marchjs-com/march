// Every exported runtime API is explained in the showcase (İlk Adımlar › API başvurusu): each export of each package
// subpath has a JSDoc summary (English) and a Turkish one-line summary in docs/api.tr.json, and the language parts of
// examples/showcase/src/api.gen.ts are generated from them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { generate, strayParts, TR } = await import("../tools/api-coverage.js");

test("every package export has a JSDoc summary", () => {
  const { missing } = generate();
  assert.deepEqual(missing, [], "write a /** one-line summary */ on these declarations, then: node tools/api-coverage.js");
});

test("every package export has a Turkish summary", () => {
  const { trMissing, trStale } = generate();
  assert.deepEqual(trMissing, [], `add a one-line Turkish summary to ${TR} (under the subpath shown), then: node tools/api-coverage.js`);
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

test("the showcase API reference is up to date", () => {
  const { files } = generate();
  for (const [rel, text] of Object.entries(files)) assert.equal(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"), text, `${rel} is stale: node tools/api-coverage.js`);
  assert.deepEqual(strayParts(files), [], "old data parts: node tools/api-coverage.js");
});

test("the reference loads one language only and falls back to English", () => {
  const { files } = generate();
  const head = files["examples/showcase/src/api.gen.ts"];
  assert.match(head, /parts\[lang as ApiLang\] \?\? parts\.en/);
  assert.ok(Object.keys(files).some((f) => /api\.gen\.tr\.\d+\.ts$/.test(f)) && Object.keys(files).some((f) => /api\.gen\.en\.\d+\.ts$/.test(f)));
});
