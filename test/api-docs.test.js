// The API reference data (api/index.<lang>.json and api/docs-<n>.json, published with each version on
// cdn.marchjs.com), generated from the TypeScript sources by tools/api-docs.js. Subpaths still being written (PENDING
// in tools/api-docs.js) are not held to the member-doc rule yet.
import { test } from "node:test";
import assert from "node:assert/strict";
const { generate, PENDING } = await import("../tools/api-docs.js");
const g = generate();
const open = (list) => list.filter((m) => !PENDING.has(m.split(" › ")[0]));

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
