// Load March's own TypeScript sources from node, also when the package is installed under node_modules.
// Node strips types natively, except for files under node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), which is
// exactly where an installed March lives. Two ways around it, both without module hooks inside hooks threads:
//  - importTs (compiler: sx, auto-import table): imports from a mirror of March's src/ in the OS temp folder (outside
//    node_modules, so node strips types itself). The mirror is keyed by the sources' sizes and mtimes and built once.
//  - stripTypes (march/register's load hook): strips the types of a single file with module.stripTypeScriptTypes.
import { readdirSync, statSync, existsSync, cpSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as nodeModule from "node:module";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

// March components import their own CSS (`import "./button.css"`; the esbuild plugin bundles it). When node itself loads
// March's sources (the compiler reads the auto-import table from src/*/index.ts) those imports are no-ops. In-thread sync
// hooks; none next to march/register's hooks (hooks-flag.js): there node-loader.js stubs .css, and node 22 crashes
// chaining a sync load hook into them (loadSync is not a function).
if (!globalThis[Symbol.for("march.asyncHooks")]) try {
  nodeModule.registerHooks?.({
    load(url, context, next) { return url.startsWith("file:") && /\.css(\?.*)?$/.test(url) ? { format: "module", source: "", shortCircuit: true } : next(url, context); },
  });
} catch { /* hooks thread */ }

/** True for file URLs/paths inside a node_modules folder (node refuses to strip types there). */
export const inNodeModules = (fileOrUrl) => /[\\/]node_modules[\\/]/.test(fileOrUrl.startsWith("file:") ? fileURLToPath(fileOrUrl) : fileOrUrl);
/** A .ts module (not .d.ts) under node_modules. */
export const isNodeModulesTs = (url) => url.startsWith("file:") && url.endsWith(".ts") && !url.endsWith(".d.ts") && inNodeModules(url);

/** Strip TypeScript types from source code (erasable syntax only), using node's built-in stripper. */
export function stripTypes(source, filename) {
  const strip = nodeModule.stripTypeScriptTypes;
  if (typeof strip !== "function") throw new Error(`March: node ${process.versions.node} cannot strip TypeScript types (${filename}); use node >= 22.18.`);
  return strip(source, { mode: "strip" });
}

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let mirrorDir = null;
/** March's src/ copied to the OS temp folder (once per source state); returns the mirror's root. */
function mirror() {
  if (mirrorDir) return mirrorDir;
  const src = join(ROOT, "src");
  const h = createHash("sha256").update(ROOT);
  for (const f of walk(src)) { const s = statSync(f); h.update(`${relative(src, f)}|${s.size}|${s.mtimeMs}\n`); }
  const dir = join(tmpdir(), `march-src-${h.digest("hex").slice(0, 16)}`);
  if (!existsSync(join(dir, ".complete"))) {
    // build in a private folder, then rename: parallel processes (node --test) never see a half-copied mirror
    const tmp = `${dir}.${process.pid}.${Date.now()}`;
    mkdirSync(tmp, { recursive: true });
    cpSync(src, join(tmp, "src"), { recursive: true });
    writeFileSync(join(tmp, "package.json"), "{\"type\":\"module\"}\n");
    writeFileSync(join(tmp, ".complete"), "");
    try { renameSync(tmp, dir); } catch { rmSync(tmp, { recursive: true, force: true }); }
    if (!existsSync(join(dir, ".complete"))) throw new Error(`March: could not prepare ${dir}`);
  }
  return (mirrorDir = dir);
}

/** Import one of March's own .ts modules (a URL inside March's src/), also when March is under node_modules. */
export function importTs(url) {
  const file = fileURLToPath(url);
  if (!inNodeModules(file)) return import(url.href);
  const rel = relative(ROOT, file);
  if (rel.startsWith("..") || !rel.startsWith(`src${sep}`)) throw new Error(`March: importTs only loads March's src/ (${file})`);
  return import(pathToFileURL(join(mirror(), rel)).href);
}
