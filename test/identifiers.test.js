// Identifiers are English (code, CSS, routes, ids, file names, example code in the showcase); user-visible text may be
// in any language through i18n. tools/lint-identifiers.mjs does the work.
import { test } from "node:test";
import assert from "node:assert/strict";

const { lint, isTurkish } = await import("../tools/lint-identifiers.mjs");

test("the linter recognises Turkish identifiers", () => {
  for (const id of ["KATEGORİ_İKONLARI", "$bekleyen", "uyeler", "--hm-heyecan", "sc-b-dostluk", "/grafikler", "gelirToplam"]) assert.ok(isTurkish(id), id);
  for (const id of ["CATEGORY_ICONS", "$pending", "members", "--hm-brand-orange", "/charts", "revenueTotal", "dialog", "arrange"]) assert.ok(!isTurkish(id), id);
});

test("March and the showcase use English identifiers", () => {
  const hits = lint();
  assert.deepEqual(hits.map((h) => `${h.file}:${h.line} ${h.id}`), []);
});
