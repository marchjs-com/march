import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { routeOf, genRoutes } from "../cli/routes.js";
import { genApi, mockHandler } from "../cli/openapi.js";
import { templates } from "../cli/templates.js";
import { compile } from "../compiler/index.js";

const CLI = fileURLToPath(new URL("../cli/march.js", import.meta.url));

test("file based routes", () => {
  assert.equal(routeOf("index.jsx"), "/");
  assert.equal(routeOf("users/[id].jsx"), "/users/:id");
  assert.equal(routeOf("docs/[...slug].jsx"), "/docs/*slug");
  assert.equal(routeOf("users/index.jsx"), "/users");
  const dir = mkdtempSync(join(tmpdir(), "march-routes-"));
  try {
    mkdirSync(join(dir, "pages/users"), { recursive: true });
    writeFileSync(join(dir, "pages/index.jsx"), "");
    writeFileSync(join(dir, "pages/users/[id].jsx"), "");
    writeFileSync(join(dir, "pages/_hidden.jsx"), "");
    writeFileSync(join(dir, "pages/_layout.jsx"), "");
    writeFileSync(join(dir, "pages/users/_layout.tsx"), "");
    genRoutes(join(dir, "pages"), join(dir, "routes.gen.js"));
    const code = readFileSync(join(dir, "routes.gen.js"), "utf8");
    assert.ok(code.includes(`"/users/:id": { load: () => import("./pages/users/[id].jsx"), layouts: [() => import("./pages/_layout.jsx"), () => import("./pages/users/_layout.tsx")] }`));
    assert.doesNotMatch(code, /_hidden/);
    const dts = readFileSync(join(dir, "pages.d.ts"), "utf8");
    assert.ok(dts.includes(`"/users/:id": { id: string };`));
    assert.ok(dts.includes(`interface Register { routes: "/" | "/users/:id" }`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const spec = {
  openapi: "3.0.0", servers: [{ url: "/api" }],
  paths: {
    "/users": { get: { operationId: "listUsers", responses: { 200: { content: { "application/json": { example: [{ id: 1, name: "Ada" }] } } } } },
      post: { operationId: "createUser", requestBody: {}, responses: { 201: { content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } } } },
    "/users/{id}": { delete: { operationId: "deleteUser", responses: { 204: {} } } },
  },
  components: { schemas: { User: { type: "object", required: ["name"], properties: { id: { type: "integer", readOnly: true }, name: { type: "string", maxLength: 40 }, email: { type: "string", format: "email" }, role: { type: "string", enum: ["admin", "user"] } } } } },
};

test("OpenAPI → client and schemas; mock server answers from examples", () => {
  const code = genApi(spec);
  assert.match(code, /export const UserSchema = schema\(/);
  assert.match(code, /"type": "pick"/);
  assert.match(code, /listUsers: \(query = \{\}, opts = \{\}\) => fetchJson\(`\$\{BASE\}\/users\$\{qs\(query\)\}`/);
  assert.match(code, /deleteUser: \(id, query = \{\}, opts = \{\}\)/);
  const m = mockHandler(spec);
  let out = {};
  const res = { writeHead: (s) => { out.status = s; }, end: (b) => { out.body = JSON.parse(b); } };
  m.handle({ method: "GET" }, res, new URL("http://x/api/users"));
  assert.deepEqual(out, { status: 200, body: [{ id: 1, name: "Ada" }] });
  m.handle({ method: "POST" }, res, new URL("http://x/api/users"));
  assert.equal(out.status, 201); assert.equal(out.body.name, "string");
});

test("templates compile", () => {
  for (const src of [templates.page("users/[id]"), templates.component("UserCard"), templates.crud("products")]) compile(src, { runtime: "hadi-march" });
});

test("march build bundles a tiny app with routes and public files", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-app-"));
  try {
    mkdirSync(join(dir, "src/pages"), { recursive: true });
    mkdirSync(join(dir, "public"));
    writeFileSync(join(dir, "public/robots.txt"), "User-agent: *\n");
    writeFileSync(join(dir, "src/pages/index.jsx"), "export default function Home() { let $n = 0\n return <button on:click={() => $n++}>{$n}</button> }\n");
    // a second (lazy) page: its chunk is an esbuild entry point too and must not end up in index.html
    writeFileSync(join(dir, "src/pages/about.jsx"), "export default function About() { return <p>about</p> }\n");
    writeFileSync(join(dir, "src/main.jsx"), "import routes from './routes.gen.js'\ncreateRouter({ routes })\nrender(() => <Router />, document.getElementById('app'))\n");
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" });
    assert.ok(existsSync(join(dir, "dist/index.html")));
    assert.ok(existsSync(join(dir, "dist/robots.txt")));
    const html = readFileSync(join(dir, "dist/index.html"), "utf8");
    assert.match(html, /<script type="module" src="\/assets\/main-[\w-]+\.js"><\/script>/);
    assert.doesNotMatch(html, /__march\/client/);
    assert.ok(readdirSync(join(dir, "dist/assets")).some((f) => f.endsWith(".js")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("installed under node_modules: register runs .tsx/.ts, march build bundles (node does not strip types there itself)", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-installed-"));
  try {
    const pkg = join(dir, "node_modules", "hadi-march");
    const root = fileURLToPath(new URL("..", import.meta.url));
    const files = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).files;
    for (const f of [...files, "package.json"]) if (existsSync(join(root, f))) cpSync(join(root, f), join(pkg, f), { recursive: true });
    // esbuild is the app's own dev dependency: link the one March was tested with
    cpSync(join(root, "node_modules", "esbuild"), join(dir, "node_modules", "esbuild"), { recursive: true, dereference: true });
    if (existsSync(join(root, "node_modules", "@esbuild"))) cpSync(join(root, "node_modules", "@esbuild"), join(dir, "node_modules", "@esbuild"), { recursive: true, dereference: true });
    mkdirSync(join(dir, "src/pages"), { recursive: true });
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    writeFileSync(join(dir, "src/pages/index.tsx"), "export default function Home() { let $n: number = 0\n return <button on:click={() => $n++} sx={{ p: 2 }}>{$n}</button> }\n");
    writeFileSync(join(dir, "src/main.tsx"), "import routes from './routes.gen.js'\ncreateRouter({ routes })\nrender(() => <Router />, document.getElementById('app'))\n");
    writeFileSync(join(dir, "check.test.mjs"), [
      "import { test } from 'node:test'; import assert from 'node:assert/strict';",
      "import { installDom } from 'hadi-march/testing'; installDom();",
      "const { signal } = await import('hadi-march'); const { default: Home } = await import('./src/pages/index.tsx');",
      "test('works', () => { assert.equal(signal(2)(), 2); assert.equal(typeof Home, 'function'); });",
    ].join("\n"));
    const run = (args) => { try { execFileSync(process.execPath, args, { cwd: dir, stdio: "pipe" }); } catch (e) { assert.fail(String(e.stderr) + String(e.stdout)); } };
    run(["--import", "hadi-march/register", "--test", "check.test.mjs"]);
    run(["--import", "hadi-march/register", "--input-type=module", "-e", "await import('hadi-march/compiler')"]);
    try { execFileSync(process.execPath, [join(pkg, "cli", "march.js"), "build"], { cwd: dir, stdio: "pipe" }); } catch (e) { assert.fail(String(e.stderr) + String(e.stdout)); }
    assert.match(readFileSync(join(dir, "dist/index.html"), "utf8"), /assets\/main-[\w-]+\.js/);
    assert.ok(existsSync(join(pkg, "types", "jsx.d.ts")), "types/ is part of the package files");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("march build: per-route size report by path; a route over its budget fails the build and is named", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-budget-"));
  try {
    mkdirSync(join(dir, "src/pages"), { recursive: true });
    writeFileSync(join(dir, "src/pages/index.jsx"), "export default function Home() { return <p>home</p> }\n");
    writeFileSync(join(dir, "src/pages/big.jsx"), `const rows = ${JSON.stringify(Array.from({ length: 3000 }, (_, i) => `row ${i} ${Math.random().toString(36)}`))}\nexport default function Big() { return <ul>{rows.map((r) => <li>{r}</li>)}</ul> }\n`);
    writeFileSync(join(dir, "src/main.jsx"), "import routes from './routes.gen.js'\ncreateRouter({ routes })\nrender(() => <Router />, document.getElementById('app'))\n");
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    writeFileSync(join(dir, "march.config.js"), "export default { budget: { entry: 64 * 1024, route: 64 * 1024, routes: { \"/big\": 8 * 1024 }, fail: true }, chunks: false }\n");
    let err = null;
    try { execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" }); } catch (e) { err = e; }
    assert.ok(err && err.status === 1, "the build exits with 1");
    assert.match(String(err.stderr), /over budget: \/big JS [\d.]+ KB > 8\.0 KB/);
    const rep = JSON.parse(readFileSync(join(dir, "dist/march-report.json"), "utf8"));
    assert.deepEqual(rep.routes.map((r) => [r.name, r.over]).sort(), [["/", false], ["/big", true]]);
    assert.equal(rep.routes.find((r) => r.name === "/big").limit, 8 * 1024);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("march build: base \"./\" writes only relative asset URLs (the app works from a sub-folder)", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-base-"));
  try {
    mkdirSync(join(dir, "src/pages"), { recursive: true });
    writeFileSync(join(dir, "src/pages/index.jsx"), "export default function Home() { return <p>home</p> }\n");
    writeFileSync(join(dir, "src/pages/about.jsx"), "export default function About() { return <p>about</p> }\n");
    writeFileSync(join(dir, "src/main.jsx"), "import routes from './routes.gen.js'\ncreateRouter({ routes })\nrender(() => <Router />, document.getElementById('app'))\n");
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    writeFileSync(join(dir, "march.config.js"), "export default { base: \"./\" }\n");
    execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" });
    const html = readFileSync(join(dir, "dist/index.html"), "utf8");
    assert.doesNotMatch(html, /"\/assets\//, "no absolute /assets/ URL");
    assert.match(html, /src="\.\/assets\/main-[\w-]+\.js"/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("march build: credit: true adds the Built with HADI March comment; off by default", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-credit-"));
  try {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/main.jsx"), "render(() => <p>hi</p>, document.getElementById('app'))\n");
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" });
    assert.doesNotMatch(readFileSync(join(dir, "dist/index.html"), "utf8"), /Built with HADI March/);
    writeFileSync(join(dir, "march.config.js"), "export default { credit: true }\n");
    execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" });
    assert.match(readFileSync(join(dir, "dist/index.html"), "utf8"), /<!-- Built with HADI March -->/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const ROOT_DIR = fileURLToPath(new URL("..", import.meta.url));
test("showcase dist: no absolute /assets/ URL anywhere in index.html", { skip: !existsSync(join(ROOT_DIR, "examples/showcase/dist/index.html")) }, () => {
  assert.doesNotMatch(readFileSync(join(ROOT_DIR, "examples/showcase/dist/index.html"), "utf8"), /"\/assets\//);
  // the publishing host refuses names starting with _ or .
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? [f.name, ...walk(join(d, f.name))] : [f.name]));
  for (const n of walk(join(ROOT_DIR, "examples/showcase/dist"))) assert.doesNotMatch(n, /^[_.]/, n);
});

test("march build --stable-names: hash-free names, ?v= versions everywhere, deterministic; no name starts with _ or .", () => {
  const dir = mkdtempSync(join(tmpdir(), "march-stable-"));
  try {
    mkdirSync(join(dir, "src/pages/team"), { recursive: true });
    writeFileSync(join(dir, "src/pages/index.jsx"), "export default function Home() { return <p>home</p> }\n");
    writeFileSync(join(dir, "src/pages/team/_layout.jsx"), "export default function L(p) { return <section>{p.children}</section> }\n");
    writeFileSync(join(dir, "src/pages/team/index.jsx"), "export default function Team() { return <p>team</p> }\n");
    writeFileSync(join(dir, "src/main.jsx"), "import routes from './routes.gen.js'\ncreateRouter({ routes })\nrender(() => <Router />, document.getElementById('app'))\n");
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    writeFileSync(join(dir, "march.config.js"), "export default { base: \"./\", stableNames: true }\n");
    const files = () => { const out = new Map(); const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else out.set(p.slice(dir.length), readFileSync(p, "utf8")); } }; walk(join(dir, "dist")); return out; };
    execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" });
    const one = files();
    for (const p of one.keys()) for (const seg of p.split(/[\/]/).filter(Boolean)) assert.doesNotMatch(seg, /^[_.]/, `${p}: no name starts with _ or .`);
    for (const p of one.keys()) if (/\.(js|css)$/.test(p)) assert.doesNotMatch(p, /-[A-Z0-9]{8}\.(js|css)$/, `${p} has no hash in its name`);
    const html = one.get([...one.keys()].find((p) => p.endsWith("index.html")));
    assert.match(html, /src="\.\/assets\/main\.js\?v=[A-Z0-9]{6}"/);
    for (const [p, code] of one) if (p.endsWith(".js")) for (const m of code.matchAll(/["'](\.{1,2}\/[^"']+\.(?:js|css))(\?v=[A-Z0-9]+)?["']/g)) assert.ok(m[2], `${p}: ${m[1]} carries ?v=`);
    execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" });
    const two = files();
    assert.deepEqual([...two.keys()].sort(), [...one.keys()].sort(), "same paths");
    for (const [p, code] of one) assert.equal(two.get(p), code, `${p}: same bytes when nothing changed`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("console banner: dev client prints one line once per page; banner: false removes it; production bundles stay free of it", async () => {
  const { bannerSource } = await import("../cli/banner.js");
  const { MARCH_URL } = await import("../src/brand.js");
  const { runInNewContext } = await import("node:vm");
  // once: running the source twice in one page logs one line (re-mounts / repeated evaluation)
  const logs = [];
  const sandbox = { console: { log: (...a) => logs.push(a) }, globalThis: null };
  sandbox.globalThis = sandbox;
  const src = bannerSource("0.1.0", "a tip");
  runInNewContext(src, sandbox); runInNewContext(src, sandbox);
  assert.equal(logs.length, 2, "banner line + tip line, once");
  assert.match(logs[0][0], /^%c🧡 HADI March v0\.1 · /);
  assert.ok(logs[0][0].includes(MARCH_URL), "same constant as the badge");
  assert.match(logs[0][1], /color/);
  assert.equal(logs[1][0], "a tip");

  const dir = mkdtempSync(join(tmpdir(), "march-banner-"));
  const buildJs = (cfg) => {
    writeFileSync(join(dir, "march.config.js"), `export default ${cfg}\n`);
    execFileSync(process.execPath, [CLI, "build"], { cwd: dir, stdio: "pipe" });
    const files = readdirSync(join(dir, "dist/assets"), { recursive: true }).filter((f) => f.endsWith(".js"));
    return { files, text: files.map((f) => readFileSync(join(dir, "dist/assets", f), "utf8")).join("\n"), html: readFileSync(join(dir, "dist/index.html"), "utf8"), dist: readdirSync(join(dir, "dist")) };
  };
  try {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src/main.jsx"), "render(() => <p>hi</p>, document.getElementById('app'))\n");
    writeFileSync(join(dir, "package.json"), "{\"type\":\"module\"}");
    // production default: nothing printed, no banner code in any bundle, no extra file, size identical with banner: false
    const a = buildJs("{}"), b = buildJs("{ banner: false }");
    assert.doesNotMatch(a.text, /HADI March v|hadi-march\.banner/);
    assert.equal(a.text.length, b.text.length, "banner config changes no production byte");
    assert.ok(!a.dist.includes("credit.js") && !/credit\.js/.test(a.html));
    // credit: true prints in production too, from a separate tiny file (the bundle is untouched)
    const c = buildJs("{ credit: true }");
    assert.equal(c.text.length, a.text.length, "the app bundle is the same size with credit");
    assert.ok(c.dist.includes("credit.js") && /<script src="\.?\/?credit\.js"><\/script>/.test(c.html));
    const credit = readFileSync(join(dir, "dist/credit.js"), "utf8");
    assert.ok(credit.length < 400, `credit.js is tiny (${credit.length} B)`);
    const l2 = []; const sb = { console: { log: (...x) => l2.push(x) } }; sb.globalThis = sb;
    runInNewContext(credit, sb); runInNewContext(credit, sb);
    assert.equal(l2.length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }

  // dev: the served client starts with the banner; banner: false serves the client alone
  const { spawn } = await import("node:child_process");
  const serve = async (cfg, port) => {
    const d = mkdtempSync(join(tmpdir(), "march-banner-dev-"));
    mkdirSync(join(d, "src"), { recursive: true });
    writeFileSync(join(d, "src/main.jsx"), "render(() => <p>hi</p>, document.getElementById('app'))\n");
    writeFileSync(join(d, "package.json"), "{\"type\":\"module\"}");
    writeFileSync(join(d, "march.config.js"), `export default ${cfg}\n`);
    const child = spawn(process.execPath, [CLI, "dev", "--port", String(port)], { cwd: d, stdio: "pipe" });
    try {
      let text = null;
      for (let i = 0; i < 60 && text === null; i++) {
        await new Promise((r) => setTimeout(r, 250));
        try { text = await (await fetch(`http://127.0.0.1:${port}/__march/client.js`)).text(); } catch { /* not up yet */ }
      }
      return text;
    } finally { child.kill(); await new Promise((r) => setTimeout(r, 500)); try { rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* temp dir, the OS cleans it */ } }
  };
  const on = await serve("{}", 5391), off = await serve("{ banner: false }", 5392);
  assert.match(on, /^if \(!globalThis\[Symbol\.for\("hadi-march\.banner"\)\]\)/);
  assert.ok(on.includes("EventSource"));
  assert.doesNotMatch(off, /HADI March v/);
  assert.ok(off.startsWith("// March dev client"));
});
