// Every page in the showcase menu (nav.ts) has a loader (routes.gen.js) and a file in pages/, and the other way round.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../examples/showcase/src/", import.meta.url));
const paths = (file, re) => [...readFileSync(SRC + file, "utf8").matchAll(re)].map((m) => m[1]).sort();

test("menu pages, loaders and page files match", () => {
  // top-level pages (nav.ts PAGES) and the pages under a wildcard route (nav.ts SUB_PAGES). A sub page is its own file
  // (pages/motion/svg.tsx), or a view of its parent page (/web/product is a view of pages/web.tsx)
  const src = readFileSync(SRC + "nav.ts", "utf8");
  const at = src.indexOf("export const SUB_PAGES");
  const top = [...src.slice(0, at).matchAll(/path: "([^"]+)"/g)].map((m) => m[1]);
  // …and the topics of the sections with one page per topic (topics.ts: "/motion": [{ slug: "svg" … }])
  const topics = [...readFileSync(SRC + "topics.ts", "utf8").matchAll(/^  "(\/[\w-]+)": \[([\s\S]*?)^  \],/gm)]
    .flatMap((m) => [...m[2].matchAll(/slug: "([^"]+)"/g)].map((k) => `${m[1]}/${k[1]}`));
  const subs = [...src.slice(at).matchAll(/path: "([^"]+)"/g)].map((m) => m[1]).concat(topics);
  const file = (p) => `${SRC}pages/${p.slice(1) || "home"}.tsx`;
  const own = subs.filter((p) => existsSync(file(p)));
  for (const p of subs) assert.ok(existsSync(file(p)) || existsSync(file(p.slice(0, p.lastIndexOf("/")))), `${file(p)} or its parent page`);
  // loaders: routes.gen.js (march gen routes from pages/); the start page "/" is pages/home.tsx
  const loaders = paths("routes.gen.js", /^  "([^"]+)": \(\) => import\("\.\/pages\//gm).map((p) => (p === "/home" ? "/" : p)).sort();
  assert.deepEqual(loaders, [...top, ...own].sort(), "routes.gen.js loaders = nav.ts pages with a file");
  for (const p of top) assert.ok(existsSync(file(p)), file(p));
});

test("every menu group is one of MENU_GROUPS (src/components/categories.ts), in that order", async () => {
  const { MENU_GROUPS } = await import("../src/components/categories.ts");
  const groups = paths("nav-meta.ts", /group: "([^"]+)"/g);
  for (const g of new Set(groups)) assert.ok(MENU_GROUPS.includes(g), `nav-meta.ts group "${g}" is not a menu group: ${MENU_GROUPS.join(", ")}`);
  assert.match(readFileSync(SRC + "shell-menu.tsx", "utf8"), /groupOrder=\{MENU_GROUPS\}/, "the side menu orders its groups by MENU_GROUPS");
});

test("every menu group belongs to exactly one section of the rail (nav-meta.ts SECTIONS)", async () => {
  const { MENU_GROUPS } = await import("../src/components/categories.ts");
  const src = readFileSync(SRC + "nav-meta.ts", "utf8");
  const block = src.match(/export const SECTIONS[^=]*=\s*\[([\s\S]*?)\n\];/)?.[1] ?? "";
  const sections = [...block.matchAll(/\{ id: "([\w-]+)", label: "([^"]+)"[^\n]*?groups: \[([^\]]*)\](?:, pages: \[([^\]]*)\])?/g)]
    .map((m) => ({ id: m[1], label: m[2], groups: [...m[3].matchAll(/"([^"]+)"/g)].map((x) => x[1]), pages: [...(m[4] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]) }));
  assert.equal(sections.length, 6, "six sections: Başla, Bileşenler, Görünüm, Hareket, Hazır yapılar, Altyapı");
  const owner = new Map();
  for (const s of sections) for (const g of s.groups) {
    assert.ok(MENU_GROUPS.includes(g), `section "${s.label}" names "${g}", which is not a menu group`);
    assert.ok(!owner.has(g), `"${g}" is in two sections: ${owner.get(g)} and ${s.label}`);
    owner.set(g, s.label);
  }
  for (const g of MENU_GROUPS) assert.ok(owner.has(g), `menu group "${g}" is in no section: its pages would not be listed`);
  // a page a section takes from another group is a real top-level page
  const top = paths("nav.ts", /path: "([^"]+)"/g);
  for (const s of sections) for (const p of s.pages) assert.ok(top.includes(p), `section "${s.label}" names the page ${p}, which is not in nav.ts`);
  const menu = readFileSync(SRC + "shell-menu.tsx", "utf8");
  assert.match(menu, /visibleGroups=\{/, "the side menu lists one section's groups");
  assert.match(menu, /<ActivityBar /, "the rail is the ActivityBar");
});

test("every menu page opens its own route (an exact route beats a wildcard that matched nothing)", async () => {
  const { compilePath, matchRoute } = await import("../src/router/index.ts");
  const top = paths("nav.ts", /path: "([^"]+)"/g);
  const routesSrc = readFileSync(SRC + "routes.ts", "utf8");
  const extra = [...routesSrc.matchAll(/^  "(\/[^"]+)": \{/gm)].map((m) => m[1]);
  // the router's order: best score first, stable
  const table = [...top, ...extra].map((p) => ({ path: p, ...compilePath(p) })).sort((a, b) => b.score - a.score);
  for (const p of top) assert.equal(matchRoute(table, p)?.route.pattern, p, `${p} opens its own page, not a wildcard route`);
  // the pages under a wildcard route: the wildcard route matches and its hub module knows the page
  const subs = readFileSync(SRC + "nav-meta.ts", "utf8").match(/SUB_PAGES[^=]*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  const hub = readFileSync(SRC + "motion-hub.tsx", "utf8");
  for (const [, p] of subs.matchAll(/path: "([^"]+)"/g)) {
    const m = matchRoute(table, p);
    assert.ok(m?.route.pattern.endsWith("/*"), `${p} matches a wildcard route`);
    assert.ok(hub.includes(`"${p}":`), `${p} is a page of motion-hub.tsx (else it shows "Sayfa bulunamadı")`);
  }
});

test("router: a wildcard that matched nothing is only a fallback", async () => {
  const { compilePath, matchRoute } = await import("../src/router/index.ts");
  const table = ["/a/*", "/a", "/b/*"].map((p) => ({ path: p, ...compilePath(p) })).sort((x, y) => y.score - x.score);
  assert.equal(matchRoute(table, "/a")?.route.pattern, "/a");
  assert.equal(matchRoute(table, "/a/")?.route.pattern, "/a");
  assert.equal(matchRoute(table, "/a/x")?.route.pattern, "/a/*");
  assert.equal(matchRoute(table, "/b")?.route.pattern, "/b/*", "with no exact route the wildcard still matches");
});
