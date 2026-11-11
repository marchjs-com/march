// esbuild plugin: compiles March `.jsx` files (JSX + language features) to plain JS, extracts css`` blocks into the
// CSS bundle, collects t`` keys and resolves `hadi-march/*` to this copy of March (no npm install needed when vendored).
//   import { march } from "hadi-march/esbuild";
//   esbuild.build({ entryPoints: ["src/main.jsx"], bundle: true, plugins: [march({ components: "src/components" })] })
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { compile } from "./index.js";
import { loadAutoImports, MARCH_ROOT, MODULES } from "./autoimports.js";

/**
 * @param {{ components?: string|string[], i18nOut?: string, dev?: boolean, filter?: RegExp, onKeys?: (keys: string[]) => void }} [opts]
 */
export function march(opts = {}) {
  return {
    name: "march",
    async setup(build) {
      const filter = opts.filter ?? /\.jsx$/;
      const auto = await loadAutoImports({ components: [].concat(opts.components ?? []).map((d) => resolve(d)) });
      const keys = new Set();
      const css = new Map();

      // hadi-march/* → files of this March copy
      const files = Object.fromEntries(MODULES.map(([spec, rel]) => [spec, join(MARCH_ROOT, rel)]));
      build.onResolve({ filter: /^hadi-march(\/[\w-]+)?$/ }, (a) => (files[a.path] ? { path: files[a.path] } : undefined));
      build.onResolve({ filter: /^hadi-march\/css\// }, (a) => ({ path: join(MARCH_ROOT, "src", a.path.slice("hadi-march/".length)) }));

      build.onLoad({ filter, namespace: "file" }, async (a) => {
        const source = await readFile(a.path, "utf8");
        try {
          const r = compile(source, { filename: a.path, autoImports: auto, dev: opts.dev });
          for (const k of r.keys) keys.add(k);
          let contents = r.code;
          if (r.css) { css.set(a.path, r.css); contents += `\nimport ${JSON.stringify(`march-css:${a.path}`)};`; }
          return { contents, loader: "js", resolveDir: dirname(a.path), warnings: r.warnings.map((text) => ({ text })) };
        } catch (e) {
          if (!e.marchCompile) throw e;
          return { errors: [{ text: e.message.replace(/^March compile error in [^:]+(:\d+:\d+)?: /, ""), location: { file: a.path, line: e.line ?? 1, column: Math.max(0, (e.column ?? 1) - 1), lineText: source.split("\n")[(e.line ?? 1) - 1] ?? "" }, detail: e.frame }] };
        }
      });
      build.onResolve({ filter: /^march-css:/ }, (a) => ({ path: a.path.slice(10), namespace: "march-css" }));
      build.onLoad({ filter: /.*/, namespace: "march-css" }, (a) => ({ contents: css.get(a.path) ?? "", loader: "css" }));
      build.onEnd(async () => {
        if (opts.onKeys) opts.onKeys([...keys]);
        if (opts.i18nOut) await writeFile(opts.i18nOut, `${JSON.stringify([...keys].sort(), null, 2)}\n`);
      });
    },
  };
}
