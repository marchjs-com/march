// The showcase uses normal addresses under any base path: no "#/…" link or route anywhere in its source, no hash
// routing, no root-absolute link or file path, and public files (media/, demo-api/, march-report.json) only through
// appUrl() (a relative "media/x" would resolve against the route's address, not the app's root).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "examples/showcase/src");
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(n) && !/\.gen\.|routes\.gen/.test(n) ? [p] : []; });
const files = [...walk(SRC), join(ROOT, "src/components/social/demo-data.ts")].map((f) => ({ f: relative(ROOT, f).split("\\").join("/"), s: readFileSync(f, "utf8") }));
/** Source without code samples shown on the page (code={`…`} and code: `…` blocks show other apps' code). */
const live = (s) => s.replace(/code=\{`(?:[^`\\]|\\.)*`\}/g, "").replace(/\bcode:\s*`(?:[^`\\]|\\.)*`/g, "");
/** A line without its comments (a comment may describe the hash fallback). */
const code = (l) => l.replace(/\/\*.*?\*\//g, "").replace(/(^|\s)\/\/.*$/, "");
const hits = (re, { samples = false } = {}) => files.flatMap(({ f, s }) => (samples ? s : live(s)).split("\n").flatMap((l, i) => (re.test(code(l)) ? [`${f}:${i + 1}: ${l.trim().slice(0, 120)}`] : [])));

test("showcase: no #/ address in code (links, routes, page texts, code samples)", () => {
  assert.deepEqual(hits(/#\//, { samples: true }).filter((h) => !/\/\^#\\\//.test(h)), []);
});

test("showcase: history routing with an automatic base", () => {
  const main = readFileSync(join(SRC, "main.tsx"), "utf8");
  assert.match(main, /createRouter\(\{ mode: "history", base: "auto"/);
  assert.doesNotMatch(main, /mode: "hash"/);
  assert.match(main, /prerenderedFor\(el\)/, "the prerendered page is matched by its path, not by the hash");
});

test("showcase: no root-absolute link or file path; public files through appUrl()", () => {
  assert.deepEqual(hits(/<a\b[^>]*\shref="\/(?!\/)/), [], "a plain <a> to an app path: use <Link href> (the router adds the base)");
  assert.deepEqual(hits(/\s(src|poster|srcset)=["'`]\/(?!\/)/), [], "a root-absolute file path");
  assert.deepEqual(hits(/\s(src|poster)=["'`](\.\/)?(media|demo-api)\//), [], "a relative public file: appUrl(\"media/…\")");
  assert.deepEqual(hits(/\bfetch\(\s*["'`](?![a-z]+:)/), [], "fetch of a public file: fetch(appUrl(\"…\"))");
  assert.deepEqual(hits(/\bbase\s*=\s*["'`](?![a-z]+:)[^"'`]/), [], "an Api base under the app's root: appUrl(\"…\")");
  assert.deepEqual(hits(/location\.hash\b/).filter((h) => !h.startsWith("examples/showcase/src/perflog.ts")), [], "routes come from the router, not location.hash");
});
