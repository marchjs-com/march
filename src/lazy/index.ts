// hadi-march/lazy — component-level code splitting and chunk preloading (kept out of the core entry so apps that do
// not split pay nothing). `lazy` is auto-imported in .jsx/.tsx files.
export { lazy, skeleton, type LazyComponent, type LazyOptions, type LazyWhen, type LazyPlaceholder } from "../dom/lazy.ts";
export { preloadChunks, preloadFiles, chunksOf, saveData, whenIdle, setPreloadManifest, loaderKey, setLoadDelay, loadDelay, setLoadRunner, runLoad, type LoadInfo } from "../dom/preload.ts";
