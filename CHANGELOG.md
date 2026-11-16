# Changelog

All notable changes to March. Versions follow [semver](https://semver.org/).

## 0.1.0 — unreleased

### The repository is github.com/marchjs-com/march
- Moved from tlghn/hadimarch with its whole history. Install with `npm i github:marchjs-com/march#<commit-sha>`; the
  MadeWithMarch link and the console banner point there; `package.json` has `homepage`, `repository` and `bugs`.

### cdn.marchjs.com
- `npm run build:cdn` (tools/build-cdn.js): every browser entry of the package as a minified ES module sharing its
  chunks, in `cdn/dist/<version>/` and `latest/`: `march.js`, `ui.js`, `app-ui.js`, `icons/<pack>.js`…, `march.css`
  (the tokens, the sx utilities and every component's styles), `importmap.json`, `files.json`.
- They are served at cdn.marchjs.com: CORS open, a version cached for a year, `latest/` for five minutes.
- The playground's last-build output loads MarchJS from the CDN (an import map of the modules it uses, `march.css`).

### The name is MarchJS
- The product is called **MarchJS** where it is shown: page titles, the showcase's trail, the READMEs, the console
  banner (`🧡 MarchJS v…`), the MadeWithMarch link ("Developed with MarchJS and 💗"), `<!-- Built with MarchJS -->`,
  a new app's `<title>`. The domain is marchjs.com (the site and cdn.marchjs.com come later).

### The package is `march` (was `hadi-march`)
- **Breaking:** imports are `march`, `march/ui`, `march/app-ui`, `march/icons`… (the product's name; the repository
  stays tlghn/hadimarch). The March compiler's esbuild plugin and the playground still resolve `hadi-march/…` to the
  same files for a while. `Symbol.for("march.banner")` and the `march:channels` tab channel follow the new name.
  Earlier entries below keep the old name.

### march-app-ui: the core of March IDE; DockLayout on its model (later in 0.1.0)
- New `AppUI` (`hadi-march/app-ui`, also `hadi-march/ui`): the core of March IDE and the base of an IDE shell, after HADİ
  Studio Kit. A top bar (title, `tools`, the Layout menu: presets, saved layouts, the panel list), a `side` slot (an
  ActivityBar), the DockLayout workspace and a `status` slot (a StatusBar). Built from DockLayout and Menu; colours from
  the page's theme and accent. The showcase's mini editor (IDE kabuğu: canlı demo) now stands on it.
- **Breaking:** `DockLayout` has a new model (Studio Kit's): rows and columns of tab groups with weights; closing
  collapses a group to a strip (vertical in a row, horizontal in a column) and keeps its size for the way back; presets
  (`presets` written with `row`, `col`, `tabs`), saved layouts, focus mode, `place` for panels the layout does not know,
  one tab group under `narrow` px. Floating windows, the tray and `DockSpec` / `DockState` are gone (`layout` is now a
  tree, the state a `DockTree`); `api.minimize` → `api.collapse`, `api.open(id)` shows a panel. Built from TabList
  (Tabs), IconButton, Button, ResizeHandle (every splitter) and Menu's panel; panels never move in the DOM.
- `hadi-march/app-ui` also exports the layout tree with no DOM (move, collapse, restore, geometry, hit test,
  save / restore).
- New built-in theme `studio` (Studio): navy panels, orange active tab, sky-blue focus, Bricolage, compact.

### Common props: m:color, m:theme, m:dir, m:lang, m:tip, m:reveal, m:can, m:test (later in 0.1.0)
- New common props (`hadi-march/props`, every element and component): `m:color` (colour scope), `m:theme` (a subtree
  in another colour theme), `m:dir`, `m:lang`, `m:tip` (a hint without a Tooltip wrapper), `m:reveal` (entrance once
  in view), `m:can` (hidden, or disabled with `{ allow, else: "disable" }`), `m:test` (`data-testid`). A text constant
  on a native element compiles to the attribute itself.
- **Breaking:** the components whose `color` prop only coloured their own root take `m:color` instead (their `color`
  prop is gone): Accordion, Alert, ChatBubble, CheckMark, Chevron, Chip, ClampText, CornerMark, EditorFrame, ExplodedView, HonestCompare, IconButton, IconTile, OptionList, OverflowToolbar, Overlay, PageDots, Pagination, PanelHeader, ProjectDetail, PullToRefresh, Rating, ReactionPicker, ReplyQuote, ResizeHandle, Roadmap, SearchBox, SectionHead, SectionLabel, StatTile, StatsBand, StatusDot, Stepper, Steps, TimeRuler, Tree, TreeView, VerifiedMark, Wizard. Write `<Chip m:color="brand-blue">`; by hand `mProps(h(Chip, props), { color: "brand-blue" })`.
  Inside the library the same is done by `withColor(node, color)` (src/theme/colors.ts, internal).
- **Breaking (second round):** `color` is also gone from every form control (it came from the shared control props:
  TextInput, Select, Toggle, Checkbox, Slider, Segmented, CheckboxGroup, RadioGroup, Calendar, DatePicker, CodeInput…),
  from `<Field>` and `<Form>`, and from Button, ActionButton, CopyButton, Menu, Badge, Tabs / TabList, ActivityBar,
  FormatToolbar, FollowButton, LikeButton (pink unless `m:color` says otherwise), TypingIndicator (blue unless…),
  StoryRing, SiteSection, Pricing, ProjectGrid, Splitter, Carousel, PeriodNav, RowTools, ScrollToTop, UndoRedo,
  CodeEditor, JsonEditor, DateRangePicker, DateTimeInput: the root's `m:color` reaches their parts (a calendar or menu
  panel takes the colour of its anchor). CopyButton keeps `copiedColor`.
- Kept, because the colour means more than the root's scope: Spinner and Progress (one colour switches them to a single
  colour), Loader and ScrollProgress (passed to those), Tooltip and Popover (the bubble / panel), Avatar (its colour
  from the name), AvatarGroup, Swatch (the colour shown), Window, StoryProgress, Presentation; and the colours of
  items (a Gantt task, a Scheduler event, a feed item, a story step). Named colours of inner parts (`likeColor`,
  `jumpColor`, `messageColor`…) stay as they are.

### m:parts, CodeEditor, ExplodedView (later in 0.1.0)
- `m:parts` (common prop): `<PostCard m:parts={{ Avatar: { size: "lg" }, LikeButton: { color: "brand-blue" } }} />`
  gives props to the components drawn inside any element or component, by component; no composite needs a prop of
  its own. The compiler turns the names into the components (`withParts(new Map([[Avatar, {…}]]), () => …)`,
  `hadi-march/props`); a name that is not in scope is a compile error. The scope's props win over the parent's, the
  nearest scope wins, values stay live. Core: one hook in component creation (set by `hadi-march/props`).
- CodeEditor (`hadi-march/ui`): a code field coloured as it is typed, suggestions at the caret (`complete`; ready
  for a JSX tag: `jsxCompleter`), marked ranges (`marks`: flash / error), a foot line (`message`, `status`).
- ExplodedView (`hadi-march/ui`): the same elements tilt and rise as plates and come back (`parts`: selectors and
  names; without it the layers of one element: shadow, surface, content, focus ring); `onPick`, `active`.
- DevicePreview `fitHeight`. `ComponentMeta.root`. Playground specs can write code: `PlaygroundOption.prop` /
  `toCode` / `fromCode`, kind `"text"`, `PlaygroundSpec.code` (`{ tag, props, children, root }`).

### Theme style and eight new themes (later in 0.1.0)
- `ThemeDef.style` (`ThemeStyle`): `surface` ("soft" | "flat" | "raised" | "outlined" | "glass"), `glow` (0–1), `shadow`
  ("soft" | "hard" | "none"), `accent` ("solid" | "gradient"), `tracking`, `iconStroke`, `density`, `borderWidth`.
  `themeCss` turns them into tokens: `--m-panel-bg`, `--m-panel-raised-bg`, `--m-panel-border`, `--m-panel-shadow`,
  `--m-panel-filter`, `--m-bg-image`, `--m-primary-fill`, `--m-accent-glow`, `--m-tracking-tight`, `--m-icon-stroke`.
  Card, StatTile, Dialog, Drawer and the popover / menu panel read the panel tokens; the primary Button reads the fill
  and the glow. A theme resets the tokens it does not set, so a theme scoped inside another keeps its own look.
- Every hairline reads `--m-border-w` (it was a fixed 1px in 77 stylesheets): the border width of a theme now reaches
  every component.
- Eight built-in themes (15 in all): Aurora, Noir Gold, Ember, Voyage (always dark), Graphite, Paper, Mint, Candy.
- ThemeEditor: a Style tab (surface, glow, shadow kind, accent fill, heading letter spacing, icon stroke); the draft
  has a `style` part, kept in JSON, share links and the generated `defineTheme` code. `spaceTokens(space, density)`.

### FontPicker (later in 0.1.0)
- New component `FontPicker` (`hadi-march/ui`): device fonts and a web font catalog (Google Fonts by default, about
  1,900 open-licensed families) in one searchable list; each name in its own type (only the letters shown are
  requested, only for the rows in view), a specimen with editable sample text, size, weight and italic, filters by
  category, subset and order, favourites and recent picks; `view="popover" | "dialog" | "inline"`.
- Privacy and CSP: `askConsent` (no request before the visitor allows it), `source` (Google, your own server that
  answers `/css2`, a function, or `false`), `catalog` (your own families). Helpers: `loadFont`, `fontUrl`, `fontStack`,
  `filterFonts`, `googleFonts`. The catalog is a lazy part made by `tools/gen-font-catalog.mjs`.
- VirtualList: `role` (a listbox or menu of your own rows), `id`, and `api` with `scrollToIndex(i, align)`.
- Popovers are placed by their laid-out size, so a scaling entrance no longer shifts a panel near the screen edge.

### Common props: `m:no-select` (later in 0.1.0)
- A new namespace, `m:`, for props that work on every native element and every component. First member:
  `m:no-select` (boolean): the element and its whole subtree cannot be selected (the text typed into inputs and editors stays selectable);
  `m:no-select={false}` inside a blocked subtree makes that part selectable again (the nearest one wins).
- A constant on a native element compiles to the attribute `data-m-no-select` (no runtime code; the CSS rules are in
  `hadi-march/css/props.css`). Live values and components compile to `mProps()` from the new `hadi-march/props`
  module, which applies the prop to the component's root elements; the core entry does not grow.
- Open list: `registerMProp(name, apply)` adds a member; `M_ATTRS` (`hadi-march/compiler`) adds an attribute-only one.

### Prefix is `m` (breaking, later in 0.1.0)
- The framework prefix is `m` everywhere, in place of the earlier two-letter one: classes (`m-btn`), CSS variables
  (`--m-primary`), data attributes (`data-m-color`), keyframes (`m-fade-in`), ids (`#m-boot`, `uid()` gives `m-1`),
  the `?m-path=` fallback parameter, `<meta name=m-config>`, performance marks (`m:`), and every storage, channel and
  symbol key (`m.theme`, `m.colorTheme`, `m.accent`, `m.consent`, `m.nav`, `m.session`, `m.sync` …). History state
  fields are `mKey`, `mModal`, `mBg`, `mIdx`. Nothing was published under the old names, so there is no migration:
  rename them in your own stylesheets and selectors.
- `march check component` and `test/prefix.test.js` keep the rule: classes start with `m-` (state: `is-`), and no
  class takes a margin-utility name of other libraries (`m-0` … `m-5`, `m-auto`, `m-px`).

### Fewer files from the chunk packer (later in 0.1.0)
- `march build`'s packer ends with a forced step: a shared chunk still under the floor joins a host even when a route
  or lazy part it reaches is already over its budget (that row fails either way; a file of its own only adds a request),
  and a shared chunk under `chunks.forceSize` (default 2 KB) is never a file of its own. Budgets within their limit are
  kept in the first case; start-up's budget is kept in both.

### Normal addresses on every host (later in 0.1.0)
- The router uses normal addresses under any base path: `createRouter({ mode: "history", base: "auto" })` (the
  defaults). The base comes from a `<base href>`, the base `march build` writes into `index.html`, or the entry
  script's folder. Where the address cannot change (`file://`, a sandboxed iframe) it falls back to `#/` addresses with
  the same routes; old `#/x` links become `/x`. `<Link>` writes hrefs relative to the current address.
- `hadi-march/base`: `appBase()`, `appUrl("media/a.jpg")` (public files under the root on every route), `setAppBase()`.
- `march build` writes `<route>/index.html` for every route without params (`seo.routes` for pages under a wildcard),
  the app shell where a page could not be prerendered, and `404.html` + `march-404.js` for every other address;
  `redirects: true` writes `_redirects`. Hosting guide: `docs/hosting.md`. `tools/menu-audit.mjs` opens every showcase
  page directly, on reload, from the menu and with back/forward on a rewrite host, a static host, a sub-folder and
  from files.
- The showcase moved from `#/motion` to `/motion`.
### Icon packs (later in 0.1.0)
- Open-source icon sets as optional subpaths, one export per icon: `hadi-march/icons/lucide`, `/tabler`, `/heroicons`,
  `/phosphor`, `/feather`, `/material-symbols`, `/remix`, `/bootstrap`, `/simple-icons` (about 22,000 icons; each pack
  ships its license). A shared drawing layer keeps each set's grid, stroke width or fill and mirrors direction icons in
  right-to-left text; start-up code is unchanged.
- `hadi-march/icons/packs`: `registerIconPack`, `icon("lucide:rocket")` for any icon prop, `<Icon name="…" />`,
  `loadIcon`, `packIcon`. No prefix means the March set.
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
- `<MadeWithMarch />` (`src/components/actions/made-with-march`): optional "Developed with March and 💗" line, variants text / badge / small, link in one constant (`MARCH_URL`). The licence stays MIT; using it is a request.
- `credit: true` in `march.config.js` adds `<!-- Built with March -->` to the built `index.html` (off by default).
- Console banner: `march dev` prints one styled line ("🧡 March v0.1 · link") once per page; `banner: false` removes it. Production prints nothing and the bundle is byte-identical; `credit: true` prints the same line in production from a separate `credit.js`. The link constant moved to `src/brand.js`.
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
- CSS class collisions: the markdown editor mode switch now uses `.m-editor-tabs`/`.m-editor-tab` and `CodeInput` uses
  `.m-otp`/`.m-otp-box`, so they no longer restyle `Tabs` (`.m-tabs`) and `CodeBlock` (`.m-code`). Regression test added.
- `Tabs` bar no longer shows a stray vertical scrollbar (the active tab underline overlapped the bar border).

### Added (later in 0.1.0)
- TypeScript: the whole library source is strict TypeScript (no `any`); `build:lib` emits ESM + declarations; JSX types
  (`types/jsx.d.ts`); `march check` type-checks the full March syntax; `hadi-march/register` runs .jsx/.tsx in node;
  TSX in the compiler (typed `# Changelog

All notable changes to March. Versions follow [semver](https://semver.org/).

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
