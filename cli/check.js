// `march check`: type-check a March app, including the syntax TypeScript cannot parse (pipes, event modifiers,
// shorthand attributes). Every .tsx is compiled in "typecheck" mode (component props stay plain values so they are
// checked against the component's parameter type; bind: becomes value + setter) into .march/check/, .ts files are
// copied, and tsc runs there. Line numbers are preserved by the compiler, so errors point at the original source.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname, sep } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { compile } from "../compiler/index.js";
import { loadAutoImports, MARCH_ROOT } from "../compiler/autoimports.js";

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === "node_modules" || n.startsWith(".") ? [] : walk(p)) : [p]; });

async function loadTs(cwd) {
  for (const base of [join(cwd, "package.json"), join(MARCH_ROOT, "package.json")]) {
    try { const req = createRequire(base); return await import(pathToFileURL(req.resolve("typescript")).href).then((m) => m.default ?? m); } catch { /* next */ }
  }
  throw new Error("typescript is required for march check: npm i -D typescript");
}

/** @returns {Promise<number>} number of errors */
export async function check({ cwd = process.cwd(), srcDir = "src", components = "src/components", tsconfig = "tsconfig.json", log = console.log } = {}) {
  const ts = await loadTs(cwd);
  const src = resolve(cwd, srcDir), out = resolve(cwd, ".march", "check");
  rmSync(out, { recursive: true, force: true });
  const auto = await loadAutoImports({ components: resolve(cwd, components) });
  const files = walk(src).filter((f) => /\.(tsx|ts)$/.test(f) && !f.endsWith(".d.ts"));
  for (const f of walk(src).filter((x) => x.endsWith(".d.ts"))) { const t = join(out, relative(src, f)); mkdirSync(dirname(t), { recursive: true }); writeFileSync(t, readFileSync(f)); }
  const map = new Map();
  for (const f of files) {
    const target = join(out, relative(src, f)).replace(/\.tsx$/, ".tsx");
    mkdirSync(dirname(target), { recursive: true });
    const text = readFileSync(f, "utf8");
    if (f.endsWith(".tsx")) {
      try { writeFileSync(target, compile(text, { filename: f, autoImports: auto, typecheck: true }).code); }
      catch (e) { log(`${relative(cwd, f)}: ${e.message}`); return 1; }
    } else writeFileSync(target, text);
    map.set(resolve(target), f);
  }
  const base = existsSync(resolve(cwd, tsconfig)) ? ts.readConfigFile(resolve(cwd, tsconfig), ts.sys.readFile).config ?? {} : {};
  const options = ts.convertCompilerOptionsFromJson({ ...(base.compilerOptions ?? {}), noEmit: true, jsx: "preserve", allowJs: true, rootDir: undefined }, cwd).options;
  options.paths = { "hadi-march": [join(MARCH_ROOT, "src", "index.js")], "hadi-march/*": [join(MARCH_ROOT, "src", "*")] };
  const program = ts.createProgram([...map.keys()], options);
  const diags = ts.getPreEmitDiagnostics(program).filter((d) => !d.file || map.has(resolve(d.file.fileName)));
  for (const d of diags) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file) { log(`error: ${msg}`); continue; }
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
    log(`${relative(cwd, map.get(resolve(d.file.fileName))).split(sep).join("/")}:${line + 1}:${character + 1} - ${msg}`);
  }
  log(diags.length ? `\n${diags.length} type error(s)` : `✔ ${files.length} files type-checked`);
  return diags.length;
}
