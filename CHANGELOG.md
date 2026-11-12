# Changelog

All notable changes to HADI March. Versions follow [semver](https://semver.org/).

## 0.1.0 — unreleased

### Icon packs (later in 0.1.0)
- Open-source icon sets as optional subpaths, one export per icon: `hadi-march/icons/lucide`, `/tabler`, `/heroicons`,
  `/phosphor`, `/feather`, `/material-symbols`, `/remix`, `/bootstrap`, `/simple-icons` (about 22,000 icons; each pack
  ships its license). A shared drawing layer keeps each set's grid, stroke width or fill and mirrors direction icons in
  right-to-left text; start-up code is unchanged.
- `hadi-march/icons/packs`: `registerIconPack`, `icon("lucide:rocket")` for any icon prop, `<Icon name="…" />`,
  `loadIcon`, `packIcon`. No prefix means the HADI March set.
- `march icons list | add <pack> | gallery <dir>`: converts a set from its official npm package (sha512 checked,
  nothing in it is run); licenses outside MIT, ISC, Apache-2.0, CC0-1.0, CC-BY-4.0, OFL-1.1 are refused.
- `<Icon>` follows live props (`size={$size}`); `deepImports` leaves `import` lines inside strings (code samples) alone.
### API reference (later in 0.1.0)
- The showcase API reference shows the active language: one-line Turkish summaries for every export
  (`docs/api.tr.json`), English for every other language; only that language's data parts download.
- A card opens into the export's signature, example code and live result (Playground when it has options); examples load
  lazily per group of subpaths.
- `<Switch>/<Match>`, `<Await>`, `<Dynamic>` and `missing` / `unused` / `setFallbackLocale` moved to their own modules
  (same import paths): an app that uses them on a lazy page no longer carries them in its start-up chunk.

### Credit (later in 0.1.0)
- `<MadeWithMarch />` (`src/components/actions/made-with-march`): optional "Developed with HADI March and 💗" line, variants text / badge / small, link in one constant (`MARCH_URL`). The licence stays MIT; using it is a request.
- `credit: true` in `march.config.js` adds `<!-- Built with HADI March -->` to the built `index.html` (off by default).
- Console banner: `march dev` prints one styled line ("🧡 HADI March v0.1 · link") once per page; `banner: false` removes it. Production prints nothing and the bundle is byte-identical; `credit: true` prints the same line in production from a separate `credit.js`. The link constant moved to `src/brand.js`.
### Text animations (later in 0.1.0)
- `hadi-march/motion/text`: 56 text animations, one export each (entrances / exits, loops, decorations, content effects
  such as typewriter, scramble, counter, odometer, word cycle, morph, and pointer effects). One shared core: `splitText()`
  (accessible hidden copy + aria-hidden parts, grapheme clusters, RTL, joining scripts by word) and a stagger runner.
- Everything plays on the motion engine (global speed, pause all, reduced motion). The core is about 1.5 KB gzip, each
  animation 25–520 B more (`bench/text-size.js`, budget test). Catalog: `hadi-march/motion/text/meta`.
### Chunks and budgets (later in 0.1.0)
- Route tables (`src/routes.ts`, `src/routes.gen.js`, `chunks.routeTables`): their lazy imports are pages; they group
  like the entry's own and are never folded into the table, so a start-up route table does not grow with pages.
- Page groups respect `budget.route`: a merge whose download would be over it is not made, and a built group that is
  over it is taken apart and planned again; a small page left alone joins the cheapest group within budget.
- Showcase: the route table and the page list left the entry (start-up chunk with the shell pieces); entry 15.3 → 14.3 KB.

### SEO (later in 0.1.0)
- `hadi-march/seo`: `installSeo({ site, titleTemplate, defaults })`, route / page `head`, reactive `useHead()`, Open
  Graph and Twitter cards, automatic canonical (history routing), `noindex` on not-found, JSON-LD builders (`ld.*`).
- `march build` with `seo: { prerender }` writes each route's HTML (head and route CSS included) at build time, plus
  `sitemap.xml` and `robots.txt`; `hydrate()` (`hadi-march/seo/hydrate`) takes the markup over without a blank frame
  and drops it at once when the URL shows another route (hash routing safe).
- `march seo check`: missing title, description, canonical, img alt, invalid JSON-LD; `checkHtml()` in the browser.
- Router: `head` on routes and page modules, `setHeadHandler()`.

### Editors (later in 0.1.0)
- `RichTextEditor` (composite): contenteditable rich text whose value is Markdown — toolbar (paragraph, headings, bold,
  italic, strike, code, link, lists, quote, code block, undo / redo), Markdown shortcuts while typing, @mentions and
  :emoji suggestions, clean paste, its own undo history. Showcase page Editors.
- Safe content core: `dom/safe.ts` (`isSafeLink`, `RICH_SCHEMA`), `dom/sanitize.ts` (`parseHtml` — HTML → allowlisted
  nodes with a small tokenizer, no HTML parser, Trusted Types safe; `sanitizeNode`, `normalizeBlocks`),
  `dom/markdown.ts` (`markdownNodes`, moved out of forms; mention links) and `dom/to-markdown.ts` (`toMarkdown`).
- `managers/undo/history.ts`: the undo engine on its own; `undoHistory()` gives an editor a separate history.
- New icons: bold, italic, strikethrough, heading, pilcrow, quote, list-ordered, undo, redo, braces, play, pause,
  skip-back, repeat, rotate-cw, rotate-ccw, flip-horizontal, crop, pipette.
- Build: a chunk that only one small lazy module imports joins that module (a heavy lazy demo is no longer judged by
  its 3 KB entry file and inlined into every page that lists it).

### Build output (later in 0.1.0)
- `stableNames: true` / `--stable-names`: `main.js`, `chunks/home.js`, `chunks/shared-N.js` with `?v=<version>` in every
  reference (imports, CSS loaders, index.html, manifest): deploys overwrite the same paths; deterministic output.
- `packChunks`: tiny shared chunks fold into a chunk always loaded with them (showcase JS 129 → 69 files).
- No output name starts with `_` or `.` (`_layout` → `layout`); `headers: false` skips `_headers`.

### Portals and layers (later in 0.1.0)
- `dom/portal.ts`: one layer stack (`<Portal layer>`, `openLayer`): last opened on top, modal layers make the page and lower
  layers `inert`, toasts / fx above. Dialog, Drawer, openDialog, popovers, menus, tooltips, toasts and confetti use it.
- Named targets: `<PortalTarget name>` + `<Portal to order>`; sources sorted, cleaned up with their owner, waiting for a
  target that is not mounted yet. No code appends to `document.body` itself (test).

### Router outlets (later in 0.1.0)
- Persistent layouts: `<Outlet />`; a layout mounts once and survives navigation below it, only the deepest changed
  level is rebuilt. Per-level error boundary (retry) and busy state; the shell paints before the page on first load.
- Named outlets (`outlets` option, `?~name=/path`, `openOutlet`, `<Link outlet>`) and modal routes (`<Link modal>`,
  `navigate(to, { modal: true })`, `<Outlet name="modal">`, `closeModal()`); a lazy `router/outlets` part.
- View Transitions name only the changed outlet (the shell stays still). A second `createRouter()` disposes the first.
- `core/util.ts`: `val`, `cx`, `rest`, `uid`, `on`, `later`, `debounce`… (ui/util re-exports them and adds icons).

### Progressive loading (later in 0.1.0)
- `lazy(() => import("./X.tsx"))` (`hadi-march/lazy`, auto-imported): component chunks with a skeleton, `.preload()`.
  Options: `when` (immediate | idle | visible | interaction), `placeholder` skeletons (CSS only, after 100 ms),
  `height` / `aspect` reserve (CLS 0), `pick`, crossfade + stagger, retry on error. `setLoadDelay(ms)` simulates a slow
  network. Production builds merge the entry closure into one file (`mergeEntry`, off with `mergeEntry: false`);
  every rewritten JS file is then renamed by the hash of its final content and of what it reaches (`rehashOutputs`),
  so an immutable cached file can never load another build's entry. `base: "./"` writes relative asset URLs.
  The old internal children marker is now `lazyChildren` (compiler helper).
- Build manifest in `index.html` + loader tags from the compiler: a route's chunks preload at once (`modulepreload`).
  `<Link prefetch="hover|visible|idle|none">`; idle `rel=prefetch` of on-screen links; off with Save-Data / 2G.
- Named imports from March barrels compile to the defining module, and bare imports of unused side-effect-free chunks
  are pruned, so pages' code no longer rides along with the entry. `display.ts` is split per component; icons are one
  module each (`glyphs/`, generated) plus `hadi-march/icons/catalog` for galleries; the command palette view loads on
  first open. Showcase entry: 70.9 → 42.6 KB gzip (sum of files).
- `march build`: per-route gzip report (rows named by route path; entry / route / part) + `march-report.json`,
  `budget` (`entry`, `route`, `part`, per-route `routes`, optional `css`; warn / `fail`), largest entry modules
  (`--analyze`), `_headers` (immutable assets), optional `sw.js` (`sw: true`) with `hadi-march/sw`.

### Fixed (later in 0.1.0)
- Works when installed under `node_modules` (e.g. `npm i github:tlghn/hadimarch#sha`): node refuses to strip types there, so
  the compiler (auto-import table, `sx`) imports March's sources from a mirror in the OS temp folder, and
  `hadi-march/register` strips March's own `.ts` files with `module.stripTypeScriptTypes`. `types/` (JSX types) is now part of
  the package files. Node >= 22.18.
- CSS class collisions: the markdown editor mode switch now uses `.hm-editor-tabs`/`.hm-editor-tab` and `CodeInput` uses
  `.hm-otp`/`.hm-otp-box`, so they no longer restyle `Tabs` (`.hm-tabs`) and `CodeBlock` (`.hm-code`). Regression test added.
- `Tabs` bar no longer shows a stray vertical scrollbar (the active tab underline overlapped the bar border).

### Added (later in 0.1.0)
- TypeScript: the whole library source is strict TypeScript (no `any`); `build:lib` emits ESM + declarations; JSX types
  (`types/jsx.d.ts`); `march check` type-checks the full March syntax; `hadi-march/register` runs .jsx/.tsx in node;
  TSX in the compiler (typed `# Changelog

All notable changes to HADI March. Versions follow [semver](https://semver.org/).

 declarations, generic arrows, inline return types).
- Store v2 (`hadi-march/store`): path events with wildcards, typed `Path<T>`, batch groups, persist, history, readonly,
  snapshot, derive, dev change log.
- i18n v2 (`hadi-march/i18n`): ICU plural/select/number/date, lazy locale packs, RTL `dir()`, typed catalogs; Turkish pack.
- Router v2: nested `_layout` files, redirects, preload, `beforeLeave`, `setMeta`, typed hrefs, `queryParam`.
- Motion (`hadi-march/motion`): WAAPI `animate`, transitions (fade/slide/scale/blur/fly), `tween`/`spring`, FLIP for
  `<For animate>`, `timeline` with stagger, scroll reveal/progress/parallax, page transitions (View Transitions),
  gestures (drag, swipe, press, magnet, tilt), reduced-motion aware; motion.css effects.
- fx (`hadi-march/fx`): Particles, Aurora, Noise, spotlight, confetti. Showcase example.
- UI: AppShell, Disclosure, Media; crud(); forms EditForm, RecordListEditor, `records` field type.
- compiler: project components exported only as default are auto-imported (`import X from …`).
- testing: `cancel()` also finds localized cancel buttons.
- UI: `Disclosure` collapsible section (native details/summary).
- UI: `Media` (image / video / audio that fits its box, safe URLs, error fallback), `openMedia(src, opts)` dialog and `mediaKind(src)` (src/ui/media.ts).
- forms: `RecordListEditor` and the `records` field type (array of objects edited with a sub-schema; row validation, add/move/remove).
- Table: `search={false}` (hide the search box) is no longer taken as the initial search text (createTable crashed on `false.trim`).
- forms: the on/off input is `Toggle` (was `Switch`, which clashed with the `<Switch>` control flow under auto import).
- compiler: `f(x, $a)` — a $ variable after a comma inside call arguments is a read, not an object shorthand.

### Added (first cut)
- Core: fine-grained signals (`signal`, `computed`, `effect`, `batch`, `untrack`), ownership with automatic cleanup,
  context, `store`/`patch`, real-DOM renderer `h()` with live bindings and directives, control flow (`If/Else`, keyed
  `For`, `Switch/Match`, `Try`, `Await`, `Portal`, `Dynamic`), async components, Intl pipes, i18n `t`…``, `sx` tokens,
  `define()` web components. Security: no HTML strings, URL sanitizing, no `<script>`/`<iframe>`, no string styles.
- Compiler + esbuild plugin: March JSX, `$` signals and computed, directives, shorthand attributes, pipes, build-time
  `sx`, async owner restoration, auto imports, `css`…`` extraction, i18n key collection, code-frame errors.
- Router (file based, lazy pages, guards, `params`/`query` signals, `setQuery`, `Link`, scroll restoration).
- Data: `query` (cache, de-dup, retry, focus refetch, polling, abort), `mutation` (invalidate, optimistic), `fetchJson`.
- Access control: `setAccess`, `can`, `role`, `<Can>`, `<Gate>` (sign-in method / permission gates).
- Schema: field types, coercion (decimal-comma aware), validation, defaults, table columns.
- `action()` command objects (confirm, reason, undo, permission, busy, toasts).
- Charts module (Line, Area, Bar, Pie, Sparkline, Stat, Heatmap, ProgressRing, BarList; LTTB; accessible).
- Testing helpers (`installDom`, `renderTest`, `mockFetch`), CLI (`dev`, `build`, `gen routes|page|component|crud|api`,
  `i18n`, `--mock` from OpenAPI), size budgets and benchmarks, design tokens with light/dark themes.
