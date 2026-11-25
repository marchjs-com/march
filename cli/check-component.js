// `march check component <name>`: the per-component checklist (docs/component-checklist.md) that can be checked from
// the source. Browser checks (RTL mirror, keyboard walk, contrast, overflow at 320–1440 px) run on the component's page
// on the site (marchjs.com); this command lists them as "browser" items so nothing is forgotten.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const STATUS = new Set(["stable", "experimental", "deprecated"]);
// physical properties that break RTL (use the logical ones: inset-inline-start, margin-inline-end …)
const PHYSICAL = /(?:^|[;{\s])(margin-left|margin-right|padding-left|padding-right|left|right|border-left|border-right|text-align:\s*(?:left|right)|float:\s*(?:left|right))\s*:/m;

/**
 * @param {string} root  repository root (contains src/components)
 * @param {string} name  folder: "<category>/<name>" or just "<name>" (looked up in the category folders)
 * @returns {Promise<{ ok: boolean, results: { item: string, ok: boolean | null, note?: string }[] }>}  ok null = browser check
 */
export async function checkComponent(root, folder, { runTests = true } = {}) {
  const base = join(root, "src/components");
  if (!folder.includes("/") && existsSync(base)) folder = readdirSync(base).map((c) => `${c}/${folder}`).find((f) => existsSync(join(base, f, "meta.ts"))) ?? folder;
  const dir = join(base, folder);
  const [category, name] = folder.includes("/") ? folder.split("/") : [undefined, folder];
  const results = [];
  const add = (item, ok, note) => results.push({ item, ok, note });
  if (!existsSync(dir) || !category) return { ok: false, results: [{ item: "folder", ok: false, note: `src/components/<category>/${name} not found` }] };
  const files = readdirSync(dir);
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : "");
  for (const f of ["index.ts", `${name}.css`, `${name}.test.js`, "docs.md", "meta.ts"]) add(`file ${f}`, files.includes(f), files.includes(f) ? undefined : "missing (CSS may be absent only for components without styles)");
  const code = read("index.ts"), css = read(`${name}.css`), docs = read("docs.md");

  // meta: stability + composedOf, and every composed component is really used (reuse, not a copy)
  let meta = null;
  try { meta = (await import(pathToFileURL(join(dir, "meta.ts")).href)).default; } catch (e) { add("meta.ts loads", false, e.message); }
  if (meta) {
    add("meta: status stable / experimental / deprecated", STATUS.has(meta.status), meta.status);
    add("meta: category matches the folder", meta.category === category, `meta.category "${meta.category}", folder ${category}/`);
    add("meta: composedOf is a list", Array.isArray(meta.composedOf));
    if (category === "composite") add("meta: a composite names its parts (composedOf)", (meta.composedOf ?? []).length > 0);
    // the component's own modules count too (tabs or panels split out of index.ts and loaded lazily); not meta
    const own = files.filter((f) => /\.tsx?$/.test(f) && !/^(meta|tr)\.tsx?$/.test(f)).map(read).join("\n");
    for (const c of meta.composedOf ?? []) add(`composedOf ${c} is used (not copied)`, new RegExp(`\\b${c}\\b`).test(own), "named in meta but not imported / used in the component's modules");
  }
  // security and CSP
  add("no innerHTML / outerHTML / insertAdjacentHTML", !/\b(innerHTML|outerHTML|insertAdjacentHTML)\b/.test(code));
  // (Intl's `style: "percent" | "currency" | "decimal" | "unit"` is a number format, not a style attribute)
  add("no string styles (CSP: style attribute strings)", !/style:\s*["'`](?!(?:percent|currency|decimal|unit)["'`])|\.style\.cssText|setAttribute\(\s*["']style/.test(code));
  add("no eval / new Function", !/\beval\(|new Function\(/.test(code));
  // i18n: user-facing literal strings go through t``
  const literals = [...code.matchAll(/"(aria-label|title|placeholder|alt)":\s*"([^"]+)"/g)].map((m) => m[2]);
  add("i18n: accessible names use t``", literals.length === 0, literals.join(", "));
  // CSS: prefix, theme tokens, RTL, motion core
  if (css) {
    const classes = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c));
    const foreign = [...new Set(classes.filter((c) => !c.startsWith("m-") && !c.startsWith("is-")))];
    add("CSS: classes start with m- (state: is-)", foreign.length === 0, foreign.join(", "));
    // m- is short: never a name other libraries use for margin utilities (m-0 … m-5, m-auto, m-px)
    const margin = [...new Set(classes.filter((c) => /^m-(\d[\d.]*|auto|px)$/.test(c)))];
    add("CSS: no margin-utility names (m-0, m-auto)", margin.length === 0, margin.join(", "));
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    add("CSS: colours from theme tokens (no hex / rgb literals)", !/#[0-9a-fA-F]{3,8}\b|\brgba?\(/.test(noComments));
    add("CSS: logical properties (RTL)", !PHYSICAL.test(noComments), noComments.match(PHYSICAL)?.[1]);
    add("CSS: no new @keyframes (motion core)", !/@keyframes/.test(noComments));
    add("CSS: durations from tokens (reduced motion)", !/\b(transition|animation)[^;]*\b\d+(\.\d+)?m?s\b/.test(noComments));
  }
  // docs
  for (const s of ["## Props", "## Accessibility"]) add(`docs.md: ${s}`, docs.includes(s));
  // tests
  if (runTests && files.includes(`${name}.test.js`)) {
    const r = spawnSync(process.execPath, ["--import", pathToFileURL(join(root, "compiler/register.js")).href, "--test", join(dir, `${name}.test.js`)], { cwd: root, encoding: "utf8" });
    add("tests pass", r.status === 0, r.status === 0 ? undefined : (r.stdout + r.stderr).split("\n").filter((l) => /✖|Error/.test(l)).slice(0, 3).join(" | "));
  }
  // browser checks (the site's component pages): listed, not run here
  for (const b of ["theme + accent in light and dark", "RTL mirror", "keyboard only", "reduced motion", "overflow 320–1440 px", "lazy + placeholder", "budget"]) add(`browser: ${b}`, null);
  return { ok: results.every((r) => r.ok !== false), results };
}

export function printCheck(name, { ok, results }) {
  for (const r of results) console.log(`${r.ok === null ? "\x1b[90m·" : r.ok ? "\x1b[32m✔" : "\x1b[31m✖"}\x1b[0m ${r.item}${r.ok === false && r.note ? ` — ${r.note}` : ""}`);
  console.log(ok ? `\x1b[32m✔\x1b[0m ${name}: source checks pass` : `\x1b[31m✖\x1b[0m ${name}: ${results.filter((r) => r.ok === false).length} problem(s)`);
}

