// The CDN build (tools/build-cdn.js → cdn.marchjs.com): every browser entry as a module, one march.css with the tokens,
// an import map with absolute URLs, the file list deploys keep older versions with; no latest/ copy (the Worker redirects it).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const at = (p) => new URL(`cdn/dist/${p}`, root);

test("CDN build: modules, march.css, import map, file list, no latest/ copy", () => {
  execFileSync(process.execPath, [new URL("tools/build-cdn.js", root).pathname.replace(/^\/(\w:)/, "$1"), "--base", "https://cdn.example"], { stdio: "pipe" });
  for (const f of ["march.js", "ui.js", "app-ui.js", "icons.js", "behaviors/drag.js", "march.css", "css/tokens.css"]) assert.ok(existsSync(at(`${version}/${f}`)), f);
  assert.ok(!existsSync(at(`${version}/testing.js`)) && !existsSync(at(`${version}/compiler.js`)), "node-only entries stay out");
  // css/font.css points at ../fonts/; a module a barrel re-exports from is an entry of its own (march/mod/<path>)
  assert.ok(existsSync(at(`${version}/fonts/inter-latin.woff2`)), "the fonts");
  assert.ok(existsSync(at(`${version}/mod/ui/theme.js`)), "march/mod/ui/theme");
  // names.json: an entry's names; the smallest entry per name of a barrel
  const names = JSON.parse(readFileSync(at(`${version}/names.json`), "utf8"));
  assert.ok(names.exports["march/components/actions/button"].includes("Button"));
  assert.equal(names.best["march/ui"].Button, "march/components/actions/button");
  const css = readFileSync(at(`${version}/march.css`), "utf8");
  assert.match(css, /^\/\*! MarchJS v/);
  assert.match(css, /--m-accent:/, "the tokens are in");
  assert.match(css, /\.m-btn\{/, "the components' styles are in");
  assert.match(css, /\.m-color-danger\{/, "the sx utilities are in");
  const map = JSON.parse(readFileSync(at(`${version}/importmap.json`), "utf8")).imports;
  assert.equal(map["march"], `https://cdn.example/${version}/march.js`);
  assert.equal(map["march/ui"], `https://cdn.example/${version}/ui.js`);
  assert.ok(!existsSync(at("latest")), "latest/ is a redirect of the Worker, not a copy");
  const { files } = JSON.parse(readFileSync(at(`${version}/files.json`), "utf8"));
  assert.ok(files.includes("march.js") && files.includes("files.json") && files.every((f) => existsSync(at(`${version}/${f}`))), "files.json lists every file");
  // the modules share their chunks and import them relatively (no bare specifier left for a browser)
  assert.doesNotMatch(readFileSync(at(`${version}/ui.js`), "utf8"), /from"march/);
});
