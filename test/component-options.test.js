// Every component has a "Seçenekler" panel on its showcase page: its playground.ts declares at least one option, and
// a showcase page draws the component folder with <ComponentDemo> (which builds the panel from those options).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASE = join(ROOT, "src/components");
const folders = readdirSync(BASE).filter((c) => statSync(join(BASE, c)).isDirectory())
  .flatMap((c) => readdirSync(join(BASE, c)).filter((n) => existsSync(join(BASE, c, n, "meta.ts"))).map((n) => `${c}/${n}`));

test("every component declares playground options", () => {
  const none = folders.filter((f) => {
    const p = join(BASE, f, "playground.ts");
    return !existsSync(p) || !/\bkey:\s*"/.test(readFileSync(p, "utf8"));
  });
  assert.deepEqual(none, []);
});

test("every component is drawn with its options on a showcase page", () => {
  const pages = join(ROOT, "examples/showcase/src");
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : /\.tsx$/.test(e.name) ? [join(d, e.name)] : []));
  const drawn = new Set(walk(pages).flatMap((f) => [...readFileSync(f, "utf8").matchAll(/<ComponentDemo\b[^>]*?folder="([^"]+)"/gs)].map((m) => m[1])));
  // a heavy feature with its own package entry draws its demo on its own page (meta.entry)
  const own = (f) => /\bentry:\s*"/.test(readFileSync(join(BASE, f, "meta.ts"), "utf8"));
  assert.deepEqual(folders.filter((f) => !drawn.has(f) && !own(f)), []);
});
