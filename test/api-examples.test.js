// Every runtime export has a working example in the showcase API reference (İlk Adımlar › API başvurusu), written in
// examples/showcase/src/api-examples/<group>.tsx; subpaths still being written are listed in PENDING (tools/api-examples.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { generate, straySigs } = await import("../tools/api-examples.js");

test("every export of a finished subpath has an example", () => {
  const { missing } = generate();
  assert.deepEqual(missing, [], "add an example to examples/showcase/src/api-examples/<group>.tsx, then: node tools/api-examples.js");
});

test("example files name real exports, once each, and PENDING only lists unfinished subpaths", () => {
  const { problems, done } = generate();
  assert.deepEqual(problems, []);
  assert.deepEqual(done, [], "these subpaths have every example: remove them from PENDING in tools/api-examples.js");
});

test("the example index and the signature files are up to date", () => {
  const { files } = generate();
  for (const [rel, text] of Object.entries(files)) assert.equal(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"), text, `${rel} is stale: node tools/api-examples.js`);
  assert.deepEqual(straySigs(files), []);
});

test("examples load lazily: nothing at start-up, one import() per example file", () => {
  const index = readFileSync(new URL("../examples/showcase/src/api-examples.gen.ts", import.meta.url), "utf8");
  assert.doesNotMatch(index, /^import (?!type)/m, "the index imports no example statically");
  const main = readFileSync(new URL("../examples/showcase/src/main.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(main, /api-examples/);
});
