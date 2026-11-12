// Every Playground option of a component folder must reach its demo: a key in playground.ts that demo.tsx never reads
// is a control that changes nothing. (The browser check, tools/control-audit.mjs, also proves the effect is visible;
// CI runs it on the built showcase.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "src", "components");
const folders = [];
const walk = (dir, depth) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (existsSync(join(p, "playground.ts")) && existsSync(join(p, "demo.tsx"))) folders.push(p);
    else if (depth < 2) walk(p, depth + 1);
  }
};
walk(ROOT, 0);

test("component folders with a Playground exist", () => assert.ok(folders.length > 10, `${folders.length} folders`));

test("every Playground option key is read by the folder's demo", () => {
  const unread = [];
  for (const dir of folders) {
    const spec = readFileSync(join(dir, "playground.ts"), "utf8");
    const demo = readFileSync(join(dir, "demo.tsx"), "utf8");
    // `props.values.key`, or an alias: `const v = props.values` … `v.key`, or `const { key } = props.values`
    const names = ["values", ...[...demo.matchAll(/(?:const|let|,)\s*(\w+)\s*=\s*props\.values(?![.\w])/g)].map((m) => m[1])].join("|");
    for (const [, key] of spec.matchAll(/\bkey:\s*"([^"]+)"/g)) {
      const read = new RegExp(`\\b(${names})\\.${key}\\b|\\b(${names})\\[["']${key}["']\\]|[{,]\\s*${key}\\s*[,}=:][^\\n]*=\\s*props\\.values`).test(demo);
      if (!read) unread.push(`${dir.slice(ROOT.length + 1).replaceAll("\\", "/")} › ${key}`);
    }
  }
  assert.deepEqual(unread, [], "Playground options the demo never reads (they change nothing)");
});
