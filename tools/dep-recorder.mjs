// Preloaded into every test process by tools/run-tests.mjs (NODE_OPTIONS=--import): records what a test file depends on —
// every repo module it loads (module hooks) and every repo file or folder it reads (fs) — including child processes
// the test spawns (they inherit NODE_OPTIONS and MARCH_TEST_FILE). On exit it writes one record per process:
//   <MARCH_TEST_DEPS>/<test-file-key>.<pid>.json  { file, code, deps: [repo-relative paths] }
// tools/run-tests.mjs digests those paths to decide whether a test file must run again.
import fs from "node:fs";
import * as nodeModule from "node:module";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const OUT = process.env.MARCH_TEST_DEPS;
const ROOT = process.env.MARCH_TEST_ROOT;
// the test child of `node --test` (NODE_TEST_CONTEXT is set there), or a process a test spawned (MARCH_TEST_FILE set)
const inTest = process.env.NODE_TEST_CONTEXT && process.argv[1];
if (OUT && ROOT && (inTest || process.env.MARCH_TEST_FILE)) {
  const main = !process.env.MARCH_TEST_FILE;
  if (main) process.env.MARCH_TEST_FILE = relative(ROOT, resolve(process.argv[1])).split(sep).join("/");
  const file = process.env.MARCH_TEST_FILE;
  const deps = new Set();
  const note = (p) => {
    try {
      const abs = typeof p === "string" ? (p.startsWith("file:") ? fileURLToPath(p) : resolve(p)) : p instanceof URL ? fileURLToPath(p) : null;
      if (!abs) return;
      const rel = relative(ROOT, abs);
      if (rel.startsWith("..") || /^[a-zA-Z]:/.test(rel) || rel.startsWith("node_modules") || rel.startsWith(".git")) return;
      deps.add(rel.split(sep).join("/"));
    } catch { /* not a path */ }
  };
  // module.registerHooks: node ≥ 22.15 (older: fs reads and esbuild inputs only)
  nodeModule.registerHooks?.({
    resolve(spec, ctx, next) { const r = next(spec, ctx); if (r.url?.startsWith("file:")) note(r.url); return r; },
  });
  for (const name of ["readFileSync", "readdirSync", "statSync", "existsSync"]) {
    const orig = fs[name];
    fs[name] = function (p, ...rest) { note(p); return orig.call(this, p, ...rest); };
  }
  for (const name of ["readFile", "readdir"]) {
    const orig = fs.promises[name];
    fs.promises[name] = function (p, ...rest) { note(p); return orig.call(this, p, ...rest); };
  }
  // `import { readFileSync } from "node:fs"` sees the wrappers too
  nodeModule.syncBuiltinESMExports();
  // esbuild reads sources natively (not through node's fs): its metafile inputs are dependencies too. Patching the CJS
  // exports before anything imports esbuild makes `import("esbuild")` hand out the wrappers as well.
  try {
    const eb = nodeModule.createRequire(resolve(ROOT, "package.json"))("esbuild");
    const inputs = (opts, r) => { const base = opts?.absWorkingDir ?? process.cwd(); for (const k of Object.keys(r?.metafile?.inputs ?? {})) if (!/^[\w-]+:/.test(k) || /^[a-zA-Z]:/.test(k)) note(resolve(base, k)); };
    const build = eb.build;
    eb.build = (opts, ...rest) => build({ ...opts, metafile: true }, ...rest).then((r) => { inputs(opts, r); return r; });
    const context = eb.context;
    eb.context = async (opts, ...rest) => {
      const ctx = await context({ ...opts, metafile: true }, ...rest);
      const rebuild = ctx.rebuild.bind(ctx);
      ctx.rebuild = () => rebuild().then((r) => { inputs(opts, r); return r; });
      return ctx;
    };
  } catch { /* no esbuild */ }
  process.on("exit", (code) => {
    try {
      const key = createHash("sha1").update(file).digest("hex").slice(0, 16);
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(`${OUT}/${key}.${process.pid}.json`, JSON.stringify({ file, main, code: code ?? process.exitCode ?? 0, ms: Math.round(process.uptime() * 1000), deps: [...deps].sort() }));
    } catch { /* best effort */ }
  });
}
