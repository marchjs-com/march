// Showcase stylesheet hygiene: a class's base rule (`.name { … }` at the top level) is written once. Two features that
// pick the same class name silently restyle each other (the theme gallery cards were shrunk and centred by a preview
// box rule of the layout page that reused `.sc-mini`). Variants (`.name.is-x`, `.name:hover`, `.a .name`) are fine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../examples/showcase/src/", import.meta.url));

/** Top-level `.class {` rules (outside @media / @container / @supports blocks) with their line numbers. */
export function baseRules(css) {
  const out = new Map();
  let depth = 0;
  const lines = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).split("\n");
  lines.forEach((line, i) => {
    const m = depth === 0 && line.match(/^(\.[\w-]+)\s*\{/);
    if (m) (out.get(m[1]) ?? out.set(m[1], []).get(m[1])).push(i + 1);
    for (const ch of line) { if (ch === "{") depth++; else if (ch === "}") depth = Math.max(0, depth - 1); }
  });
  return out;
}

test("every showcase class has one base rule", () => {
  const dupes = [];
  for (const f of readdirSync(DIR).filter((n) => n.endsWith(".css"))) {
    for (const [sel, at] of baseRules(readFileSync(join(DIR, f), "utf8"))) if (at.length > 1) dupes.push(`${f}: ${sel} on lines ${at.join(", ")}`);
  }
  assert.deepEqual(dupes, [], "merge the rules, or give the second feature its own class name");
});

test("the check finds a reused class name", () => {
  const css = ".sc-a { display: flex; }\n@media (max-width: 40rem) { .sc-a { display: block; } }\n.sc-a:hover { color: red; }\n.sc-a { margin-inline: auto; }\n";
  assert.deepEqual(baseRules(css).get(".sc-a"), [1, 4]);
});
