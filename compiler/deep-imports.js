// Barrel → direct imports. `import { NavSidebar, toast } from "hadi-march/ui"` becomes
//   import { NavSidebar } from "<march>/src/components/composite/nav-sidebar/index.ts"; import { toast } from "<march>/src/ui/toast.ts";
// Tree shaking drops unused exports either way, but code splitting decides chunks by which FILES an entry reaches:
// through a barrel the entry "reaches" every module (forms, editors, date pickers…) and esbuild puts the ones pages
// share with it into a chunk the entry must load. Direct imports keep the entry to what it really uses.
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const cache = new Map();

/** Exported names of a module → the file that defines them (follows `export … from` and `export * from`). */
export function exportMap(file, seen = new Set()) {
  if (cache.has(file)) return cache.get(file);
  const map = new Map();
  if (seen.has(file) || !existsSync(file)) return map;
  seen.add(file);
  const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const rel = (spec) => resolve(dirname(file), spec);
  for (const m of src.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|enum)\s+([A-Za-z_$][\w$]*)/g)) map.set(m[1], file);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}\s*(?:from\s*(["'])([^"']+)\2)?/g)) {
    if (/^\s*type\b/.test(src.slice(m.index + 6, m.index + 12))) continue;
    const from = m[3] ? rel(m[3]) : file;
    for (const part of m[1].split(",")) {
      const p = part.trim();
      if (!p || p.startsWith("type ")) continue;
      const [orig, alias] = p.split(/\s+as\s+/).map((x) => x.trim());
      const name = alias ?? orig;
      // a re-export keeps pointing at the module that has it; a renamed re-export stays on this file (alias)
      map.set(name, m[3] && !alias ? (exportMap(from, seen).get(orig) ?? from) : file);
    }
  }
  for (const m of src.matchAll(/export\s*\*\s*from\s*(["'])([^"']+)\1/g)) for (const [k, v] of exportMap(rel(m[2]), seen)) if (!map.has(k)) map.set(k, v);
  cache.set(file, map);
  return map;
}

/**
 * Rewrite named imports from March barrels to the defining modules.
 * @param {string} code
 * @param {Record<string, string>} barrels  specifier → absolute index file
 */
export function deepImports(code, barrels) {
  return code.replace(/import\s*\{([^}]*)\}\s*from\s*(["'])(hadi-march(?:\/[\w-]+)?)\2\s*;?/g, (all, list, q, spec) => {
    const index = barrels[spec];
    if (!index) return all;
    const map = exportMap(index);
    const groups = new Map(), keep = [];
    for (const part of list.split(",")) {
      const p = part.trim();
      if (!p) continue;
      if (p.startsWith("type ")) { keep.push(p); continue; }
      const orig = p.split(/\s+as\s+/)[0].trim();
      const target = map.get(orig);
      if (!target || target === index) { keep.push(p); continue; }
      (groups.get(target) ?? groups.set(target, []).get(target)).push(p);
    }
    if (!groups.size) return all;
    const out = [...groups].map(([f, names]) => `import { ${names.join(", ")} } from ${JSON.stringify(f.split("\\").join("/"))};`);
    if (keep.length) out.push(`import { ${keep.join(", ")} } from ${q}${spec}${q};`);
    return out.join(" ");
  });
}
