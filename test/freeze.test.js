// Code freeze (docs/freeze.md): a frozen component's files must stay as docs/freeze.json recorded them. A new feature
// for a frozen component starts with `node tools/freeze.mjs thaw <Name> --reason "…"` (the go-ahead for new work); an approved fix
// on a frozen one ends with `node tools/freeze.mjs refresh <Name> --reason "…"`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { components, digest, readRecord } from "../tools/freeze.mjs";

const record = readRecord();
const all = components();

test("a frozen component's files are unchanged since it was frozen", () => {
  const changed = Object.entries(record.components).filter(([, e]) => digest(e.paths) !== e.hash).map(([name, e]) => `${name} (${e.paths.join(", ")})`);
  assert.deepEqual(changed, [], `Donmuş bileşen değişti: donmayı kaldır 'node tools/freeze.mjs thaw <Ad> --reason "…"' (yeni özellik) ya da 'refresh <Ad> --reason "…"' (onaylı düzeltme). docs/freeze.md`);
});

test("meta.ts `frozen` and docs/freeze.json agree", () => {
  const bad = [];
  for (const c of all) {
    const e = record.components[c.name];
    if (e && c.frozen !== e.frozen) bad.push(`${c.name}: meta.ts frozen=${c.frozen} ≠ freeze.json ${e.frozen}`);
    if (!e && c.frozen) bad.push(`${c.name}: meta.ts says frozen (${c.frozen}) but docs/freeze.json has no record`);
  }
  for (const name of Object.keys(record.components)) if (!all.some((c) => c.name === name)) bad.push(`${name}: in docs/freeze.json but no such component`);
  assert.deepEqual(bad, []);
});

test("a record names the component's own folder and every path exists", () => {
  const bad = [];
  for (const [name, e] of Object.entries(record.components)) {
    const c = all.find((x) => x.name === name);
    if (c && e.paths[0] !== c.dir) bad.push(`${name}: first path ${e.paths[0]} is not its folder ${c.dir}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.frozen)) bad.push(`${name}: date ${e.frozen}`);
  }
  assert.deepEqual(bad, []);
});
