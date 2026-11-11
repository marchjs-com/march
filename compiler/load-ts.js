// Load March's own TypeScript sources from node, also when the package is installed under node_modules.
// Node strips types natively, except for files under node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING), which is
// exactly where an installed March lives. There we strip the (erasable) types ourselves with node's stripTypeScriptTypes,
// through an in-thread module hook that is registered once, and only when March itself is under node_modules.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as nodeModule from "node:module";

/** True for file URLs/paths inside a node_modules folder (node refuses to strip types there). */
export const inNodeModules = (fileOrUrl) => /[\\/]node_modules[\\/]/.test(fileOrUrl.startsWith("file:") ? fileURLToPath(fileOrUrl) : fileOrUrl);

/** Strip TypeScript types from source code (erasable syntax only), using node's built-in stripper. */
export function stripTypes(source, filename) {
  const strip = nodeModule.stripTypeScriptTypes;
  if (typeof strip !== "function") throw new Error(`March: node ${process.versions.node} cannot strip TypeScript types (${filename}); use node >= 22.15.`);
  return strip(source, { mode: "strip" });
}

const isNodeModulesTs = (url) => url.startsWith("file:") && url.endsWith(".ts") && !url.endsWith(".d.ts") && inNodeModules(url);

let hooked = false;
/** Make `import()` of .ts files under node_modules work in this thread (no-op when March is not installed there). */
export function ensureTsHook() {
  if (hooked || !inNodeModules(import.meta.url)) return;
  hooked = true;
  if (typeof nodeModule.registerHooks !== "function") throw new Error(`March: node ${process.versions.node} has no module.registerHooks; use node >= 22.15.`);
  nodeModule.registerHooks({
    load(url, context, next) {
      if (!isNodeModulesTs(url)) return next(url, context);
      const file = fileURLToPath(url);
      return { format: "module", source: stripTypes(readFileSync(file, "utf8"), file), shortCircuit: true };
    },
  });
}

/** Import a March .ts module given its URL. */
export function importTs(url) {
  ensureTsHook();
  return import(url.href);
}

export { isNodeModulesTs };
