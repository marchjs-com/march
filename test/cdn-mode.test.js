// March from the CDN (march.config.js › cdn, compiler/cdn.js): imports go to the smallest CDN entry, an entry module is
// its CDN file plus its stylesheet, code samples in strings stay as written, and an esbuild build bundles none of March.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { cdnImports, cdnModule, cdnTargets, entryNames } from "../compiler/cdn.js";
import { march } from "../compiler/esbuild.js";
import { MARCH_ROOT } from "../compiler/autoimports.js";

const BASE = "https://cdn.test/1.0.0";
const entry = (spec) => `${BASE}/${spec === "march" ? "march" : spec.slice(6)}.js`;
const cdn = {
  base: BASE,
  url: Object.fromEntries(["march", "march/ui", "march/actions", "march/components/actions/button", "march/router"].map((s) => [s, entry(s)])),
  size: { march: 0, "march/ui": 400000, "march/actions": 45000, "march/components/actions/button": 6000, "march/router": 12000 },
  css: { "march/components/actions/button": `${BASE}/components/actions/button.css`, "march/ui": `${BASE}/ui.css`, "march/actions": `${BASE}/actions.css` },
  core: [],
};
const files = {
  march: join(MARCH_ROOT, "src/index.ts"),
  "march/ui": join(MARCH_ROOT, "src/ui/index.ts"),
  "march/actions": join(MARCH_ROOT, "src/actions/index.ts"),
  "march/components/actions/button": join(MARCH_ROOT, "src/components/actions/button/index.ts"),
  "march/router": join(MARCH_ROOT, "src/router/index.ts"),
};

test("cdn: a named import goes to the smallest entry that exports it; samples in strings stay", () => {
  const target = cdnTargets(cdn, files);
  assert.equal(target("march/ui", "Button"), "march/components/actions/button");
  assert.equal(target("march/ui", "nope"), "march/ui");
  const out = cdnImports('import { Button, type ButtonProps } from "march/ui";\nconst s = `import { Button } from "march/ui"`;\nconst B = () => import("march/ui").then((m) => m.Button);', target);
  assert.match(out, /import \{ Button \} from "march\/components\/actions\/button";/);
  assert.match(out, /import \{ type ButtonProps \} from "march\/ui";/);
  assert.match(out, /`import \{ Button \} from "march\/ui"`/, "a code sample is content");
  assert.match(out, /import\("march\/components\/actions\/button"\)\.then/);
});

test("cdn: an entry module is its CDN file and its stylesheet (awaited in the browser, not in node)", () => {
  assert.equal(cdnModule("march/router", cdn), `export * from "${BASE}/router.js";`);
  // its names, written out: `export *` from an external module names nothing to the bundler
  assert.equal(cdnModule("march/router", cdn, null, ["Link", "createRouter"]), `export { Link, createRouter } from "${BASE}/router.js";`);
  assert.ok(entryNames(files["march/components/actions/button"]).includes("Button"));
  const m = cdnModule("march/components/actions/button", cdn);
  assert.match(m, /export \* from "https:\/\/cdn\.test\/1\.0\.0\/components\/actions\/button\.js"/);
  assert.match(m, /await cdnCss\("https:\/\/cdn\.test\/1\.0\.0\/components\/actions\/button\.css"\)/);
  assert.doesNotMatch(cdnModule("march/components/actions/button", cdn, "/src/button.ts"), /await/);
});

test("cdn: a build bundles none of March: its imports stay CDN URLs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "march-cdn-mode-"));
  try {
    writeFileSync(join(dir, "main.ts"), 'import { Button } from "march/ui";\nimport { signal } from "march";\nimport "march/css/tokens.css";\nexport const x = [Button, signal(1)];\nexport const later = () => import("march/router").then((m) => m.createRouter);\n');
    const r = await esbuild.build({ entryPoints: [join(dir, "main.ts")], bundle: true, format: "esm", splitting: true, outdir: join(dir, "out"), write: true, metafile: true, logLevel: "silent", absWorkingDir: dir, plugins: [march({ cdn })] });
    const inputs = Object.keys(r.metafile.inputs);
    assert.ok(!inputs.some((i) => i.replace(/\\/g, "/").includes("/src/") && !i.startsWith("march-")), `no March source in the bundle: ${inputs.join(", ")}`);
    const code = readdirSync(join(dir, "out")).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(dir, "out", f), "utf8")).join("\n");
    assert.match(code, /https:\/\/cdn\.test\/1\.0\.0\/components\/actions\/button\.js/);
    assert.match(code, /https:\/\/cdn\.test\/1\.0\.0\/march\.js/);
    assert.match(code, /https:\/\/cdn\.test\/1\.0\.0\/router\.js/);
    assert.match(code, /https:\/\/cdn\.test\/1\.0\.0\/css\/tokens\.css/);
    assert.doesNotMatch(code, /cdn\.test\/1\.0\.0\/ui\.js/, "march/ui itself is never loaded");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("cdn: a lazy entry import is the CDN file itself, its stylesheet loaded alongside (no wrapper chunk)", async () => {
  const { cdnDynamic } = await import("../compiler/cdn.js");
  const out = cdnDynamic('const B = () => import("march/components/actions/button").then((m) => m.Button);\nconst R = () => import("march/router");\nconst s = "import(\\"march/router\\")";', cdn, null);
  assert.match(out, /^import \{ cdnLazy as __mCdnLazy \} from "march-cdn:css";/);
  assert.match(out, /__mCdnLazy\(import\("https:\/\/cdn\.test\/1\.0\.0\/components\/actions\/button\.js"\), "https:\/\/cdn\.test\/1\.0\.0\/components\/actions\/button\.css"\)\.then/);
  assert.match(out, /const R = \(\) => import\("https:\/\/cdn\.test\/1\.0\.0\/router\.js"\);/);
  assert.match(out, /const s = "import\(\\"march\/router\\"\)";/, "text in a string stays");
  assert.match(cdnDynamic('import("march/router")', cdn, { "march/router": "C:\\m\\src\\router\\index.ts" }), /import\("C:\/m\/src\/router\/index\.ts"\)/, "prerender: the source");
});

test("cdn: with the CDN's names.json the smallest entry comes from it, not from March's sources", () => {
  const t = cdnTargets({ ...cdn, best: { "march/ui": { Button: "march/components/actions/button" } } }, {});
  assert.equal(t("march/ui", "Button"), "march/components/actions/button");
  assert.equal(t("march/ui", "toast"), "march/ui", "a name it does not list stays");
});
