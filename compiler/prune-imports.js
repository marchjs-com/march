// After the build: drop bare `import "./chunk.js"` statements that only exist because a file is REACHABLE, not used.
// esbuild assigns files to chunks by which entry points can reach them, before tree shaking: a module the shell
// imports but never calls (e.g. display.ts reached through app.ts) still lands in a chunk the shell loads, if a page
// uses it too. When the importer takes no bindings from the chunk and every module in it is a side-effect-free March
// source (package.json "sideEffects"), loading it there does nothing — so the import is removed and the chunk is
// loaded only by the pages that use it. Run after css-split (a chunk's CSS loader belongs to the pages that use it).
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative, dirname, sep, join } from "node:path";

const posix = (p) => p.split(sep).join("/");

/**
 * @param {import("esbuild").BuildResult} result
 * @param {import("esbuild").PluginBuild} build
 * @param {string} marchRoot
 * @returns {Promise<number>} number of imports removed
 */
export async function pruneBareImports(result, build, marchRoot) {
  const meta = result.metafile;
  if (!meta || !build.initialOptions.splitting) return 0;
  const cwd = build.initialOptions.absWorkingDir ?? process.cwd();
  const src = join(marchRoot, "src") + sep;
  const memory = result.outputFiles ? new Map(result.outputFiles.map((f) => [f.path, f])) : null;
  const read = async (p) => (memory ? memory.get(p)?.text ?? "" : existsSync(p) ? readFile(p, "utf8") : "");
  const write = async (p, text) => {
    if (!memory) return writeFile(p, text);
    const contents = new TextEncoder().encode(text);
    const i = result.outputFiles.findIndex((x) => x.path === p);
    const f = { path: p, contents, hash: "", get text() { return text; } };
    if (i >= 0) result.outputFiles[i] = f;
    memory.set(p, f);
  };
  const pure = (input) => {
    const abs = resolve(cwd, input);
    return abs.startsWith(src) && !abs.endsWith(".css") && !abs.endsWith(`${sep}motion${sep}install.ts`) && !input.includes(":");
  };
  const pureChunk = (key) => { const o = meta.outputs[key]; return !!o && !o.entryPoint && Object.keys(o.inputs).length > 0 && Object.keys(o.inputs).every(pure); };
  let removed = 0;
  for (const [key, out] of Object.entries(meta.outputs)) {
    if (!key.endsWith(".js")) continue;
    const file = resolve(cwd, key);
    let code = await read(file);
    let changed = false;
    for (const im of [...out.imports]) {
      if (im.kind !== "import-statement" || !pureChunk(im.path)) continue;
      const spec = posix(relative(dirname(file), resolve(cwd, im.path)));
      const rel = spec.startsWith(".") ? spec : `./${spec}`;
      const bare = new RegExp(`import\\s*["']${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'];?\\n?`);
      if (!bare.test(code)) continue; // the importer uses bindings from it: keep
      code = code.replace(bare, "");
      out.imports = out.imports.filter((x) => x !== im);
      changed = true;
      removed++;
    }
    if (changed) await write(file, code);
  }
  return removed;
}
