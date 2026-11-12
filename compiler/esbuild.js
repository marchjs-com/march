// esbuild plugin: compiles March `.jsx` files (JSX + language features) to plain JS, extracts css`` blocks into the
// CSS bundle, collects t`` keys and resolves `hadi-march/*` to this copy of March (no npm install needed when vendored).
//   import { march } from "hadi-march/esbuild";
//   esbuild.build({ entryPoints: ["src/main.jsx"], bundle: true, plugins: [march({ components: "src/components" })] })
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, resolve, dirname, relative, sep } from "node:path";
import { compile } from "./index.js";
import { loadAutoImports, MARCH_ROOT, MODULES } from "./autoimports.js";
import { setupCssSplit } from "./css-split.js";
import { deepImports } from "./deep-imports.js";
import { pruneBareImports } from "./prune-imports.js";

/**
 * @param {{ components?: string|string[], i18nOut?: string, dev?: boolean, filter?: RegExp, onKeys?: (keys: string[]) => void, cssSplit?: boolean, deepImports?: boolean }} [opts]
 * cssSplit (default true): component CSS follows the component's code into the output chunk that uses it (css-split.js).
 */
// `() => import("./pages/x.tsx")` → the same loader tagged with its source key (`.hm`), which the router and lazy()
// look up in the build manifest to preload all of the route's chunks at once (see src/dom/preload.ts).
const EXTS = ["", ".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
export function tagLoaders(code, file, cwd) {
  // only a bare loader: in `() => import("x").then(…)` the arrow returns something else (tagging it would break .then)
  return code.replace(/\(\s*\)\s*=>\s*import\(\s*(["'])(\.{1,2}\/[^"'\n]+)\1\s*\)(?!\s*[.?[])/g, (all, q, spec) => {
    const base = resolve(dirname(file), spec);
    const hit = EXTS.map((e) => base + e).find((p) => existsSync(p) && statSync(p).isFile());
    if (!hit) return all;
    const key = relative(cwd, hit).split(sep).join("/");
    return `Object.assign(${all}, { hm: ${JSON.stringify(key)} })`;
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
    if (x.mode === "static") { head += `import * as __hmIn${i} from ${JSON.stringify(x.spec)};\n`; code = code.replace(re, `Promise.resolve(__hmIn${i})`); }
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
      const keys = new Set();
      const css = new Map();
      if (opts.cssSplit !== false) setupCssSplit(build);

      // hadi-march/* → files of this March copy
      const files = Object.fromEntries([...MODULES, ["hadi-march/icons", "src/icons/index.ts"], ["hadi-march/icons/catalog", "src/icons/catalog.ts"], ["hadi-march/theme", "src/theme/index.ts"], ["hadi-march/seo", "src/seo/index.ts"], ["hadi-march/seo/hydrate", "src/seo/hydrate.ts"], ["hadi-march/seo/prerendered", "src/seo/prerendered.ts"], ["hadi-march/base", "src/base/index.ts"], ["hadi-march/testing", "src/testing/index.ts"]].map(([spec, rel]) => [spec, join(MARCH_ROOT, rel)]));
      // named imports from March barrels go straight to the defining module (see deep-imports.js); off with deepImports: false
      const deep = opts.deepImports === false ? (c) => c : (c) => (c.includes("hadi-march") ? deepImports(c, files) : c);
      const cwd = build.initialOptions.absWorkingDir ?? process.cwd();
      build.onResolve({ filter: /^hadi-march(\/[\w-]+){1,2}$|^hadi-march$/ }, (a) => (files[a.path] ? { path: files[a.path] } : undefined));
      // second pass of march build: small lazy chunks join their parent (static) or a group chunk (see rewriteDynamic)
      const inline = opts.inline ?? {};
      const fixDyn = (code, file) => (inline[file] ? rewriteDynamic(code, inline[file]) : code);
      build.onResolve({ filter: /^march-group:/ }, (a) => ({ path: a.path.slice(12), namespace: "march-group" }));
      build.onLoad({ filter: /.*/, namespace: "march-group" }, (a) => ({ contents: (opts.groups?.[a.path] ?? []).map((m) => `export * as ${m.name} from ${JSON.stringify(m.abs)};`).join("\n"), loader: "js", resolveDir: cwd }));
      // March's own modules that lazy-load a small module (router outlets, overlay media)
      if (Object.keys(inline).some((f) => f.startsWith(join(MARCH_ROOT, "src")))) {
        build.onLoad({ filter: /\.(ts|js)$/, namespace: "file" }, async (a) => (inline[a.path] && a.path.startsWith(join(MARCH_ROOT, "src")) ? { contents: rewriteDynamic(await readFile(a.path, "utf8"), inline[a.path]), loader: a.path.endsWith(".ts") ? "ts" : "js", resolveDir: dirname(a.path) } : undefined));
      }
      build.onResolve({ filter: /^hadi-march\/css\// }, (a) => ({ path: join(MARCH_ROOT, "src", a.path.slice("hadi-march/".length)) }));

      build.onLoad({ filter, namespace: "file" }, async (a) => {
        const source = await readFile(a.path, "utf8");
        try {
          const r = compile(source, { filename: a.path, autoImports: auto, dev: opts.dev });
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
        if (!code.includes("hadi-march") && !code.includes("import(")) return undefined;
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
