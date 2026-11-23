// Every component has a "Seçenekler" panel: its playground.ts declares at least one option (the site's component page
// builds the panel from them).
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
