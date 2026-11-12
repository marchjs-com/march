#!/usr/bin/env node
// The files of a built showcase (or any March dist/) for publishing as a claude.ai artifact: index.html is the page,
// everything else goes in the artifact's `files` map — the assets, the public files and, for normal addresses, every
// <route>/index.html, 404.html and march-404.js, so a reload of a sub-page address finds its page.
//
//   node tools/artifact-files.mjs [dist] [--json]     prints { "motion/index.html": "<abs path>", … } (--json) or a list
//
// In the artifact the page runs inside an iframe. Where the frame may change its address the router uses normal
// addresses; a reload of the whole page loads the frame's own src again (the start page) and the showcase returns to
// the page it showed (src/frame-reload.ts). Where it may not (a sandbox with an opaque origin) the router uses #/
// addresses, which a reload keeps. Neither case breaks a page.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
const dist = resolve(arg ?? join(ROOT, "examples/showcase/dist"));
if (!existsSync(join(dist, "index.html"))) { console.error(`✖ ${dist}/index.html is missing: build first (node examples/showcase/build.mjs)`); process.exit(2); }
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
// build side files the page never loads
const SKIP = /^(i18n-keys\.json|march-report\.json\.map)$/;
const files = walk(dist).map((p) => relative(dist, p).split("\\").join("/")).filter((p) => p !== "index.html" && !SKIP.test(p)).sort();
if (process.argv.includes("--json")) console.log(JSON.stringify(Object.fromEntries(files.map((p) => [p, join(dist, p)])), null, 2));
else {
  const pages = files.filter((p) => p.endsWith("index.html"));
  for (const p of files) console.log(p);
  console.error(`${files.length} files besides index.html (${pages.length} page folders, ${files.includes("404.html") ? "404.html" : "no 404.html"})`);
}
