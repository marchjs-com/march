// esbuild plugin: compiles March `.jsx` files (JSX + language features) to plain JS, extracts css`` blocks into the
// CSS bundle, collects t`` keys and resolves `march/*` to this copy of March (no npm install needed when vendored).
//   import { march } from "march/esbuild";
//   esbuild.build({ entryPoints: ["src/main.jsx"], bundle: true, plugins: [march({ components: "src/components" })] })
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, resolve, dirname, relative, sep } from "node:path";
import { compile } from "./index.js";
import { loadAutoImports, MARCH_ROOT, MODULES } from "./autoimports.js";
import { setupCssSplit } from "./css-split.js";
import { deepImports } from "./deep-imports.js";
import { pruneBareImports } from "./prune-imports.js";
import { cdnTargets, cdnImports, cdnModule, cdnStylesheet, cdnDynamic, entryNames, CDN_CSS } from "./cdn.js";

// march/icons/<pack> and …/<pack>/pack: the icon packs made by `march icons add` (src/icons/packs/<id>/)
function iconPackModules() {
  let ids = [];
  try { ids = readdirSync(join(MARCH_ROOT, "src/icons/packs")); } catch { /* none */ }
  return ids.flatMap((id) => [[`march/icons/${id}`, `src/icons/packs/${id}/index.js`], [`march/icons/${id}/pack`, `src/icons/packs/${id}/pack.js`]]);
}

// every module entry of the package ("march/landing", "march/composite", "march/behaviors/drag"…): resolved to this
// copy, and a named import from one goes straight to the defining module (deepImports), like the core subpaths.
// Without it an app that imports one landing block reaches the whole category, and code splitting places code by the
// files an entry reaches. An entry whose module has side effects (package.json "sideEffects": march/net, the
// managers…) is left out: importing it must run that module.
// a "sideEffects" glob ("./src/managers/*/index.ts", "*.css") → a test on a path relative to the package
// (a pattern without "/" matches the file name at any depth, as in package.json)
const escRx = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
const globTest = (g) => {
  const pat = g.replace(/^\.\//, "");
  const re = new RegExp(`${pat.includes("/") ? "^" : "(^|/)"}${pat.split("*").map(escRx).join("[^/]*")}$`);
  return (path) => re.test(path);
};
function packageModules(all = false) {
  let pkg = {};
  try { pkg = JSON.parse(readFileSync(join(MARCH_ROOT, "package.json"), "utf8")); } catch { /* no package.json */ }
  const effects = (Array.isArray(pkg.sideEffects) ? pkg.sideEffects : []).map(globTest);
  return Object.entries(pkg.exports ?? {}).filter(([k, t]) => k !== "." && !k.includes("*") && typeof t === "string" && t.startsWith("./src/") && t.endsWith(".ts") && (all || !effects.some((test) => test(t.slice(2)))))
    .map(([k, t]) => [`march/${k.slice(2)}`, t.slice(2)]);
}

/**
 * @param {{ components?: string|string[], i18nOut?: string, dev?: boolean, filter?: RegExp, onKeys?: (keys: string[]) => void, cssSplit?: boolean, deepImports?: boolean }} [opts]
 * cssSplit (default true): component CSS follows the component's code into the output chunk that uses it (css-split.js).
 * cache: a folder for compiled modules (keyed by the source, the compiler's own files and the auto-import table), so a
 * cold build reuses what an earlier build compiled; in one process (watch / rebuild) unchanged files are always reused.
 */
// `() => import("./pages/x.tsx")` → the same loader tagged with its source key (`.m`), which the router and lazy()
// look up in the build manifest to preload all of the route's chunks at once (see src/dom/preload.ts).
const EXTS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
export function tagLoaders(code, file, cwd) {
  // only a bare loader: in `() => import("x").then(…)` the arrow returns something else (tagging it would break .then)
  return code.replace(/\(\s*\)\s*=>\s*import\(\s*(["'])(\.{1,2}\/[^"'\n]+)\1\s*\)(?!\s*[.?[])/g, (all, q, spec) => {
    const base = resolve(dirname(file), spec);
    const hit = EXTS.map((e) => base + e).find((p) => existsSync(p) && statSync(p).isFile());
    if (!hit) return all;
    const key = relative(cwd, hit).split(sep).join("/");
    return `Object.assign(${all}, { m: ${JSON.stringify(key)} })`;
  });
}

const escRe = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * Small lazy chunks (march build, second pass): `import("spec")` in `code` becomes a static import (the module joins
 * its parent's chunk) or an import of a group module that holds several small lazy modules in one chunk.
 * @param {string} code
 * @param {{ spec: string, mode: "static" | "group", group?: string, name?: string }[]} list
 */
export function rewriteDynamic(code, list) {
  let head = "";
  list.forEach((x, i) => {
    const re = new RegExp(String.raw`import\(\s*(["'])${escRe(x.spec)}\1\s*\)`, "g");
    if (!re.test(code)) return;
    if (x.mode === "static") { head += `import * as __mIn${i} from ${JSON.stringify(x.spec)};\n`; code = code.replace(re, `Promise.resolve(__mIn${i})`); }
    else code = code.replace(re, `import(${JSON.stringify(`march-group:${x.group}`)}).then((m) => m.${x.name})`);
  });
  return head + code;
}

export function march(opts = {}) {
  return {
    name: "march",
    async setup(build) {
      const filter = opts.filter ?? /\.(jsx|tsx)$/;
      const auto = await loadAutoImports({ components: [].concat(opts.components ?? []).map((d) => resolve(d)) });
      const compiled = compileCache(opts, auto);
      const keys = new Set();
      const css = new Map();
      const cwd = build.initialOptions.absWorkingDir ?? process.cwd();
      // March from the CDN (opts.cdn, from loadCdn): before css-split, which would take March's stylesheets
      const cdn = opts.cdn;
      if (cdn) {
        // march/css/x.css → the CDN's css/x.css; an entry's own stylesheet (march/motion/motion.css) → that entry's
        // stylesheet on the CDN (motion.css), which has it
        build.onResolve({ filter: /^march\/.+\.css$/ }, (a) => {
          if (a.path.startsWith("march/css/")) return { path: `${cdn.base}/${a.path.slice("march/".length)}`, namespace: "march-cdn-style" };
          const entry = a.path.replace(/\/[^/]+$/, "");
          if (cdn.css[entry]) return { path: cdn.css[entry], namespace: "march-cdn-style" };
          return { errors: [{ text: `${a.path}: no stylesheet of ${entry} on ${cdn.base} (march.config.js › cdn)` }] };
        });
        build.onLoad({ filter: /.*/, namespace: "march-cdn-style" }, (a) => ({ contents: cdnStylesheet(a.path, opts.cdnLocal), loader: "js", resolveDir: cwd }));
        build.onResolve({ filter: /^march-cdn:css$/ }, () => ({ path: "css", namespace: "march-cdn" }));
        build.onResolve({ filter: /^https:\/\// }, (a) => (a.path.startsWith(`${cdn.base}/`) ? { path: a.path, external: true } : undefined));
      }
      if (opts.cssSplit !== false) setupCssSplit(build);

      // march/* → files of this March copy
      const files = Object.fromEntries([...packageModules(), ...MODULES, ["march/icons", "src/icons/index.ts"], ["march/icons/catalog", "src/icons/catalog.ts"], ["march/icons/packs", "src/icons/packs.ts"], ...iconPackModules(), ["march/theme", "src/theme/index.ts"], ["march/seo", "src/seo/index.ts"], ["march/seo/hydrate", "src/seo/hydrate.ts"], ["march/seo/prerendered", "src/seo/prerendered.ts"], ["march/base", "src/base/index.ts"], ["march/testing", "src/testing/index.ts"]].map(([spec, rel]) => [spec, join(MARCH_ROOT, rel)]));
      // named imports from March barrels go straight to the defining module (see deep-imports.js); off with deepImports: false
      // (from the CDN: to the smallest CDN entry that exports the name instead, see cdn.js)
      // every entry of the package (also those with side effects, which deep imports leave alone)
      // and the CDN's module entries (march/mod/<path>: each module a barrel re-exports from, see tools/build-cdn.js)
      const mods = cdn ? Object.fromEntries(Object.keys(cdn.url).filter((k) => k.startsWith("march/mod/")).map((k) => [k, [".ts", ".tsx", ".js"].map((x) => join(MARCH_ROOT, "src", k.slice(10) + x)).find((f) => existsSync(f))]).filter(([, f]) => f)) : {};
      const entryFiles = cdn ? { ...files, ...Object.fromEntries(packageModules(true).map(([spec, rel]) => [spec, join(MARCH_ROOT, rel)])), ...mods } : null;
      const target = cdn ? cdnTargets(cdn, { ...files, ...mods }) : null;
      const deep = cdn ? (c) => cdnDynamic(cdnImports(c, target), cdn, opts.cdnLocal ? entryFiles : null) : opts.deepImports === false ? (c) => c : (c) => (c.includes("march") ? deepImports(c, files) : c);
      if (cdn) {
        // an entry → its module on the CDN (its source when prerendering in node) and its stylesheet
        build.onResolve({ filter: /^march(\/[\w-]+)*$/ }, (a) => {
          // no stylesheet: the CDN file itself (no module in between, nothing of it in the app's files); with one, a
          // module that links the stylesheet next to it (cdnModule)
          if (a.path in cdn.url) return !cdn.css[a.path] && !opts.cdnLocal ? { path: cdn.url[a.path], external: true } : { path: a.path, namespace: "march-cdn" };
          // prerendering in node may use what is not for browsers (march/testing's DOM)
          if (opts.cdnLocal) return undefined;
          return { errors: [{ text: `${a.path} is not on ${cdn.base} (march.config.js › cdn): only the package's browser entries are` }] };
        });
        build.onLoad({ filter: /.*/, namespace: "march-cdn" }, (a) => ({ contents: a.path === "css" ? CDN_CSS : cdnModule(a.path, cdn, opts.cdnLocal ? entryFiles[a.path] : null, cdn.exports?.[a.path] ?? (entryFiles[a.path] ? entryNames(entryFiles[a.path]) : [])), loader: "js", resolveDir: cwd }));
      }
      build.onResolve({ filter: /^march(\/[\w-]+){1,3}$|^march$/ }, (a) => (files[a.path] ? { path: files[a.path] } : undefined));
      // the old name (hadi-march, before November 2026) still resolves, for a while: the same files as march
      build.onResolve({ filter: /^hadi-march(\/|$)/ }, (a) => build.resolve(a.path.slice("hadi-".length), { kind: a.kind, importer: a.importer, resolveDir: a.resolveDir }));
      // second pass of march build: small lazy chunks join their parent (static) or a group chunk (see rewriteDynamic)
      const inline = opts.inline ?? {};
      const fixDyn = (code, file) => (inline[file] ? rewriteDynamic(code, inline[file]) : code);
      build.onResolve({ filter: /^march-group:/ }, (a) => ({ path: a.path.slice(12), namespace: "march-group" }));
      build.onLoad({ filter: /.*/, namespace: "march-group" }, (a) => ({ contents: (opts.groups?.[a.path] ?? []).map((m) => `export * as ${m.name} from ${JSON.stringify(m.abs)};`).join("\n"), loader: "js", resolveDir: cwd }));
      // March's own modules that lazy-load a small module (router outlets, overlay media)
      if (Object.keys(inline).some((f) => f.startsWith(join(MARCH_ROOT, "src")))) {
        build.onLoad({ filter: /\.(ts|js)$/, namespace: "file" }, async (a) => (inline[a.path] && a.path.startsWith(join(MARCH_ROOT, "src")) ? { contents: rewriteDynamic(await readFile(a.path, "utf8"), inline[a.path]), loader: a.path.endsWith(".ts") ? "ts" : "js", resolveDir: dirname(a.path) } : undefined));
      }
      build.onResolve({ filter: /^march\/css\// }, (a) => ({ path: join(MARCH_ROOT, "src", a.path.slice("march/".length)) }));

      build.onLoad({ filter, namespace: "file" }, async (a) => {
        const source = await readFile(a.path, "utf8");
        try {
          const r = await compiled(source, a.path, () => compile(source, { filename: a.path, autoImports: auto, dev: opts.dev }));
          for (const k of r.keys) keys.add(k);
          let contents = fixDyn(deep(tagLoaders(r.code, a.path, cwd)), a.path);
          if (r.css) { css.set(a.path, r.css); contents += `\nimport ${JSON.stringify(`march-css:${a.path}`)};`; }
          return { contents, loader: a.path.endsWith(".tsx") ? "ts" : "js", resolveDir: dirname(a.path), warnings: r.warnings.map((text) => ({ text })) };
        } catch (e) {
          if (!e.marchCompile) throw e;
          return { errors: [{ text: e.message.replace(/^March compile error in [^:]+(:\d+:\d+)?: /, ""), location: { file: a.path, line: e.line ?? 1, column: Math.max(0, (e.column ?? 1) - 1), lineText: source.split("\n")[(e.line ?? 1) - 1] ?? "" }, detail: e.frame }] };
        }
      });
      // generated route tables (plain .js) get the same loader tags
      build.onLoad({ filter: /routes\.gen\.js$/, namespace: "file" }, async (a) => ({ contents: fixDyn(deep(tagLoaders(await readFile(a.path, "utf8"), a.path, cwd)), a.path), loader: "js", resolveDir: dirname(a.path) }));
      // the app's own .ts/.js modules (not March, not node_modules): same rewrites
      build.onLoad({ filter: /\.(ts|js|mjs)$/, namespace: "file" }, async (a) => {
        if (a.path.endsWith(".d.ts") || a.path.includes(sep + "node_modules" + sep) || a.path.startsWith(join(MARCH_ROOT, "src")) || a.path.startsWith(join(MARCH_ROOT, "compiler")) || !a.path.startsWith(cwd)) return undefined;
        const code = await readFile(a.path, "utf8");
        if (!code.includes("march") && !code.includes("import(")) return undefined;
        return { contents: fixDyn(deep(tagLoaders(code, a.path, cwd)), a.path), loader: a.path.endsWith(".ts") ? "ts" : "js", resolveDir: dirname(a.path) };
      });
      build.onResolve({ filter: /^march-css:/ }, (a) => ({ path: a.path.slice(10), namespace: "march-css" }));
      build.onLoad({ filter: /.*/, namespace: "march-css" }, (a) => ({ contents: css.get(a.path) ?? "", loader: "css" }));
      build.onEnd(async (result) => {
        if (opts.prune !== false && !result.errors?.length) await pruneBareImports(result, build, MARCH_ROOT);
        if (opts.onKeys) opts.onKeys([...keys]);
        if (opts.i18nOut) await writeFile(opts.i18nOut, `${JSON.stringify([...keys].sort(), null, 2)}\n`);
      });
    },
  };
}

const sha1 = (x) => createHash("sha1").update(x).digest("hex");
let compilerDigest = null;
/** The compiler's own sources: a change to any of them invalidates every cached module. */
function compilerSalt() {
  if (compilerDigest) return compilerDigest;
  const dir = dirname(fileURLToPath(import.meta.url));
  const h = createHash("sha1");
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".js")).sort()) h.update(f).update(readFileSync(join(dir, f)));
  return (compilerDigest = h.digest("hex"));
}
/** compile() memoised per file (same source text → same result) in memory and, with opts.cache, on disk. */
function compileCache(opts, auto) {
  const mem = new Map();
  const salt = sha1(`${compilerSalt()}|${JSON.stringify(auto)}|${!!opts.dev}`);
  const dir = opts.cache;
  let made = false;
  return async (source, file, run) => {
    const hit = mem.get(file);
    if (hit && hit.source === source) return hit.r;
    const key = dir ? join(dir, `${sha1(`${salt}|${file}|${source}`)}.json`) : null;
    let r = null;
    if (key) try { r = JSON.parse(await readFile(key, "utf8")); } catch { /* not cached */ }
    if (!r) {
      const c = run();
      r = { code: c.code, css: c.css, keys: [...c.keys], warnings: c.warnings };
      if (key) {
        try { if (!made) { await mkdir(dir, { recursive: true }); made = true; } await writeFile(key, JSON.stringify(r)); } catch { /* best effort */ }
      }
    }
    mem.set(file, { source, r });
    return r;
  };
}
