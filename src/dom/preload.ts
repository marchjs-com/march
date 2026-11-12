// Chunk preloading without waterfalls. `march build` inlines a manifest into index.html:
//   <script type="application/json" id="march-manifest">{"src/pages/users.tsx":["assets/chunks/users-H.js","assets/chunks/table-H.js","assets/chunks/table-H.css"]}</script>
// (a data block, never executed — CSP safe). Keys are the source files of dynamic imports; the compiler tags
// `() => import("./pages/users.tsx")` with that key, so preloading a route fetches ALL its chunks at once with
// <link rel="modulepreload"> instead of discovering them one import at a time.

type Manifest = Record<string, readonly string[]>;
let manifest: Manifest | null | undefined;
let root: URL | null = null;
const requested = new Set<string>();
const prefetched = new Set<string>();

function read(): Manifest | null {
  if (manifest !== undefined) return manifest;
  const d = globalThis.document;
  const el = d?.getElementById("march-manifest");
  try { manifest = el ? (JSON.parse(el.textContent ?? "{}") as Manifest) : null; } catch { manifest = null; }
  // file paths are relative to the build's root folder: the entry script lives in <root>/assets/
  const entry = d?.querySelector<HTMLScriptElement>("script[type=module][src]");
  try { root = entry ? new URL("../", entry.src) : d ? new URL("./", d.baseURI) : null; } catch { root = null; }
  return manifest;
}

/** Use another manifest (tests, custom servers). */
export function setPreloadManifest(m: Manifest | null, base?: string): void { manifest = m; root = base ? new URL(base) : null; requested.clear(); prefetched.clear(); }

/** Files of a dynamic import (source key) according to the build manifest, or null when unknown. */
export function chunksOf(key: string): readonly string[] | null { return read()?.[key] ?? null; }

/** True when the user asked to save data or the connection is 2G-class: skip speculative downloads. */
export function saveData(): boolean {
  const c = (globalThis.navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } } | undefined)?.connection;
  return !!c && (!!c.saveData || /(^|-)2g$/.test(c.effectiveType ?? ""));
}

/**
 * Add <link rel="modulepreload"> (JS) / <link rel="preload" as="style"> (CSS) for each file once. `low` (idle,
 * speculative) uses <link rel="prefetch"> instead: lowest priority, never competes with what the page needs now.
 */
export function preloadFiles(files: readonly string[], low = false): void {
  const d = globalThis.document;
  if (!d?.head) return;
  read();
  for (const f of files) {
    if (requested.has(f) || (low && prefetched.has(f))) continue;
    (low ? prefetched : requested).add(f);
    const link = d.createElement("link");
    const css = f.endsWith(".css");
    link.setAttribute("rel", low ? "prefetch" : css ? "preload" : "modulepreload");
    if (css && !low) link.setAttribute("as", "style");
    link.setAttribute("href", root ? new URL(f, root).href : f);
    link.setAttribute("data-march-preload", "");
    d.head.appendChild(link);
  }
}

/** Preload every chunk a dynamic import needs (by its manifest key). Returns false when the key is unknown. */
export function preloadChunks(key: string | undefined | null, low = false): boolean {
  if (!key) return false;
  const files = chunksOf(key);
  if (!files) return false;
  preloadFiles(files, low);
  return true;
}

/** The manifest key the compiler attached to a loader (`() => import("./x.tsx")`), if any. */
export const loaderKey = (fn: unknown): string | undefined => (fn as { hm?: string } | null)?.hm;

/** Run `fn` when the browser is idle (setTimeout fallback). Returns a cancel function. */
export function whenIdle(fn: () => void, timeout = 2000): () => void {
  const g = globalThis as typeof globalThis & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (g.requestIdleCallback) { const id = g.requestIdleCallback(fn, { timeout }); return () => g.cancelIdleCallback?.(id); }
  const id = setTimeout(fn, 200);
  return () => clearTimeout(id);
}
