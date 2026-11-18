import { test } from "node:test";
import assert from "node:assert/strict";
const { scanBrackets, bracketAt, wordAt, occurrences, findAll, pairAction, pairAround, tagToClose, fitPaste, applyEdits } = await import("./assist.ts");
const { tokenize } = await import("../../../ui/highlight.ts");

test("scanBrackets: depth and mates outside strings and comments; a stray one has none", () => {
  const src = `f(a[1], { b: "(" }) // )\n)`;
  const b = scanBrackets(tokenize(src, "ts"));
  assert.equal(b.depth.get(1), 0, "( at depth 0");
  assert.equal(b.depth.get(3), 1, "[ inside it");
  assert.equal(b.depth.get(8), 1, "{ inside it");
  assert.equal(b.mate.get(1), src.indexOf(") //"), "( pairs with its )");
  assert.equal(b.depth.get(src.indexOf('"(') + 1), undefined, "a bracket in a string is no bracket");
  assert.equal(b.depth.get(src.length - 1), -1, "the last ) has no mate");
  assert.deepEqual(bracketAt(b, src, 2), [1, src.indexOf(") //")], "the caret just after ( finds the pair");
});

test("wordAt, occurrences and findAll", () => {
  assert.deepEqual(wordAt("const total = 1", 8), [6, 11]);
  assert.equal(wordAt("a + 12", 5), null, "a number is no word");
  const v = "total + totals + total";
  assert.deepEqual(occurrences(v, 2, 2), [[0, 5], [17, 22]], "whole words only, from the caret's word");
  assert.deepEqual(occurrences("one two", 1, 1), [], "a word written once lights nothing");
  assert.deepEqual(occurrences("a.b a.b", 0, 3), [[0, 3], [4, 7]], "the selected text");
  assert.equal(findAll("Ab ab AB", { text: "ab" }).length, 3);
  assert.equal(findAll("Ab ab AB", { text: "ab", case: true }).length, 1);
  assert.deepEqual(findAll("cat catalog", { text: "cat", word: true }), [[0, 3]]);
  assert.deepEqual(findAll("a1 b22", { text: "\\d+", regex: true }), [[1, 2], [4, 6]]);
  assert.deepEqual(findAll("x", { text: "(", regex: true }), [], "a bad pattern finds nothing");
});

test("pairAction: pairs before nothing, wraps a selection, steps over the closer, stays single in words and strings", () => {
  assert.equal(pairAction("f", 1, 1, "(", false), "pair");
  assert.equal(pairAction("f()", 2, 2, ")", false), "over");
  assert.equal(pairAction("ab", 0, 2, '"', false), "wrap");
  assert.equal(pairAction("x", 0, 0, "(", false), null, "before a word: written alone");
  assert.equal(pairAction("it", 2, 2, "'", false), null, "it's");
  assert.equal(pairAction('"a', 2, 2, '"', true), null, "inside a string");
  assert.equal(pairAction('"a"', 2, 2, '"', true), "over", "the string's own closing quote is stepped over");
  assert.ok(pairAround("()", 1) && pairAround('""', 1) && !pairAround("(a)", 1));
});

test("tagToClose: JSX and HTML tags, not generics, comparisons or void tags", () => {
  assert.equal(tagToClose("return <div"), "div");
  assert.equal(tagToClose('<Button variant="x"'), "Button");
  assert.equal(tagToClose("Array<string"), null);
  assert.equal(tagToClose("a < b"), null);
  assert.equal(tagToClose("<br"), null);
  assert.equal(tagToClose("<Icon /"), null);
});

test("fitPaste and applyEdits", () => {
  assert.equal(fitPaste("if (x) {\n    y()\n}", "  ", true), "if (x) {\n      y()\n  }");
  assert.equal(fitPaste("a()\nb()\n", "    ", true), "a()\n    b()\n    ", "whole lines: the text after keeps its indent");
  assert.equal(fitPaste("one line", "  ", true), "one line");
  const r = applyEdits("let  a=1", [{ from: 3, to: 5, text: " " }, { from: 6, to: 7, text: " = " }], 8);
  assert.deepEqual(r, { value: "let a = 1", caret: 9 });
});

test("headEdit: a name joins the module's import line; a new module gets its own line; a present one nothing", async () => {
  const { headEdit } = await import("./assist.ts");
  const v = `import { plus, heart } from "march/icons"\nconst a = 1`;
  const e = headEdit(v, `import { trash } from "march/icons"`);
  assert.equal(v.slice(0, e.at) + e.text + v.slice(e.at), `import { plus, heart, trash } from "march/icons"\nconst a = 1`);
  assert.equal(headEdit(v, `import { heart } from "march/icons"`), null);
  assert.deepEqual(headEdit(v, `import { Button } from "march/ui"`), { at: 0, text: `import { Button } from "march/ui"\n` });
  const b = `import {} from "x"`, f = headEdit(b, `import { y } from "x"`);
  assert.equal(b.slice(0, f.at) + f.text + b.slice(f.at), `import { y } from "x"`);
});
