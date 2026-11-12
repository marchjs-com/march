// Every page in the showcase menu (nav.ts) has a loader (routes.gen.js) and a file in pages/, and the other way round.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../examples/showcase/src/", import.meta.url));
const paths = (file, re) => [...readFileSync(SRC + file, "utf8").matchAll(re)].map((m) => m[1]).sort();

test("menu pages, loaders and page files match", () => {
  // top-level pages (nav.ts) and the pages under a wildcard route (nav-meta.ts SUB_PAGES, e.g. pages/motion/svg.tsx)
  const subs = readFileSync(SRC + "nav-meta.ts", "utf8").match(/SUB_PAGES[^=]*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  const menu = [...paths("nav.ts", /path: "([^"]+)"/g), ...[...subs.matchAll(/path: "([^"]+)"/g)].map((m) => m[1])].sort();
  // loaders: routes.gen.js (march gen routes from pages/); the start page "/" is pages/home.tsx
  const loaders = paths("routes.gen.js", /^  "([^"]+)": \(\) => import\("\.\/pages\//gm).map((p) => (p === "/home" ? "/" : p)).sort();
  assert.deepEqual(loaders, menu, "routes.gen.js loaders = nav.ts PAGES");
  for (const p of menu) assert.ok(existsSync(`${SRC}pages/${p.slice(1) || "home"}.tsx`), `pages/${p.slice(1) || "home"}.tsx`);
});

test("every menu group is one of MENU_GROUPS (src/components/categories.ts), in that order", async () => {
  const { MENU_GROUPS } = await import("../src/components/categories.ts");
  const groups = paths("nav-meta.ts", /group: "([^"]+)"/g);
  for (const g of new Set(groups)) assert.ok(MENU_GROUPS.includes(g), `nav-meta.ts group "${g}" is not a menu group: ${MENU_GROUPS.join(", ")}`);
  assert.match(readFileSync(SRC + "shell-menu.tsx", "utf8"), /groupOrder=\{MENU_GROUPS\}/, "the side menu orders its groups by MENU_GROUPS");
});
