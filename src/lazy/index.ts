// march/lazy — component-level code splitting and chunk preloading (kept out of the core entry so apps that do
// not split pay nothing). `lazy` is auto-imported in .jsx/.tsx files.
export { lazy, skeleton, type LazyComponent, type LazyOptions, type LazyWhen, type LazyPlaceholder } from "../dom/lazy.ts";
export { onLoad, beginLoad, trackLoad, loadsActive, type LoadEvent, type LoadKind, type LoadOptions } from "../dom/loads.ts";
export { preloadChunks, preloadFiles, prefetchCommon, chunksOf, saveData, whenIdle, setPreloadManifest, loaderKey, setLoadDelay, loadDelay, setLoadRunner, runLoad, type LoadInfo } from "../dom/preload.ts";
