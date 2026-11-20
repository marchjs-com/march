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

test("iconRows: the file's icons, March's, every pack's (a taken name renamed), defineIcon; a pack shows PACK_ROWS at most", async () => {
  const { iconRows, PACK_ROWS } = await import("../examples/showcase/src/playground/prop-helpers.ts");
  const value = `import { plus } from "march/icons"\nimport { star } from "march/icons/lucide"\n`;
  const packs = [{ id: "lucide", label: "Lucide", icons: ["heart", "heartCrack", "star"] }, { id: "material-symbols", label: "Material Symbols", icons: Array.from({ length: 200 }, (_, i) => `h${i}`) }];
  const rows = iconRows("icon", "he", value, ["plus", "heart"], packs);
  const lucide = rows.filter((r) => r.group === "Lucide");
  assert.deepEqual(lucide.map((r) => r.label), ["heart", "heartCrack"]);
  assert.equal(lucide[0].insert, "lucideHeart", "March has heart: the pack's comes in renamed");
  assert.equal(lucide[0].head, `import { heart as lucideHeart } from "march/icons/lucide"`);
  assert.equal(lucide[1].head, `import { heartCrack } from "march/icons/lucide"`);
  assert.deepEqual(rows.filter((r) => r.group === "March").map((r) => r.label), ["heart"]);
  const all = iconRows("icon", "", value, ["plus", "heart"], packs);
  assert.deepEqual(all.filter((r) => r.group === "Bu dosyada").map((r) => r.label), ["plus", "star"], "both modules' imports");
  assert.equal(all.filter((r) => r.group === "Material Symbols").length, PACK_ROWS);
  assert.equal(all.at(-1).label, "defineIcon");
});

test("iconNameRows: March's names bare, packs' as pack:name; \"lucide:\" narrows to Lucide", async () => {
  const { iconNameRows } = await import("../examples/showcase/src/playground/prop-helpers.ts");
  const sets = [{ id: "march", label: "March", names: ["heart", "home"] }, { id: "lucide", label: "Lucide", names: ["heart", "heart-crack", "house"] }, { id: "tabler", label: "Tabler Icons", names: ["heart"] }];
  assert.deepEqual(iconNameRows("icon", "hea", sets).map((r) => r.label), ["heart", "lucide:heart", "lucide:heart-crack", "tabler:heart"]);
  assert.deepEqual(iconNameRows("icon", "lucide:h", sets).map((r) => r.label), ["lucide:heart", "lucide:heart-crack", "lucide:house"]);
  assert.deepEqual(iconNameRows("icon", "march:ho", sets).map((r) => r.label), ["home"]);
});

test("tagPlace: an HTML element's prop braces (sx on a <div>) are a place too; its props, generics and comparisons are not", () => {
  const p = tagPlace(`export function A() {\n  return <div sx={{ te`);
  assert.equal(p?.at, "code");
  assert.equal(p?.comp, "div");
  assert.equal(p?.prop, "sx");
  assert.equal(tagPlace(`return <div cla`), null, "between an element's props the language service answers");
  assert.equal(tagPlace(`const xs: Array<string> = [`), null);
  assert.equal(tagPlace(`if (i<n && `), null);
  assert.equal(tagPlace(`return <Button sx={{ gap: 2, te`)?.comp, "Button", "components as before");
});
