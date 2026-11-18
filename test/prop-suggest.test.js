// MarchIDE's code editor: inside a component's tag its own props are offered with their types and texts, the ones
// already written left out, each written the way its type wants; resting the pointer on a prop's name finds it.
import { test } from "node:test";
import assert from "node:assert/strict";
const { tagAt, valueAt, typeWords, writtenProps, insertOf, propAt, docOf, componentAt, shortType, firstSentence } = await import("../examples/showcase/src/playground/prop-suggest.ts");

test("tagAt: the caret's component tag, the word being typed; none outside a tag or in a lowercase one", () => {
  assert.deepEqual(tagAt(`<Row>\n  <Button variant="primary" lo`), { comp: "Button", word: "lo", tag: `<Button variant="primary" lo` });
  assert.equal(tagAt(`<Button icon={plus}>Add</Button> x`), null);
  assert.equal(tagAt(`<div cla`), null);
  assert.equal(tagAt(`<Button`)?.comp, undefined);
  // inside a quoted value: a value is being written (an apostrophe inside the other quotes does not count)
  assert.equal(tagAt(`<Button variant="pri`), null);
  assert.equal(tagAt(`<Button title="it's" lo`)?.word, "lo");
});

test("writtenProps: the props of the tag on both sides of the caret", () => {
  const value = `<Button variant="ghost"  icon={heart} pressed>Go</Button>`;
  const caret = value.indexOf("  ") + 1;
  const t = tagAt(value.slice(0, caret));
  assert.deepEqual([...writtenProps(t.tag, value, caret)].sort(), ["icon", "pressed", "variant"]);
});

test("insertOf: a boolean bare (through MaybeFn and its empty values), texts in quotes, functions and the rest in braces", () => {
  assert.deepEqual(insertOf({ name: "block", type: "boolean" }), {});
  assert.deepEqual(insertOf({ name: "loading", type: "MaybeFn<boolean | null | undefined>" }), {});
  assert.deepEqual(insertOf({ name: "variant", type: "MaybeFn<ButtonVariant | undefined>" }), { insert: `variant=""`, back: 1 });
  assert.deepEqual(insertOf({ name: "type", type: `"button" | "submit" | "reset"` }), { insert: `type=""`, back: 1 });
  assert.deepEqual(insertOf({ name: "icon", type: "unknown" }), { insert: "icon={}", back: 1 });
  assert.deepEqual(insertOf({ name: "onClick", type: "string" }), { insert: "onClick={}", back: 1 });
});

test("propAt: the prop name under the pointer inside a tag; not a value, not a tag name, not outside", () => {
  const v = `<Button variant="primary" block>Send</Button>`;
  assert.deepEqual(propAt(v, v.indexOf("variant") + 3), { comp: "Button", name: "variant" });
  assert.deepEqual(propAt(v, v.indexOf("block") + 5), { comp: "Button", name: "block" });
  assert.equal(propAt(v, v.indexOf("primary") + 2), null);
  assert.equal(propAt(v, v.indexOf("Send") + 1), null);
});

test("docOf: name and type on the first line, then the text", () => {
  assert.deepEqual(docOf({ name: "size", type: `"sm" | "md"`, doc: "How big." }), { kind: "property", signature: `size: "sm" | "md"`, doc: "How big." });
  assert.deepEqual(docOf({ name: "x" }), { kind: "property", signature: "x" });
});

test("componentAt: a capitalized name under the pointer (a tag's, an import's); not a member, not a lowercase word", () => {
  const v = `import { Button } from "march/ui"
<Button variant="ghost">Go</Button>
ui.Card x.Button`;
  assert.equal(componentAt(v, v.indexOf("Button") + 2), "Button");
  assert.equal(componentAt(v, v.indexOf("<Button") + 3), "Button");
  assert.equal(componentAt(v, v.indexOf("</Button") + 4), "Button");
  assert.equal(componentAt(v, v.indexOf("variant") + 2), null);
  assert.equal(componentAt(v, v.indexOf("ui.Card") + 4), null);
});

test("shortType and firstSentence: a list row's type without its wrapper, cut; the text's first sentence", () => {
  assert.equal(shortType("MaybeFn<boolean | null | undefined>"), "boolean");
  assert.equal(shortType(`"a" | "b" | "c" | "d" | "e" | "f" | "g" | "h"`, 12), `"a" | "b" |…`);
  assert.equal(firstSentence("Görünüm: primary ya da link. Varsayılan secondary."), "Görünüm: primary ya da link.");
  assert.equal(firstSentence("v1.2 sürümü ile gelir"), "v1.2 sürümü ile gelir");
});

test("valueAt: the prop whose quoted value the caret is in, what is typed; not after the value is closed", () => {
  assert.deepEqual(valueAt(`<Row>
<Button variant="gh`), { comp: "Button", prop: "variant", typed: "gh" });
  assert.deepEqual(valueAt(`<Button size="sm" m:color='`), { comp: "Button", prop: "m:color", typed: "" });
  assert.equal(valueAt(`<Button variant="ghost" `), null);
  assert.equal(valueAt(`<div class="a`), null);
  assert.equal(valueAt(`<Button onClick={() => go("x`), null, "inside braces: code, not a prop's value");
});

test("typeWords and write: a type's words; an option says how it is written", () => {
  assert.deepEqual(typeWords(`MaybeFn<"sm" | "md" | "lg" | undefined>`), ["sm", "md", "lg"]);
  assert.deepEqual(typeWords("string"), []);
  assert.deepEqual(insertOf({ name: "m:reveal", write: "bare" }), {});
  assert.deepEqual(insertOf({ name: "icon", write: "code" }), { insert: "icon={}", back: 1 });
  assert.deepEqual(insertOf({ name: "variant", type: "ButtonVariant", values: ["primary"] }), { insert: `variant=""`, back: 1 });
});

test("writtenProps: an unclosed tag stops at the next tag (its props are not this one's)", () => {
  const value = `<Row>\n  <Button \n  <Button variant="ghost" sx={{ p: 2 }} on:click|prevent={go}>Go</Button>\n</Row>`;
  const caret = value.indexOf("<Button ") + "<Button ".length;
  const t = tagAt(value.slice(0, caret));
  assert.deepEqual([...writtenProps(t.tag, value, caret)], []);
  const c2 = value.indexOf(">Go");
  assert.deepEqual([...writtenProps(value.slice(value.lastIndexOf("<Button"), c2 - 1), value, c2 - 1)].sort(), ["on:click", "sx", "variant"]);
});

test("codeAt / importedFrom: an icon prop's braces; the names a module gives", async () => {
  const { codeAt, importedFrom } = await import("../examples/showcase/src/playground/prop-suggest.ts");
  assert.deepEqual(codeAt(`<Button variant="x" icon={he`), { comp: "Button", prop: "icon", typed: "he" });
  assert.deepEqual(codeAt(`<Button icon={`), { comp: "Button", prop: "icon", typed: "" });
  assert.equal(codeAt(`<Button icon={a ? b`), null);
  assert.equal(codeAt(`const x = {`), null);
  assert.deepEqual(importedFrom(`import { plus, heart as like } from "march/icons"\nimport { Button } from "march/ui"`, "march/icons"), ["plus", "like"]);
});
