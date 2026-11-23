#!/usr/bin/env node
// March's type declarations for MarchIDE's TypeScript (the app-ui TypeScript worker): every package export's .d.ts
// (TypeScript's declaration emit, in memory), March's JSX types and a package.json whose exports point at them, as one
// JSON file the worker reads on demand: { "/node_modules/march/<path>": text }. With it `march/ui`, `march/table`…
// are their real types in the editor (props, hover, completions, errors); without it every march import is `any`.
//   node tools/gen-ide-types.mjs <out.json>      (tools/cdn-data.mjs: data/ide/march-types.json)
// It writes again only when a source under src/ or types/jsx.d.ts changed (a stamp of their sizes
// and times beside the output).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (!process.argv[2]) { console.error("usage: node tools/gen-ide-types.mjs <out.json>"); process.exit(2); }
const OUT = resolve(process.argv[2]);
const BASE = "/node_modules/march/";
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

// the stamp: every source file's path, size and time
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [join(d, e.name)] : []));
const sources = [...walk(join(ROOT, "src")), join(ROOT, "types/jsx.d.ts"), join(ROOT, "package.json")];
const stamp = createHash("sha1").update(sources.map((f) => { const s = statSync(f); return `${rel(f)}:${s.size}:${s.mtimeMs}`; }).join("\n")).digest("hex");
const STAMP = `${OUT}.stamp`;
if (existsSync(OUT) && existsSync(STAMP) && readFileSync(STAMP, "utf8") === stamp) { console.log("✔ ide types up to date"); process.exit(0); }

const t0 = Date.now();
const ts = (await import("typescript")).default;
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const target = (v) => (typeof v === "string" ? v : v?.types ?? v?.import ?? v?.default);
// every component folder is an entry too: MarchIDE imports one by its folder name (march/components/data-grid)
const COMP = join(ROOT, "src/components");
const folders = readdirSync(COMP, { withFileTypes: true }).filter((d) => d.isDirectory())
  .flatMap((c) => readdirSync(join(COMP, c.name), { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(COMP, c.name, d.name, "index.ts"))).map((d) => `${c.name}/${d.name}`));
const entries = [...Object.values(pkg.exports).map(target).filter((v) => typeof v === "string" && /\.tsx?$/.test(v)).map((v) => join(ROOT, v.replace(/^\.\//, ""))),
  ...folders.map((f) => join(COMP, f, "index.ts"))];
const program = ts.createProgram(entries, {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.Preserve,
  declaration: true, emitDeclarationOnly: true, allowImportingTsExtensions: true, skipLibCheck: true, strict: true, noEmitOnError: false,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"], types: [],
});
const files = {};
program.emit(undefined, (name, text) => { files[BASE + rel(name)] = text; });
// March's JSX types (they import the sources by .ts path: served as their declarations)
files[`${BASE}types/jsx.d.ts`] = readFileSync(join(ROOT, "types/jsx.d.ts"), "utf8");
// the package: its exports point at the declarations
const dts = (p) => p.replace(/^\.\//, "./").replace(/\.tsx?$/, ".d.ts");
const exportsOut = Object.fromEntries(Object.entries(pkg.exports).filter(([k]) => !k.includes("*")).map(([k, v]) => [k, typeof target(v) === "string" && /\.tsx?$/.test(target(v)) ? { types: dts(target(v)) } : v]));
// a component by its folder name (as MarchIDE resolves it) or by category/name; an icon pack by its id
for (const f of folders) { const t = { types: `./src/components/${f}/index.d.ts` }; exportsOut[`./components/${f}`] = t; exportsOut[`./components/${f.split("/")[1]}`] ??= t; }
exportsOut["./icons/*"] = { types: "./src/icons/packs/*/index.d.ts" };
// the packs' own declarations (12–224 KB each) are files of their own beside the JSON: the worker reads one when code
// imports that pack (march-icons/<id>.d.ts)
const PACKS = join(ROOT, "src/icons/packs");
mkdirSync(join(dirname(OUT), "march-icons"), { recursive: true });
for (const id of readdirSync(PACKS)) { const p = join(PACKS, id, "index.d.ts"); if (existsSync(p)) writeFileSync(join(dirname(OUT), "march-icons", `${id}.d.ts`), readFileSync(p, "utf8")); }
files[`${BASE}package.json`] = JSON.stringify({ name: "march", version: pkg.version, type: "module", exports: exportsOut });
// MarchIDE's march/testing: the package's renderTest and the rest, plus the test runner the IDE adds (test, it, expect;
// the site's playground preview runtime)
files["/march-ide-testing.d.ts"] = `import "march/testing";
declare module "march/testing" {
  interface IdeMatchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toContain(expected: unknown): void;
    toBeGreaterThan(n: number): void;
    toThrow(): void;
  }
  /** A test case: run in the Tests panel after every build. */
  export function test(name: string, fn: () => unknown): void;
  export function it(name: string, fn: () => unknown): void;
  /** Assertions: toBe, toEqual, toBeTruthy, toBeFalsy, toContain, toBeGreaterThan, toThrow; \`.not\` turns each one. */
  export function expect(actual: unknown): IdeMatchers & { not: IdeMatchers };
}
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(files));
writeFileSync(STAMP, stamp);
const size = Object.values(files).reduce((n, t) => n + t.length, 0);
console.log(`✔ ide types: ${Object.keys(files).length} files, ${Math.round(size / 1024)} KB in ${Date.now() - t0} ms`);
