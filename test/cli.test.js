import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
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
