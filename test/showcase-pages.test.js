// Every page in the showcase menu (nav.ts) has a loader (app.tsx) and a file in pages/, and the other way round.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../examples/showcase/src/", import.meta.url));
const paths = (file, re) => [...readFileSync(SRC + file, "utf8").matchAll(re)].map((m) => m[1]).sort();

test("menu pages, loaders and page files match", () => {
  const menu = paths("nav.ts", /path: "([^"]+)"/g);
  const loaders = paths("app.tsx", /^  "([^"]+)": \(\) => import\("\.\/pages\//gm);
  assert.deepEqual(loaders, menu, "app.tsx LOADERS = nav.ts PAGES");
  const files = readdirSync(SRC + "pages").filter((f) => f.endsWith(".tsx")).map((f) => f.replace(/\.tsx$/, ""));
  for (const p of menu) assert.ok(files.includes(p === "/" ? "home" : p.slice(1)), `pages/${p.slice(1) || "home"}.tsx`);
});
