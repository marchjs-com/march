import { test } from "node:test";
import assert from "node:assert/strict";
import { libraryKeys } from "../tools/i18n-keys.js";
import tr from "../src/i18n/tr.ts";

test("Turkish locale pack covers every library text", () => {
  const keys = libraryKeys().filter((k) => !/[\n]|^\s|\(|=>/.test(k)); // ignore matches inside comments/code samples
  const missing = keys.filter((k) => !(k in tr));
  assert.deepEqual(missing, []);
});

test("removeMessages: keys leave a locale's messages, the text shown follows, messages() puts them back", async () => {
  const { messages, removeMessages, t, setLocale } = await import("../src/i18n/index.ts");
  messages("x-test", { "a.hi": "Merhaba", "a.bye": "Hoşça kal" });
  await setLocale("x-test");
  assert.equal(t("a.hi"), "Merhaba");
  const kept = removeMessages("x-test", ["a.hi", "a.none"]);
  assert.deepEqual(kept, { "a.hi": "Merhaba" }, "only the keys that were there");
  assert.equal(t("a.hi"), "a.hi", "its text falls back to the key");
  assert.equal(t("a.bye"), "Hoşça kal", "the rest stay");
  messages("x-test", kept);
  assert.equal(t("a.hi"), "Merhaba");
  assert.deepEqual(removeMessages("nowhere", ["a"]), {}, "an unknown locale removes nothing");
});
