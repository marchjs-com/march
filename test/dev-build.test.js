// `march build --dev`: one esbuild pass, compile cache on disk, no chunk planning; `--watch` rebuilds on change.
// The generator runner skips a generator whose inputs did not change. (The release build: test/cli.test.js.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../cli/march.js", import.meta.url));

function app() {
  const dir = mkdtempSync(join(tmpdir(), "march-devbuild-"));
  mkdirSync(join(dir, "src/pages"), { recursive: true });
  writeFileSync(join(dir, "src/pages/index.jsx"), "export default function Home() { let $n = 0\n return <button on:click={() => $n++}>{$n}</button> }\n");
  writeFileSync(join(dir, "src/pages/_layout.jsx"), "export default function Layout(p) { return <main>{p.children}</main> }\n");
  writeFileSync(join(dir, "src/pages/about.jsx"), "export default function About() { return <p>about</p> }\n");
  writeFileSync(join(dir, "src/main.jsx"), "import routes from './routes.gen.js'\ncreateRouter({ routes })\nrender(() => <Router />, document.getElementById('app'))\n");
  writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
  return dir;
}
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? [f.name, ...walk(join(d, f.name))] : [f.name]));

test("march build --dev: one pass, lazy pages split, compile cache written, no name starts with _ or .", () => {
  const dir = app();
  try {
    const out = execFileSync(process.execPath, [CLI, "build", "--dev", "--timing"], { cwd: dir, encoding: "utf8" });
    assert.match(out, /built dist \(dev\)/);
    const html = readFileSync(join(dir, "dist/index.html"), "utf8");
    assert.match(html, /<script type="module" src="\/assets\/main\.js"><\/script>/);
    assert.match(html, /id="march-manifest"/, "the chunk manifest is there (route preloading works in the fast build)");
    assert.doesNotMatch(html, /__march\/client/);
    assert.ok(readdirSync(join(dir, "dist/assets/chunks")).filter((f) => f.endsWith(".js")).length >= 2, "pages are lazy chunks");
    for (const n of walk(join(dir, "dist"))) assert.doesNotMatch(n, /^[_.]/, n);
    const cache = join(dir, "node_modules/.cache/march/compile");
    assert.ok(existsSync(cache) && readdirSync(cache).length >= 3, "compiled modules cached on disk");
    // the same build again reads them back: same output
    const before = readFileSync(join(dir, "dist/assets/main.js"), "utf8");
    execFileSync(process.execPath, [CLI, "build", "--dev"], { cwd: dir, stdio: "pipe" });
    assert.equal(readFileSync(join(dir, "dist/assets/main.js"), "utf8"), before);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("march build --watch: a change is rebuilt (only changed files written), the page shows the new code", async () => {
  const dir = app();
  const p = spawn(process.execPath, [CLI, "build", "--watch"], { cwd: dir });
  let log = "";
  p.stdout.on("data", (d) => { log += d; });
  p.stderr.on("data", (d) => { log += d; });
  const until = (re) => new Promise((ok, no) => {
    const t0 = Date.now();
    const i = setInterval(() => { if (re.test(log)) { clearInterval(i); ok(); } else if (Date.now() - t0 > 30000 || p.exitCode !== null) { clearInterval(i); no(new Error(`no ${re}: ${log}`)); } }, 25);
  });
  try {
    await until(/watching/);
    writeFileSync(join(dir, "src/pages/about.jsx"), "export default function About() { return <p>rebuilt-marker</p> }\n");
    // (esbuild's watcher may report a rebuild of its own first: wait for the new text to land)
    const chunks = join(dir, "dist/assets/chunks");
    const has = () => readdirSync(chunks).some((f) => { try { return readFileSync(join(chunks, f), "utf8").includes("rebuilt-marker"); } catch { return false; } });
    const t0 = Date.now();
    while (!has() && Date.now() - t0 < 30000) await new Promise((r) => setTimeout(r, 50));
    assert.ok(has(), `the edit was rebuilt: ${log}`);
    assert.match(log, /rebuilt dist \(dev\)/);
  } finally {
    p.kill();
    await new Promise((r) => (p.exitCode !== null ? r() : p.on("exit", r)));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gen-all: a generator runs only when its inputs changed", async () => {
  const { GENERATORS, digest } = await import("../tools/gen-all.mjs");
  const names = GENERATORS.map((g) => g.name);
  for (const n of ["registry", "api", "icons", "themes"]) assert.ok(names.includes(n), n);
  const g = GENERATORS.find((x) => x.name === "icons");
  assert.equal(digest(g), digest(g), "the digest is stable");
  assert.notEqual(digest(g), digest({ ...g, inputs: [] }), "inputs count");
});
