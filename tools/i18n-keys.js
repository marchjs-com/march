#!/usr/bin/env node
// Lists every t`…` key used by the library source (src/**/*.js). Keeps locale packs (src/i18n/*.js) complete
// (test/i18n.test.js fails when a pack misses a key).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src", import.meta.url));
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []; });

export function libraryKeys() {
  const keys = new Set();
  for (const f of walk(root)) {
    if (f.includes(`${join("src", "i18n")}`)) continue;
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bt`((?:[^`\\]|\\.)*)`/g)) {
      let i = 0;
      keys.add(m[1].replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, () => `{${i++}}`));
    }
  }
  return [...keys].sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) console.log(JSON.stringify(libraryKeys(), null, 1));
