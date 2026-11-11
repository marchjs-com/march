// Auto-import table: every export of March's modules (core first) plus project components.
// `loadAutoImports()` reads the real module exports, so the table never drifts from the runtime.
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
/** Module specifier → file (relative to the March root). Order = priority when two modules export the same name. */
export const MODULES = [
  ["hadi-march", "src/index.js"],
  ["hadi-march/store", "src/store/index.ts"],
  ["hadi-march/i18n", "src/i18n/index.ts"],
  ["hadi-march/ui", "src/ui/index.js"],
  ["hadi-march/data", "src/data/index.js"],
  ["hadi-march/router", "src/router/index.ts"],
  ["hadi-march/schema", "src/schema/index.js"],
  ["hadi-march/table", "src/table/index.js"],
  ["hadi-march/crud", "src/crud/index.js"],
  ["hadi-march/charts", "src/charts/index.js"],
  ["hadi-march/motion", "src/motion/index.ts"],
  ["hadi-march/fx", "src/fx/index.ts"],
];

/**
 * @param {{ specifier?: (spec: string, file: string) => string, components?: string|string[] }} [o]
 *   specifier: how imports are written (default: the bare "hadi-march/…" specifier)
 *   components: directories whose `Name.jsx` files are auto-imported as `Name`
 */
export async function loadAutoImports(o = {}) {
  const map = Object.create(null);
  for (const [spec, rel] of MODULES) {
    const file = join(ROOT, rel);
    if (!existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href);
    for (const name of Object.keys(mod)) {
      if (name.startsWith("_") || name === "default" || name in map) continue;
      map[name] = o.specifier ? o.specifier(spec, file) : spec;
    }
  }
  for (const dir of [].concat(o.components ?? [])) {
    if (!existsSync(dir)) continue;
    for (const f of walk(dir)) {
      const name = basename(f, extname(f));
      if (!/^[A-Z][\w]*$/.test(name) || !/\.(jsx|tsx|js|ts)$/.test(f) || f.endsWith(".d.ts") || name in map) continue;
      // `export function Name` → named import; otherwise (export default) → default import ("#default" marker)
      const src = readFileSync(f, "utf8");
      const named = new RegExp(`export\\s+(async\\s+)?(function|const|let|class)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`).test(src);
      map[name] = named ? f : `${f}#default`;
    }
  }
  return map;
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

export const MARCH_ROOT = ROOT;
