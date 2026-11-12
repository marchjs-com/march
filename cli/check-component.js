// `march check component <name>`: the per-component checklist (docs/component-checklist.md) that can be checked from
// the source. Browser checks (RTL mirror, keyboard walk, contrast, overflow at 320–1440 px) run in
// tools/visual-audit.mjs; this command lists them as "browser" items so nothing is forgotten.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const STATUS = new Set(["stable", "experimental", "deprecated"]);
// physical properties that break RTL (use the logical ones: inset-inline-start, margin-inline-end …)
const PHYSICAL = /(?:^|[;{\s])(margin-left|margin-right|padding-left|padding-right|left|right|border-left|border-right|text-align:\s*(?:left|right)|float:\s*(?:left|right))\s*:/m;

/**
 * @param {string} root  repository root (contains src/components)
 * @param {string} name  folder name
 * @returns {Promise<{ ok: boolean, results: { item: string, ok: boolean | null, note?: string }[] }>}  ok null = browser check
 */
export async function checkComponent(root, name, { runTests = true } = {}) {
  // `drawer` or `overlays/drawer`: a component may sit in a category folder (src/components/<category>/<name>/)
  const base = join(root, "src/components");
  let dir = join(base, name);
  if (!existsSync(join(dir, "meta.ts")) && existsSync(base)) {
    const hit = readdirSync(base).map((c) => join(base, c, name)).find((d) => existsSync(join(d, "meta.ts")));
    if (hit) dir = hit;
  }
  name = name.split("/").pop();
  const results = [];
  const add = (item, ok, note) => results.push({ item, ok, note });
  if (!existsSync(dir)) return { ok: false, results: [{ item: "folder", ok: false, note: `src/components/${name} not found` }] };
  const files = readdirSync(dir);
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
  for (const f of ["index.ts", `${name}.css`, `${name}.test.js`, "docs.md", "demo.tsx", "playground.ts", "meta.ts"]) add(`file ${f}`, files.includes(f), files.includes(f) ? undefined : "missing (CSS may be absent only for components without styles)");
  const code = read("index.ts"), css = read(`${name}.css`), docs = read("docs.md"), demo = read("demo.tsx");

  // meta: stability + composedOf, and every composed component is really used (reuse, not a copy)
  let meta = null;
  try { meta = (await import(pathToFileURL(join(dir, "meta.ts")).href)).default; } catch (e) { add("meta.ts loads", false, e.message); }
  if (meta) {
    add("meta: status stable / experimental / deprecated", STATUS.has(meta.status), meta.status);
    add("meta: composedOf is a list", Array.isArray(meta.composedOf));
    for (const c of meta.composedOf ?? []) add(`composedOf ${c} is used (not copied)`, new RegExp(`\\b${c}\\b`).test(code), "named in meta but not imported / used in index.ts");
  }
  // security and CSP
  add("no innerHTML / outerHTML / insertAdjacentHTML", !/\b(innerHTML|outerHTML|insertAdjacentHTML)\b/.test(code));
  add("no string styles (CSP: style attribute strings)", !/style:\s*["'`]|\.style\.cssText|setAttribute\(\s*["']style/.test(code));
  add("no eval / new Function", !/\beval\(|new Function\(/.test(code));
  // i18n: user-facing literal strings go through t``
  const literals = [...code.matchAll(/"(aria-label|title|placeholder|alt)":\s*"([^"]+)"/g)].map((m) => m[2]);
  add("i18n: accessible names use t``", literals.length === 0, literals.join(", "));
  // CSS: prefix, theme tokens, RTL, motion core
  if (css) {
    const classes = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c));
    const foreign = [...new Set(classes.filter((c) => !c.startsWith("hm-") && !c.startsWith("is-")))];
    add("CSS: classes start with hm- (state: is-)", foreign.length === 0, foreign.join(", "));
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    add("CSS: colours from theme tokens (no hex / rgb literals)", !/#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(noComments));
    add("CSS: logical properties (RTL)", !PHYSICAL.test(noComments), noComments.match(PHYSICAL)?.[1]);
    add("CSS: no new @keyframes (motion core)", !/@keyframes/.test(noComments));
    add("CSS: durations from tokens (reduced motion)", !/\b(transition|animation)[^;]*\b\d+(\.\d+)?m?s\b/.test(noComments));
  }
  // docs
  for (const s of ["## Props", "## Accessibility"]) add(`docs.md: ${s}`, docs.includes(s));
  // playground: every option has an effect in the demo
  try {
    const pg = (await import(pathToFileURL(join(dir, "playground.ts")).href)).default;
    for (const o of pg.options ?? []) add(`playground option "${o.key}" is used by demo.tsx`, new RegExp(`\\.${o.key}\\b`).test(demo));
  } catch (e) { add("playground.ts loads", false, e.message); }
  // tests
  if (runTests && files.includes(`${name}.test.js`)) {
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(join(root, "compiler/register.js")).href, "--test", join(dir, `${name}.test.js`)], { cwd: root, encoding: "utf8" });
    add("tests pass", r.status === 0, r.status === 0 ? undefined : (r.stdout + r.stderr).split("\n").filter((l) => /✖|Error/.test(l)).slice(0, 3).join(" | "));
  }
  // browser checks (tools/visual-audit.mjs and the showcase): listed, not run here
  for (const b of ["theme + accent in light and dark", "RTL mirror", "keyboard only", "reduced motion", "overflow 320–1440 px", "lazy + placeholder", "budget"]) add(`browser: ${b}`, null);
  return { ok: results.every((r) => r.ok !== false), results };
}

export function printCheck(name, { ok, results }) {
  for (const r of results) console.log(`${r.ok === null ? "\x1b[90m·" : r.ok ? "\x1b[32m✔" : "\x1b[31m✖"}\x1b[0m ${r.item}${r.ok === false && r.note ? ` — ${r.note}` : ""}`);
  console.log(ok ? `\x1b[32m✔\x1b[0m ${name}: source checks pass` : `\x1b[31m✖\x1b[0m ${name}: ${results.filter((r) => r.ok === false).length} problem(s)`);
}

