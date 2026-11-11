// Node module hooks: import March `.jsx` / `.tsx` files directly in node (tests, scripts). Registered by compiler/register.js:
//   node --import hadi-march/register --test
// Project components are auto-imported from ./src/components (override: MARCH_COMPONENTS=dir1,dir2).
import { readFile } from "node:fs/promises";
import { resolve, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "./index.js";
import { loadAutoImports } from "./autoimports.js";

let auto;
const dirs = (process.env.MARCH_COMPONENTS ?? "src/components").split(",").filter(Boolean).map((d) => resolve(process.cwd(), d));

export async function load(url, context, next) {
  const tsx = url.endsWith(".tsx");
  if (!url.startsWith("file:") || !(url.endsWith(".jsx") || tsx)) return next(url, context);
  if (!auto) {
    const map = await loadAutoImports({ components: dirs });
    // component entries are absolute file paths: node needs file URLs
    auto = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, isAbsolute(v) ? pathToFileURL(v).href : v]));
  }
  const file = fileURLToPath(url);
  const r = compile(await readFile(file, "utf8"), { filename: file, autoImports: auto });
  // .tsx: node strips the remaining TypeScript syntax (erasable types only)
  return { format: tsx ? "module-typescript" : "module", source: r.code, shortCircuit: true };
}
