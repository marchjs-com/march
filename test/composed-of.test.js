// A component built from other components names its parts in meta.composedOf (the showcase shows them as
// "Şunlardan oluşur" with links). tools/composed-audit.mjs --fix writes the missing ones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { audit } from "../tools/composed-audit.mjs";

test("every component names the components it is built from", () => {
  assert.deepEqual(audit().map((g) => `${g.folder}: ${g.missing.join(", ")}`), []);
});
