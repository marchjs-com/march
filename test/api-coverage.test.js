// Every exported runtime API is explained in the showcase (İlk Adımlar › API başvurusu): each export of each package
// subpath has a JSDoc summary, and examples/showcase/src/api.gen.ts is generated from them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { generate } = await import("../tools/api-coverage.js");

test("every package export has a JSDoc summary", () => {
  const { missing } = generate();
  assert.deepEqual(missing, [], "write a /** one-line summary */ on these declarations, then: node tools/api-coverage.js");
});

test("the showcase API reference is up to date", () => {
  const { files } = generate();
  for (const [rel, text] of Object.entries(files)) assert.equal(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"), text, `${rel} is stale: node tools/api-coverage.js`);
});
