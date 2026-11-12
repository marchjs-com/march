// hadi-march/lazy — component-level code splitting and chunk preloading (kept out of the core entry so apps that do
// not split pay nothing). `lazy` is auto-imported in .jsx/.tsx files.
export { lazy, skeleton, type LazyComponent, type LazyOptions } from "../dom/lazy.ts";
export { preloadChunks, preloadFiles, chunksOf, saveData, whenIdle, setPreloadManifest, loaderKey } from "../dom/preload.ts";
