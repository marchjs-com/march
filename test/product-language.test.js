// Open-source product language: the showcase, the docs and every file that ships in the package speak about March,
// never about the people or the internal process behind it (no names, no "the founder asked", no session or branch
// talk, no roadmap chatter). Internal planning lives in docs/internal/ (a private repository checked out there: not in this repository, not packaged, not published).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FORBIDDEN = [
  /kurucu/i, /\bfounders?\b/i, /tolgahan/i, /\bclaude\b/i, /\bdevs (oturum|session)/i, /isteğiyle/i, /\bfeat\/[a-z]/i,
  /ileride .{0,40}eklenecek/i, /will be added later/i, /\bparallel branch/i, /\bour team\b/i, /iç ekip/i,
  // the product is a framework, not "a UI library"
  /arayüz kitaplığı/i, /\bUI library\b/i,
];
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === "node_modules" || n === "dist" || n === "internal" ? [] : walk(p)) : [p]; });
const TEXT = /\.(ts|tsx|js|mjs|jsx|css|md|json|txt|html)$/;

/** What ships or is shown: package "files", public docs and the AI guide. */
function published() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const roots = [...pkg.files, "AI_INSTRUCTIONS.md", "llms.txt", "CHANGELOG.md", "docs"];
  // generated icon packs (march icons add) list third-party icon names, brand names included: data, not our wording
  const iconData = /icons[\\/]packs[\\/][^\\/]+[\\/]index\.(js|d\.ts)$/;
  return roots.map((r) => join(ROOT, r)).filter(existsSync).flatMap((p) => (statSync(p).isDirectory() ? walk(p) : [p])).filter((f) => TEXT.test(f) && !iconData.test(f));
}

// names used on purpose, allowed in those files only
const DEMO_NAMES = new Map([
  // the AI providers' product names (march/ai, its panels): which service a key is for, not who wrote the code
  ["\\bclaude\\b", /src[\\/](ai[\\/]|components[\\/]composite[\\/]app-ui[\\/]ai)/]]);

test("published files use product language only", () => {
  const hits = [];
  for (const f of published()) {
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      for (const re of FORBIDDEN) if (re.test(line) && !DEMO_NAMES.get(re.source)?.test(f)) hits.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(hits, []);
});

test("internal planning documents are not packaged", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.ok(!pkg.files.some((f) => f.startsWith("docs")), "docs/ is not in package files");
  assert.ok(!existsSync(join(ROOT, "docs/parallel.md")) && !existsSync(join(ROOT, "docs/roadmap.md")));
});
