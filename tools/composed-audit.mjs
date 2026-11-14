// Lists components whose meta.composedOf misses a component they import (rule: a component built from other
// components names its parts). `node tools/composed-audit.mjs` prints the gaps; `--fix` writes them into meta.ts.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE = join(ROOT, "src/components");
const SEP = String.fromCharCode(92);
const fix = process.argv.includes("--fix");
const folders = readdirSync(BASE).filter((c) => statSync(join(BASE, c)).isDirectory())
  .flatMap((c) => readdirSync(join(BASE, c)).filter((n) => existsSync(join(BASE, c, n, "meta.ts"))).map((n) => join(BASE, c, n)));
const metaOf = (dir) => readFileSync(join(dir, "meta.ts"), "utf8");
const nameOf = new Map(folders.map((d) => [d, /name:\s*"([^"]+)"/.exec(metaOf(d))?.[1]]));
const names = new Set(nameOf.values());
/** Own source files of a component: everything in the folder except tests, the demo, the playground and meta. */
const sources = (dir) => readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.|^demo\.|^playground\.|^meta\.|^tr\./.test(f)).map((f) => join(dir, f));
/** Files in src/ui, src/forms… that only re-export a component folder count as that component. */
const folderOfFile = (file) => folders.find((d) => file.startsWith(d + "\\") || file.startsWith(d + "/"));

export function audit() {
  const gaps = [];
  for (const dir of folders) {
    const me = nameOf.get(dir);
    const used = new Set();
    for (const file of sources(dir)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+"([^"]+)"/g)) {
        if (m[1]) continue;
        const target = m[3].startsWith(".") ? resolve(dirname(file), m[3]) : "";
        const from = target && folderOfFile(target);
        for (const raw of m[2].split(",")) {
          const id = raw.trim();
          if (!id || id.startsWith("type ")) continue;
          const name = id.split(/\s+as\s+/)[0].trim();
          if (from && from !== dir && nameOf.get(from) === name) used.add(name);
          else if (!from && names.has(name) && name !== me && (target.includes("/ui/") || target.includes("/forms/") || target.includes(SEP + "ui" + SEP) || target.includes(SEP + "forms" + SEP))) used.add(name);
        }
      }
    }
    const meta = metaOf(dir);
    const listed = new Set([.../composedOf:\s*\[([^\]]*)\]/.exec(meta)?.[1].matchAll(/"([^"]+)"/g) ?? []].map((x) => x[1]));
    const missing = [...used].filter((n) => !listed.has(n)).sort();
    if (!missing.length) continue;
    gaps.push({ folder: relative(BASE, dir).split("\\").join("/"), missing });
    if (fix) {
      const all = JSON.stringify([...listed, ...missing]).replace(/,/g, ", ");
      const next = /composedOf:\s*\[[^\]]*\]/.test(meta) ? meta.replace(/composedOf:\s*\[[^\]]*\]/, `composedOf: ${all}`)
        : meta.replace(/(\n\s*)(summary:[^\n]*\n)/, `$1$2$1composedOf: ${all},\n`.replace(/\n\n/, "\n"));
      writeFileSync(join(dir, "meta.ts"), next);
    }
  }
  return gaps;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gaps = audit();
  for (const g of gaps) console.log(`${g.folder}: ${g.missing.join(", ")}`);
  console.log(`${gaps.length} component(s) ${fix ? "fixed" : "with parts missing from composedOf"}`);
}
