#!/usr/bin/env node
// Showcase › Hız › Karşılaştırma: data the benchmark page fetches on demand (never part of a JS chunk).
//   public/bench/sources.json   each library's benchmark app source (the Code section shows what is measured)
//   public/bench/licenses.json  license texts of the packaged libraries
// `node tools/gen-bench.mjs --check` fails when a written file is out of date (test/bench-libs.test.js).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SC = join(ROOT, "examples/showcase");
const OUT = join(SC, "public/bench");
const check = process.argv.includes("--check");

/** Library id → source file and npm packages (keep in step with examples/showcase/src/bench/libs.ts). */
export const APPS = {
  vanilla: { src: "src/bench/apps/vanilla.ts", pkgs: [] },
  march: { src: "src/bench/apps/march.tsx", pkgs: [] },
  react: { src: "src/bench/apps/react.ts", pkgs: ["react", "react-dom", "scheduler"] },
};

const licenseText = (pkg) => {
  const dir = join(ROOT, "node_modules", pkg);
  const f = readdirSync(dir).find((n) => /^licen[cs]e(\.md|\.txt)?$/i.test(n));
  return f ? readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n").trim() : "";
};
const json = (x) => JSON.stringify(x, null, 1) + "\n";

const sources = Object.fromEntries(Object.entries(APPS).map(([id, a]) => [id, readFileSync(join(SC, a.src), "utf8").replace(/\r\n/g, "\n")]));
const march = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const licenses = [{ name: "HADI March", version: march.version, license: march.license, text: readFileSync(join(ROOT, "LICENSE"), "utf8").replace(/\r\n/g, "\n").trim() }];
for (const pkg of [...new Set(Object.values(APPS).flatMap((a) => a.pkgs))]) {
  const p = JSON.parse(readFileSync(join(ROOT, "node_modules", pkg, "package.json"), "utf8"));
  licenses.push({ name: pkg, version: p.version, license: p.license, text: licenseText(pkg) });
}

const files = { "sources.json": json(sources), "licenses.json": json(licenses) };
let stale = [];
for (const [name, text] of Object.entries(files)) {
  const path = join(OUT, name);
  const old = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (old === text) continue;
  if (check) stale.push(name);
  else { mkdirSync(OUT, { recursive: true }); writeFileSync(path, text); console.log(`wrote public/bench/${name}`); }
}
if (stale.length) { console.error(`out of date: ${stale.join(", ")} (node tools/gen-bench.mjs)`); process.exit(1); }
