// march/seo — head tags per route, Open Graph / Twitter cards, JSON-LD, and the client half of prerendering.
//
//   installSeo({ site: "https://shop.example", titleTemplate: "%s · Shop", defaults: { og: { siteName: "Shop" } } })
//   createRouter({ routes: { "/about": { load, head: { title: "About", description: "…" } } } })   // or `export const head` in the page
//   useHead(() => ({ title: product().name, og: { image: product().photo }, jsonLd: ld.product({ … }) }))   // in a component
//
// Sources merge in order: defaults → the current route → components (later wins); everything is reactive and a
// component's head goes away with it. `march build` with `seo: { prerender }` writes each route's HTML (head included)
// at build time; hydrate() (march/seo/hydrate) takes it over in the browser. See docs/seo.md.
import { signal, effect, createRoot, onCleanup, getOwner, untrack } from "../core/reactive.ts";
import { setHeadHandler, _router, type RouteTarget } from "../router/router.ts";
import { resolveHead, applyHead, type HeadInput, type Tag } from "./head.ts";

export { resolveHead, applyHead, headToHtml, ogTags, twitterTags, jsonLdText, tagKey, _resetHead } from "./head.ts";
export type { HeadInput, Tag, MetaTag, LinkTag, OgInput, OgImage, TwitterInput, JsonLd, ResolveOptions } from "./head.ts";
export { ld } from "./ld.ts";
export type { OrgInput, ArticleInput, ProductInput } from "./ld.ts";
export { checkHtml, scanTags, formatIssues } from "./check.ts";
export type { SeoIssue, SeoLevel, SeoCheckOptions } from "./check.ts";

/** A route's head: an object, or a function of the route target (params, query, meta). */
export type RouteHead = HeadInput | ((to: RouteTarget) => HeadInput);

export interface SeoOptions {
  /** Absolute origin (+ base path) of the published site: "https://shop.example". Needed for canonical / og:url. */
  site?: string;
  titleTemplate?: HeadInput["titleTemplate"];
  /** Head of every page (site name, default image, lang…). */
  defaults?: HeadInput;
  /** Canonical link from `site` + the route path (default true with `site`; hash routing never gets one automatically). */
  canonical?: boolean;
  /** Not-found pages get robots "noindex" (default true). */
  noindexNotFound?: boolean;
  /**
   * Write JSON-LD into the live document (default true). Set false under a Trusted Types CSP
   * (`require-trusted-types-for 'script'`): script text written at run time is blocked and reported there. Prerendered
   * pages carry their JSON-LD from the build either way.
   */
  jsonLd?: boolean;
}

type Entry = { get: () => HeadInput | null | undefined };
const S = {
  opts: null as SeoOptions | null,
  entries: [] as Entry[],
  route: null as Entry | null,
  version: signal(0),
  tags: signal<Tag[]>([]),
  started: false,
};
const bump = (): void => { S.version.set(S.version.peek() + 1); };

function start(): void {
  if (S.started) return;
  S.started = true;
  createRoot(() => effect(() => {
    S.version();
    const o = S.opts ?? {};
    const mode = _router.S.router?.mode;
    const p = _router.S.path();
    const inputs: (HeadInput | null | undefined)[] = [o.titleTemplate !== undefined ? { titleTemplate: o.titleTemplate } : null, o.defaults];
    // automatic canonical only where the path is the URL (history routing); in hash routing every route is one document
    if (o.site && o.canonical !== false && mode !== "hash") inputs.push({ canonical: true });
    if (S.route) inputs.push(S.route.get());
    for (const e of S.entries) inputs.push(e.get());
    const scripts = o.jsonLd !== false;
    const all = resolveHead(inputs, { ...(o.site ? { site: o.site } : {}), path: p });
    const tags = scripts ? all : all.filter((t) => t.tag !== "script");
    const lang = [...inputs].reverse().find((x) => x?.lang)?.lang;
    untrack(() => { applyHead(tags, { lang, scripts }); S.tags.set(tags); });
  }), null);
}

/** Turn on route heads: the router hands each route's `head` (and title) here on every navigation. */
export function installSeo(opts: SeoOptions = {}): void {
  S.opts = opts;
  setHeadHandler((to, head, title) => {
    if (!to) { S.route = { get: () => (opts.noindexNotFound !== false ? { robots: "noindex" } : null) }; bump(); return; }
    const h = head as RouteHead | undefined | null;
    S.route = { get: () => { const v = typeof h === "function" ? h(to) : h; return { ...(title && !v?.title ? { titleRaw: title } : {}), ...(v ?? {}) }; } };
    bump();
  });
  start();
  bump();
}

/**
 * Add head tags while the calling component lives (removed with it). `input` may be a function: it is tracked, so
 * signals read inside update the head.
 */
export function useHead(input: HeadInput | (() => HeadInput | null | undefined)): () => void {
  const e: Entry = { get: typeof input === "function" ? input : () => input };
  S.entries.push(e);
  start();
  bump();
  const off = (): void => { const i = S.entries.indexOf(e); if (i >= 0) { S.entries.splice(i, 1); bump(); } };
  if (getOwner()) onCleanup(off);
  return off;
}

/** The tags written to <head> now (reactive): previews, tests. */
export const headTags = (): Tag[] => S.tags();

/** Reset (tests). */
export function _resetSeo(): void { S.opts = null; S.entries = []; S.route = null; setHeadHandler(null); bump(); }
