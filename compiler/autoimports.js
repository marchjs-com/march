// Auto-import table: every export of March's modules (core first) plus project components.
// `loadAutoImports()` reads the real module exports, so the table never drifts from the runtime.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
/** Module specifier → file (relative to the March root). Order = priority when two modules export the same name. */
export const MODULES = [
  ["hadi-march", "src/index.js"],
  ["hadi-march/ui", "src/ui/index.js"],
  ["hadi-march/data", "src/data/index.js"],
  ["hadi-march/router", "src/router/index.js"],
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
      if (/^[A-Z][\w]*$/.test(name) && /\.(jsx|js)$/.test(f) && !(name in map)) map[name] = f;
    }
  }
  return map;
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

export const MARCH_ROOT = ROOT;
