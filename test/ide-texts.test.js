// MarchIDE: the ide.json descriptions reach the build's text extraction (tools/gen-ide-texts.js writes them as t`…`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generate, generateList, OUT, LIST } from "../tools/gen-ide-texts.js";

test("ide-texts.gen.ts is up to date with the ide.json files (node tools/gen-ide-texts.js)", () => {
  assert.equal(readFileSync(OUT, "utf8"), generate());
});

test("every ide.json description is a t`…` text of the generated module", () => {
  const out = generate();
  const button = JSON.parse(readFileSync("examples/showcase/public/components/button/ide.json", "utf8")).description;
  assert.ok(button, "Button's ide.json has a description");
  assert.ok(out.includes(`t\`${button}\``));
});

test("ide-list.gen.ts lists every component folder with an ide.json (node tools/gen-ide-texts.js)", () => {
  assert.equal(readFileSync(LIST, "utf8"), generateList());
  assert.match(generateList(), /"button"/);
});
