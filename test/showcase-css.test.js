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

/** Every stylesheet under examples/showcase/src (pages, home sections, samples), relative to it. */
const cssFiles = (dir = DIR, rel = "") => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? cssFiles(join(dir, d.name), `${rel}${d.name}/`) : d.name.endsWith(".css") ? [`${rel}${d.name}`] : []));

test("every showcase class has one base rule, across all showcase stylesheets", () => {
  const dupes = [], where = new Map();
  for (const f of cssFiles()) {
    for (const [sel, at] of baseRules(readFileSync(join(DIR, f), "utf8"))) {
      if (at.length > 1) dupes.push(`${f}: ${sel} on lines ${at.join(", ")}`);
      (where.get(sel) ?? where.set(sel, []).get(sel)).push(`${f}:${at[0]}`);
    }
  }
  // the same class with a base rule in two files: two features restyle each other (home .sc-cat vs the theme swatches)
  for (const [sel, files] of where) if (files.length > 1) dupes.push(`${sel} in ${files.join(", ")}`);
  assert.deepEqual(dupes, [], "merge the rules, or give the second feature its own class name");
});

test("the check finds a reused class name", () => {
  const css = ".sc-a { display: flex; }\n@media (max-width: 40rem) { .sc-a { display: block; } }\n.sc-a:hover { color: red; }\n.sc-a { margin-inline: auto; }\n";
  assert.deepEqual(baseRules(css).get(".sc-a"), [1, 4]);
});

// Home: a lazy part (sections.tsx lazy(…, { height })) is a sized slot until its chunk is cached. Its sections keep the
// page's space between them only if the home rule outweighs lazy.css's `.m-lazy-slot.m-lazy-sized { display: block }`
// whatever order the stylesheets load in: the space between categories went missing on first visits.
test("home: a lazy part's sections keep the section gap, the sized slot's display rule never wins", () => {
  const css = readFileSync(join(DIR, "home/sections.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const lazy = readFileSync(fileURLToPath(new URL("../src/dom/lazy.css", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  // the specificity lazy.css gives the sized slot's display (classes only: one point per class)
  const lazyRule = [...lazy.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((m) => /\.m-lazy-sized\b/.test(m[1]) && /display\s*:\s*block/.test(m[2]));
  assert.ok(lazyRule, "lazy.css still sets the sized slot's display");
  const weight = (sel) => (sel.match(/\.[\w-]+/g) ?? []).length;
  const lazyWeight = Math.max(...lazyRule[1].split(",").map(weight));
  // a home rule for the slot that lays the sections out in a column with the section gap
  const homeRule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((m) => /\.sc-home-body\s*>\s*\.m-lazy-slot/.test(m[1]) && /display\s*:\s*flex/.test(m[2]) && /gap\s*:\s*var\(--sc-sec-gap\)/.test(m[2]));
  assert.ok(homeRule, "sections.css lays a lazy part's sections out with the section gap");
  const sized = homeRule[1].split(",").map((s) => s.trim()).filter((s) => /\.m-lazy-sized\b/.test(s));
  assert.ok(sized.length && Math.max(...sized.map(weight)) > lazyWeight, "the home rule names the sized slot and outweighs lazy.css");
});

// A half-deleted rule (`.a, @media (…) { … }`) is no error to the browser: it drops the rule and the at-rule glued into
// it, silently (the home's reduced-motion rule and its 1000 px layout lost that way).
test("no showcase stylesheet has an at-rule glued into a selector list", () => {
  const glued = [];
  for (const f of cssFiles()) {
    const css = readFileSync(join(DIR, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
    css.split("\n").forEach((line, i) => { if (/,\s*@(media|container|supports|layer)\b/.test(line)) glued.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(glued, []);
});
