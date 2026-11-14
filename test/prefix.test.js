// The March prefix is `m`: classes `m-btn`, CSS variables `--m-primary`, attributes `data-m-color`, keyframes
// `m-fade-in`, storage / context / event keys `m.theme`. Two rules keep it that way:
// 1. the old two-letter prefix does not come back anywhere in the repository;
// 2. `m-` is short, so no class takes a name other libraries use for margin utilities (`m-0` … `m-5`, `m-auto`, `m-px`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const files = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 }).split("\0").filter(Boolean);
const read = (f) => { try { return readFileSync(ROOT + f, "utf8"); } catch { return ""; } };
const TEXT = /\.(ts|tsx|js|mjs|cjs|jsx|css|md|json|html|svg|txt|yml|yaml)$/;

test("the old prefix is gone: classes, CSS variables, data attributes, keyframes, string keys", () => {
  const old = "h" + "m";
  // also after a regex escape in a test (`\b`, `\s` …), where the letter before it is not part of a word
  const re = new RegExp(`(?:(?<![A-Za-z0-9])|(?<=\\\\[A-Za-z]))${old}(?![a-z0-9])`);
  const hits = [];
  for (const f of files) {
    if (!TEXT.test(f)) continue;
    const m = read(f).match(re);
    if (m) hits.push(`${f}: …${m.input.slice(Math.max(0, m.index - 20), m.index + 20).replace(/\s+/g, " ")}…`);
  }
  assert.deepEqual(hits.slice(0, 20), []);
});

test("no class is named like a margin utility (m-0, m-auto, m-px)", () => {
  const re = /(?<![\w-])m-(?:\d[\d.]*|auto|px)(?![\w-])/g;
  const hits = [];
  for (const f of files) {
    if (!/\.css$/.test(f) && !/^(src|cli|compiler)\/.*\.(ts|tsx|js)$/.test(f)) continue;
    if (/\.test\.js$/.test(f) || f === "cli/check-component.js") continue; // the rule itself names them
    const s = /\.css$/.test(f) ? read(f).replace(/\/\*[\s\S]*?\*\//g, "") : read(f);
    for (const m of s.matchAll(re)) hits.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(hits.slice(0, 20), []);
});
