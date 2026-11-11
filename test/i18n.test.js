import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryKeys } from "../tools/i18n-keys.js";
import tr from "../src/i18n/tr.ts";

test("Turkish locale pack covers every library text", () => {
  const keys = libraryKeys().filter((k) => !/[\n]|^\s|\(|=>/.test(k)); // ignore matches inside comments/code samples
  const missing = keys.filter((k) => !(k in tr));
  assert.deepEqual(missing, []);
});
