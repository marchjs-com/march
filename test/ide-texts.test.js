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

// founder's rule (20 Nov 2026): an example never writes the HTML version of an element March has a component for
// (<button> → Button, <input> → TextInput, <textarea> → Textarea, <select> → Select, <form> → Form, <label> → Field,
// <pre> → CodeView, <img> → Picture, <a> → Button href / Link, <table> → DataGrid), unless that element is the point
const MARCH_HAS = /<(button|input|textarea|select|form|label|pre|img|a|table)[\s>/]/;
const ON_PURPOSE = new Set([
  "editor-frame/HaikuPad.tsx", "editor-frame/SupportReply.tsx", "editor-frame/EditorFrameLab.tsx", // EditorFrame frames your own editing area
  "format-toolbar/CommentBox.tsx", // FormatToolbar over your own textarea
  "code-view/CodeViewLab.tsx", // the <button> is inside the sample source text
]);
test("ide.json examples use March components, not their HTML versions (Button, not <button>)", async () => {
  const { readdirSync, existsSync } = await import("node:fs");
  const dir = "examples/showcase/public/components";
  const found = [];
  for (const d of readdirSync(dir)) {
    const f = `${dir}/${d}/ide.json`;
    if (!existsSync(f)) continue;
    for (const s of JSON.parse(readFileSync(f, "utf8")).sources) {
      if (s.name.endsWith(".test.tsx") || ON_PURPOSE.has(`${d}/${s.name}`)) continue;
      s.code.split("\n").forEach((line, i) => { const m = MARCH_HAS.exec(line.replace(/\/\/.*$/, "")); if (m) found.push(`${d}/${s.name}:${i + 1} <${m[1]}>`); });
    }
  }
  assert.deepEqual(found, []);
});
