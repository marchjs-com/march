// Component folders: the generated barrel / registry / catalogue are up to date and every folder has its full shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { generate, shapeProblems } = await import("../tools/gen-registry.js");
const { checkComponent } = await import("../cli/check-component.js");

test("gen-registry --check: generated files match the component folders", async () => {
  const { files, list } = await generate();
  for (const [rel, text] of Object.entries(files)) assert.equal(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"), text, `${rel} is stale: node tools/gen-registry.js`);
  assert.deepEqual(shapeProblems(list), []);
});

test("march check component: every folder passes its source checks", async () => {
  const { list } = await generate();
  for (const c of list) {
    const r = await checkComponent(new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"), c.folder, { runTests: false });
    assert.deepEqual(r.results.filter((x) => x.ok === false).map((x) => `${x.item}: ${x.note ?? ""}`), [], c.folder);
  }
});
