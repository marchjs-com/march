// hadi-march/landing — website blocks: hero, navigation bar, features, logos, pricing, testimonials, FAQ, CTA, footer,
// portfolio, presentation, scroll and parallax effects. The components live in src/components/landing/<name>/ (one folder
// each); this module re-exports them so `import { Hero } from "hadi-march/landing"` bundles only what is used.
export * from "../components/landing/index.ts";
export { scrollScene, refreshScenes, type SceneState, type SceneFn } from "../motion/scroll-scene.ts";
export { sharedTransition } from "../motion/shared-element.ts";
