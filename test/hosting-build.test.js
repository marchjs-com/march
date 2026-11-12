// march build for every host: a relative build writes <route>/index.html with paths for its depth (also the plain shell
// for a route that could not be prerendered), 404.html + march-404.js for addresses without a file; an absolute base is
// written into index.html and can get a _redirects file. march-404.js hands the address to the app's root.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const CLI = fileURLToPath(new URL("../cli/march.js", import.meta.url));

function app(config) {
  const dir = mkdtempSync(join(tmpdir(), "march-host-"));
  mkdirSync(join(dir, "src/pages/users"), { recursive: true });
  mkdirSync(join(dir, "src/pages/docs"), { recursive: true });
  mkdirSync(join(dir, "public/media"), { recursive: true });
  writeFileSync(join(dir, "public/media/a.png"), "");
  writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
  writeFileSync(join(dir, "src/pages/index.jsx"), "export default function Home() { return <main><h1>Home</h1><Link href=\"/docs/intro\">Intro</Link></main> }\n");
  writeFileSync(join(dir, "src/pages/about.jsx"), "import { appUrl } from 'hadi-march/base'\nexport default function About() { return <main><h1>About</h1><img src={appUrl('media/a.png')} alt=\"\" /><Link href=\"/docs/intro\">Intro</Link></main> }\n");
  writeFileSync(join(dir, "src/pages/docs/intro.jsx"), "export default function Intro() { return <main><h1>Intro</h1><Link href=\"/\">Home</Link></main> }\n");
  writeFileSync(join(dir, "src/pages/broken.jsx"), "export default function Broken() { throw new Error('needs a browser') }\n");
  writeFileSync(join(dir, "src/pages/users/[id].jsx"), "export default function User(p) { return <h1>{p.params.id}</h1> }\n");
  writeFileSync(join(dir, "src/main.jsx"), "import { hydrate } from 'hadi-march/seo/hydrate'\nimport routes from './routes.gen.js'\ncreateRouter({ routes })\nhydrate(() => <Router />, document.getElementById('app'))\n");
  writeFileSync(join(dir, "march.config.js"), `export default ${JSON.stringify(config)}\n`);
  let log = "";
  try { log = execFileSync(process.execPath, [CLI, "build"], { cwd: dir, encoding: "utf8", stdio: "pipe", timeout: 180000 }); } catch (e) { rmSync(dir, { recursive: true, force: true }); assert.fail(String(e.stderr) + String(e.stdout)); }
  const read = (f) => readFileSync(join(dir, "dist", f), "utf8");
  return { dir, log, read, has: (f) => existsSync(join(dir, "dist", f)), done: () => rmSync(dir, { recursive: true, force: true }) };
}

test("relative build: a page per route with paths for its depth, the shell where prerender failed, 404.html for the rest", async () => {
  const a = app({ chunks: false, base: "./", redirects: true, seo: { prerender: true } });
  try {
    const home = a.read("index.html"), about = a.read("about/index.html"), intro = a.read("docs/intro/index.html");
    assert.match(home, /<script type="module" src="\.\/assets\/main-[\w-]+\.js">/);
    assert.match(about, /<script type="module" src="\.\.\/assets\/main-[\w-]+\.js">/);
    assert.match(intro, /<script type="module" src="\.\.\/\.\.\/assets\/main-[\w-]+\.js">/);
    assert.match(about, /data-hm-prerender="\/about"/);
    assert.match(about, /<img src="\.\.\/media\/a\.png" alt(="")?>/, "a public file under the root, from the page's folder");
    assert.match(about, /<a href="\.\.\/docs\/intro"/, "links relative to the page's own address");
    assert.match(intro, /<a href="\.\.\/\.\.\/"/);
    for (const html of [home, about, intro]) {
      assert.doesNotMatch(html, /prerender\.invalid/);
      assert.doesNotMatch(html, /(src|href)="\/(?!\/)/, "no root-absolute path");
      assert.doesNotMatch(html, /march-base/, "a relative build carries no base");
    }
    const broken = a.read("broken/index.html");
    assert.doesNotMatch(broken, /data-hm-prerender/, "the plain shell");
    assert.match(broken, /src="\.\.\/assets\/main-/);
    assert.ok(!a.has("users"), "a route with params has no folder");
    const nf = a.read("404.html");
    assert.match(nf, /<meta name="robots" content="noindex">/);
    for (const p of ["./", "../", "../../", "../../../"]) assert.ok(nf.includes(`<script type="module" src="${p}march-404.js">`), p);
    assert.ok(a.has("march-404.js"));
    assert.ok(!a.has("_redirects"), "no _redirects with a relative base");
    assert.match(a.log, /redirects: skipped for a relative base/);
  } finally { a.done(); }
});

test("absolute base: written into index.html, absolute paths, one 404 script, _redirects on request", async () => {
  const a = app({ chunks: false, base: "/app/", redirects: true, seo: { prerender: true, site: "https://x.example" } });
  try {
    const home = a.read("index.html"), about = a.read("about/index.html");
    assert.match(home, /<meta name="march-base" content="\/app\/">/);
    assert.match(about, /<script type="module" src="\/app\/assets\/main-[\w-]+\.js">/);
    assert.match(about, /<img src="\/app\/media\/a\.png" alt(="")?>/);
    assert.equal((about.match(/name="march-base"/g) ?? []).length, 1);
    assert.equal(a.read("_redirects"), "/app/*  /app/index.html  200\n");
    const nf = a.read("404.html");
    assert.equal((nf.match(/<script /g) ?? []).length, 1);
    assert.match(nf, /src="\/app\/march-404\.js"/);
    assert.match(a.read("sitemap.xml"), /<loc>https:\/\/x\.example\/app\/about<\/loc>/, "an origin-only site gets the base");
  } finally { a.done(); }
});

test("march-404.js: back to the app's root with the address in ?hm-path= (once; not outside the root)", async () => {
  const { NOT_FOUND_JS } = await import("../compiler/prerender.js");
  const dir = mkdtempSync(join(tmpdir(), "march-404-"));
  try {
    const file = join(dir, "march-404.js");
    writeFileSync(file, NOT_FOUND_JS);
    const root = new URL("./", pathToFileURL(file)).pathname;
    const run = async (pathname, search = "", hash = "") => {
      let to = null;
      globalThis.__march404 = undefined;
      globalThis.location = { pathname, search, hash, replace: (u) => { to = u; } };
      await import(`${pathToFileURL(file).href}?r=${Math.random()}`);
      delete globalThis.location;
      return to;
    };
    const to = await run(`${root}users/7`, "?tab=a", "#top");
    assert.equal(new URL(to).pathname, root);
    assert.equal(new URL(to).searchParams.get("hm-path"), "/users/7?tab=a#top");
    assert.equal(await run("/elsewhere/users/7"), null, "an address outside the root is left alone");
    assert.equal(await run(`${root}users/7`, "?hm-path=%2Fx"), null, "no loop when the root itself is missing");
  } finally { rmSync(dir, { recursive: true, force: true }); delete globalThis.__march404; }
});
