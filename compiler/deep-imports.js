// Barrel → direct imports. `import { NavSidebar, toast } from "march/ui"` becomes
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
  // only real import statements are rewritten: the same text inside a string or template literal (a code sample in a
  // demo) or a comment is content and stays as written
  const live = statementStarts(code);
  return rewriteDynamic(rewrite(code, barrels, live), barrels);
}

/**
 * A lazy import of one name from a barrel loads the module that defines it, as a static named import does:
 *   import("march/forms").then((m) => m.Calendar)               → import("<march>/…/calendar/index.ts").then((m) => m.Calendar)
 *   import("march/charts").then((m) => ({ default: m.BarChart }))  (the same, for lazy(); any one key)
 * so the lazy part is that one component, never the whole category. Code inside strings and comments stays.
 */
function rewriteDynamic(code, barrels) {
  if (!code.includes("import(")) return code;
  const live = statementStarts(code, true);
  return code.replace(/import\(\s*(["'])(march(?:\/[\w-]+)?)\1\s*\)(\s*\.then\(\s*\(?\s*([\w$]+)\s*\)?\s*=>\s*(?:\(\s*\{\s*[\w$]+:\s*)?\4\.([\w$]+))/g, (all, q, spec, rest, m, name, at) => {
    const index = barrels[spec];
    if (!index || !live.has(at)) return all;
    const target = exportMap(index).get(name);
    return target && target !== index ? `import(${JSON.stringify(target.split("\\").join("/"))})${rest}` : all;
  });
}

// Offsets where an `import` keyword starts a statement in code: after a line break, `;` or `}` (or at the start),
// outside strings, template literals, comments and regular expressions. `calls`: the offsets of `import(` calls instead.
function statementStarts(code, calls = false) {
  const out = new Set();
  const n = code.length;
  const tpl = []; // brace depth at each open `${`
  let depth = 0, prev = ";", word = "", i = 0;
  const regexOk = () => /[(,=:[!&|?{};+\-*%<>~^\n]/.test(prev) || (prev === "a" && /^(?:return|typeof|case|do|else|in|of|void|yield|await|delete|throw|new)$/.test(word));
  while (i < n) {
    const c = code[i];
    if (c === "/" && code[i + 1] === "/") { const e = code.indexOf("\n", i); i = e < 0 ? n : e; continue; }
    if (c === "/" && code[i + 1] === "*") { const e = code.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === "'" || c === '"') { i++; while (i < n && code[i] !== c && code[i] !== "\n") i += code[i] === "\\" ? 2 : 1; i++; prev = "a"; word = ""; continue; }
    if (c === "`" || (c === "}" && tpl.length && tpl[tpl.length - 1] === depth)) {
      if (c === "}") tpl.pop(); // back inside the template after `${ … }`
      i++;
      while (i < n && code[i] !== "`" && !(code[i] === "$" && code[i + 1] === "{")) i += code[i] === "\\" ? 2 : 1;
      if (code[i] === "$") { tpl.push(depth); i += 2; prev = "{"; } else { i++; prev = "a"; word = ""; }
      continue;
    }
    if (c === "/" && regexOk()) {
      i++;
      let cls = false;
      while (i < n && code[i] !== "\n" && (cls || code[i] !== "/")) { if (code[i] === "\\") i++; else if (code[i] === "[") cls = true; else if (code[i] === "]") cls = false; i++; }
      i++; prev = "a"; word = ""; continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    if (calls) { if (c === "i" && code.startsWith("import(", i) && !/[\w$.]/.test(code[i - 1] ?? "")) out.add(i); }
    else if (c === "i" && (prev === ";" || prev === "}" || prev === "\n") && code.startsWith("import", i) && !/[\w$]/.test(code[i + 6] ?? "")) out.add(i);
    if (c === "\n") prev = "\n";
    else if (!/\s/.test(c)) { const w = /[\w$]/.test(c); word = w ? (prev === "a" && /[\w$]/.test(code[i - 1]) ? word + c : c) : ""; prev = w ? "a" : c; }
    i++;
  }
  return out;
}

function rewrite(code, barrels, live) {
  return code.replace(/import\s*\{([^}]*)\}\s*from\s*(["'])(march(?:\/[\w-]+)?)\2\s*;?/g, (all, list, q, spec, at) => {
    const index = barrels[spec];
    if (!index || !live.has(at)) return all;
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
