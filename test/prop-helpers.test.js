import { test } from "node:test";
import assert from "node:assert/strict";
const { tagPlace, codeRows, fileNames } = await import("../examples/showcase/src/playground/prop-helpers.ts");

const own = async (c) => c === "Button"
  ? [{ name: "variant", values: ["primary", "ghost"] }, { name: "disabled", write: "bare", type: "boolean" }, { name: "icon", icon: true, write: "code" }]
  : c === "Avatar" ? [{ name: "size", values: ["sm", "lg"] }, { name: "square", type: "boolean" }] : [];
const SX = { p: [0, 8], gap: [0, 8], text: ["xs", "sm", "center"] };
const data = { own, sx: SX, components: async () => ["Avatar", "Button", "Card"] };
const labels = (r) => r.map((x) => x.label);

test("tagPlace: between props, in a quoted value, in nested braces; a closed tag is no place", () => {
  assert.deepEqual(tagPlace(`<Button sx={{ p: 2 }} va`), { at: "attr", comp: "Button", tag: `<Button sx={{ p: 2 }} va`, word: "va", props: ["sx"] });
  const q = tagPlace(`<Button variant="gh`);
  assert.equal(q.at, "quoted"); assert.equal(q.typed, "gh");
  const c = tagPlace(`<Button sx={{ p: 2, ga`);
  assert.equal(c.at, "code"); assert.equal(c.prop, "sx"); assert.equal(c.frames.length, 2); assert.deepEqual(c.frames[1].keys, ["p"]); assert.equal(c.typed, "ga");
  const v = tagPlace(`<Card m:parts={{ Avatar: { size: "l`);
  assert.equal(v.frames[1].key, "Avatar"); assert.equal(v.frames[2].key, "size"); assert.ok(v.quoted); assert.equal(v.typed, "l");
  assert.equal(tagPlace(`<Button variant="x">Go`), null);
  assert.equal(tagPlace(`<Row render={() => <Button size="sm" />} `).comp, "Row", "a tag inside a prop's braces is stepped over");
});

test("codeRows: sx keys then values; m:parts components, props, values; handlers; signals", async () => {
  const value = `import { Avatar } from "march/ui"\nlet $open = false\nconst save = () => 1\n`;
  const rows = async (before) => codeRows(tagPlace(before), value, data);
  assert.deepEqual(labels(await rows(`<Button sx={{ p: 2, `)), ["gap", "text"], "the keys not written yet");
  assert.deepEqual(labels(await rows(`<Button sx={{ text: "c`)), ["center"]);
  assert.deepEqual(labels(await rows(`<Button sx={{ gap: `)).length, 9);
  const parts = await rows(`<Card m:parts={{ `);
  assert.deepEqual(labels(parts), ["Avatar", "Button", "Card"]);
  assert.equal(parts[0].group, "Bu dosyada"); assert.equal(parts[1].head, `import { Button } from "march/ui"`);
  assert.deepEqual(labels(await rows(`<Card m:parts={{ Avatar: { `)), ["size", "square"]);
  assert.deepEqual(labels(await rows(`<Card m:parts={{ Avatar: { size: "`)), ["sm", "lg"]);
  assert.deepEqual(labels(await rows(`<Card m:parts={{ Avatar: { square: `)), ["true", "false"]);
  assert.deepEqual(labels(await rows(`<Button on:click={`)), ["() => …", "(e) => …", "() => $open = !$open", "save"]);
  assert.deepEqual(labels(await rows(`<Button disabled={`)), ["true", "false", "$open"]);
  assert.deepEqual(labels(await rows(`<Button sx={`)), ["{ … }"]);
  assert.deepEqual(fileNames(value), { signals: ["$open"], fns: ["save"] });
});
