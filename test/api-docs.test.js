// The showcase API page (#/api) reads public/api/index.<lang>.json and public/api/docs-<n>.json, generated from the
// TypeScript sources by tools/api-docs.js. Subpaths still being written (PENDING in tools/api-examples.js) are not
// held to the member-doc and long-form-doc rules yet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const { generate, stray } = await import("../tools/api-docs.js");
const { PENDING } = await import("../tools/api-examples.js");
const g = generate();
const open = (list) => list.filter((m) => !PENDING.has(m.split(" › ")[0]));

test("the API page data is up to date", () => {
  for (const [rel, text] of Object.entries(g.files)) assert.equal(readFileSync(new URL(`../${rel}`, import.meta.url), "utf8"), text, `${rel} is stale: node tools/api-docs.js`);
  assert.deepEqual(stray(g.files), []);
});

test("the search index is one file per language and every doc file is worth a fetch", () => {
  const names = Object.keys(g.files);
  assert.deepEqual(names.filter((n) => /index\./.test(n)).map((n) => n.split("/").pop()).sort(), ["index.en.json", "index.tr.json"]);
  for (const n of names.filter((x) => /docs-\d+\.json$/.test(x)).slice(0, -1)) assert.ok(g.files[n].length > 40_000, `${n} is small`);
});

test("every public class member has a JSDoc summary", () => {
  assert.deepEqual(open(g.undocMembers), [], "write a /** one-line summary */ on these members");
});

test("every component prop has an English JSDoc and a Turkish `@tr` text", () => {
  assert.deepEqual(g.undocProps, [], "write /** English. @tr Türkçe. */ above these props");
});

test("every export of a finished subpath has its long-form doc (docs/api/<subpath>/<name>.md)", () => {
  assert.deepEqual(g.missingMd, [], "write docs/api/<subpath>/<name>.md (subpaths still being written: MD_PENDING in tools/api-docs.js)");
  assert.deepEqual(g.mdDone, [], "these subpaths have every doc now: remove them from MD_PENDING");
});

test("nothing of the API page is part of start-up", () => {
  const main = readFileSync(new URL("../examples/showcase/src/main.tsx", import.meta.url), "utf8");
  const routes = readFileSync(new URL("../examples/showcase/src/routes.ts", import.meta.url), "utf8");
  assert.doesNotMatch(main, /api/);
  assert.doesNotMatch(routes, /pages\/api\.tsx/);
});
