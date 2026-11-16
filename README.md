# MarchJS

**Run once, then march.** A small, fast framework for TypeScript and JavaScript where components run a single time and
only the DOM that depends on a changed value updates — no virtual DOM, no re-renders, no runtime dependencies.

```tsx
let $count = 0;
const $double = $count * 2;

export function Counter(props: { label: string }) {
  return <button on:click={() => $count++}>
    {props.label}: {$count} × 2 = {$double | number}
  </button>;
}
```

- **Fine-grained signals.** `$` variables are signals; a `const $x = …` that reads them is computed. A text node or attribute
  that reads a signal is bound to it directly; updates touch exactly those nodes.
- **TypeScript throughout.** Written in strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no
  `any`). Types flow end to end: `Infer<typeof Schema>` into forms and tables, typed store paths, typed routes
  (`navigate("/nope")` is a compile error), typed i18n catalogs, typed actions. `march check` type-checks the full JSX syntax.
- **Small.** Core entry ≈ 10.2 KB gzip, a minimal counter app ≈ 5 KB (enforced by a test). Everything else is a separate,
  lazily loaded module.
- **Secure by default.** No `innerHTML` anywhere, URL attributes sanitized, no `<script>`, no inline styles; runs under
  `script-src 'self'`, `style-src 'self'`, `require-trusted-types-for 'script'; trusted-types 'none'`.
- **Batteries included:** router (file based, nested layouts, typed hrefs), data (`query`/`mutation`), store (path events,
  persist, undo/redo), schema → forms → tables, access control, UI kit, data table (100k rows), charts, motion
  (springs, FLIP, timelines, gestures, View Transitions), fx (particles, aurora), i18n (ICU plural/select, RTL), testing.
- **Friendly to humans and AIs:** few concepts, clear compile errors with code frames, dev warnings,
  [`AI_INSTRUCTIONS.md`](AI_INSTRUCTIONS.md), [`llms.txt`](llms.txt).

## Getting started

The only build tool is [esbuild](https://esbuild.github.io/) (TypeScript is optional, for `march check`).

```bash
npm i github:marchjs-com/march#<commit-sha>   # pin a commit; not on the npm registry yet
npm i -D esbuild typescript
node node_modules/march/cli/march.js dev      # index.html + src/main.tsx, live reload, error overlay
node node_modules/march/cli/march.js build    # dist/: release build (chunk planning, budgets, prerender)
node node_modules/march/cli/march.js build --dev [--watch]   # fast build: one pass, incremental with --watch
node node_modules/march/cli/march.js check    # type-check, including March syntax
```

Without a build: from **cdn.marchjs.com** (every module as a browser ES module, one stylesheet). A page made in the
browser IDE (Playground → Console → "Son derlemeyi göster", or the Terminal's `output`) is exported this way.

The newest version, one line:

```html
<script type="module" src="https://cdn.marchjs.com/latest/march.js"></script>
```

A pinned version, with an import map:

```html
<link rel="stylesheet" href="https://cdn.marchjs.com/0.1.0/march.css" />
<script type="importmap">
  { "imports": { "march": "https://cdn.marchjs.com/0.1.0/march.js", "march/ui": "https://cdn.marchjs.com/0.1.0/ui.js" } }
</script>
```

Every entry is there (`march/app-ui` → `app-ui.js`, `march/icons/lucide` → `icons/lucide.js`…), the whole map in
`https://cdn.marchjs.com/0.1.0/importmap.json`; `latest/` follows the newest version (cached briefly; pin a version).

Node runs `.ts`/`.tsx` sources directly: `node --import march/register --test` for component tests. March ships its
TypeScript sources; node refuses to strip types under `node_modules`, so the CLI, the compiler and `march/register`
strip or relocate March's own files themselves (node >= 22.18). Importing `march` from plain node needs `--import march/register`.

## The language (compiled by the esbuild plugin)

| Write | Means |
|---|---|
| `let $n = 0` / `let $n: number = 0` | `const $n = signal<number>(0)` |
| `$n++`, `$n = 5`, `$n += 2` | `$n.set(…)` |
| `const $d = $n * 2` | `computed(() => $n() * 2)` |
| `{$n}` in JSX | live text node |
| `title={user.name}` | live attribute (any non-constant expression) |
| `on:click\|prevent={fn}` | listener with modifiers (`prevent stop once self capture passive`) |
| `bind:value={$name}` | two-way binding (`value`, `checked`, `group`, `this`) |
| `class:active={$on}` | toggle a class |
| `use:tilt={{ max: 8 }}` | action `tilt(node, arg)` (may return cleanup) |
| `transition:blur` | enter/leave animation (`fade slide scale` built in; `blur fly …` with motion) |
| `{price \| money("EUR")}` | formatting pipe (Intl, follows the locale) |
| `<Row {user} {onSave} />` | shorthand attributes |
| `sx={{ p: 2, gap: 1, cols: 3 }}` | design-token classes resolved at build time |
| `async function Page() { … await … }` | async component; loading/error handled by the nearest `<Try>` |
| `` t`Hello ${name}` `` / `t("cart", { n })` | translated text (ICU plural/select) |

Runtime names and your `src/components/*` are auto-imported. Without the compiler, use `h(tag, props, ...children)`.

## Modules

| Import | What |
|---|---|
| `march` | signals, store basics, JSX runtime, control flow, pipes, `t`, `define()` |
| `march/props` | `m:` common props for every element and component (`m:no-select`), `mProps`, `registerMProp` |
| `march/store` | `subscribe`, `on(store, "users.*.name")`, `persist`, `history`, `readonly`, `snapshot`, `derive` |
| `march/i18n` | ICU `format`, `loadLocale`, `dir`, `typed<Catalog>()`; `march/i18n/tr` Turkish pack |
| `march/router` | file routes, `_layout` files, redirects, guards, `beforeLeave`, preload, `setMeta`, typed `Href` |
| `march/seo` | route `head`, `useHead`, Open Graph / Twitter, JSON-LD (`ld.*`), prerender + `hydrate`, sitemap/robots, `march seo check` |
| `march/data` | `query`, `mutation`, `invalidate`, `fetchJson`; `setAccess`, `can`, `<Can>`, `<Gate>` |
| `march/schema` | `schema({...})`, `Infer<>`, validation, coercion, columns |
| `march/ui` | Page, AppShell, NavMenu, CommandPalette, Dialog (`confirm`/`prompt`/`askReason`), Toast, Tabs, forms… |
| `march/table` | sort, filters, saved views, server paging, virtual scroll, selection, inline edit, CSV, URL sync |
| `march/crud` | `crud(source, { schema })` list/create/edit/delete |
| `march/charts` | Line, Area, Bar, Pie, Sparkline, Stat, Heatmap, ProgressRing, BarList |
| `march/motion` | `animate`, `spring`, `tween`, `timeline`, FLIP `<For animate>`, `inView`/`reveal`/`parallax`, page transitions, `drag`/`swipe`/`magnet`/`tilt` |
| `march/fx` | `Particles`, `Aurora`, `Noise`, `spotlight`, `confetti` |
| `march/testing` | tiny DOM for `node --test`, `renderTest()`, `mockFetch` |

Docs: [`docs/`](docs) · Examples: [`examples/`](examples) (counter, form, router, async, table, charts, **showcase**) ·
Türkçe: [`README.tr.md`](README.tr.md) · Changes: [`CHANGELOG.md`](CHANGELOG.md)

## Themes

Every component reads design tokens (CSS custom properties). A theme is ~25 colors per mode (light and dark), a body and a
display font and a base radius; surfaces, hover and soft tints, borders, radii and shadows are derived with `color-mix()`.
Built-in themes (`src/theme/presets.ts` → `src/css/themes.css`): **hadi** (default, the HADİ Sosyal brand: Figtree +
Bricolage Grotesque), cream, night, neon, indigo, minimal, contrast. Switching is one attribute, no inline styles:

```js
import "march/css/font.css";      // self-hosted Inter, Figtree, Bricolage Grotesque (OFL), font-src 'self'
import "march/css/tokens.css";     // tokens + every built-in theme
import { setColorTheme, setTheme, ThemePicker } from "march/ui";

setColorTheme("neon");                 // <html data-m-theme="neon">, remembered in localStorage
setTheme("dark");                      // light | dark | system
<ThemePicker />                        // theme list with live swatches + appearance switch
<section data-m-theme="night">…</section>   // scope a theme to part of the page
```

Write your own: `defineTheme({ id, name, font, display, radius, light: {...}, dark: {...} })` from `march/theme`,
write `themeCss(def)` to a .css file at build time, load it, and `registerThemes([{ id, name }])` to offer it in pickers.
Icons: `march/icons` (160 original SVG icons, each a separate export, rendered with createElementNS) and optional open-source packs, one export per icon: `march/icons/lucide`, `/tabler`, `/heroicons`, `/phosphor`, `/feather`, `/material-symbols`, `/remix`, `/bootstrap`, `/simple-icons` (licenses included; `march icons add` updates them). See [docs/icons.md](docs/icons.md).
Live gallery of everything: `node examples/showcase/build.mjs --serve`.

## Only what you use is bundled

Every component lives in its own module with its own stylesheet (`src/ui/button.ts` + `src/ui/button.css`, …). Apps
import `march/css/tokens.css` (variables, base styles and the default HADİ theme) and the components they use; the
March esbuild plugin (`march build` / `march dev`) does the rest:

- **JS:** modules are side-effect free (`sideEffects` lists only CSS and `march/motion/install`), so unused code is
  tree-shaken. A `<Button href>` binds to the router only when the app has one.
- **CSS follows code:** a component's stylesheet goes into the output chunk where the component's code landed. The initial
  entry's CSS is linked from `index.html`; lazy pages and shared chunks get their own `.css`, loaded by the chunk before it
  runs (no flash of unstyled content, CSP `style-src 'self'`). Unused components' CSS is never shipped.
- **Themes on demand:** only the default theme is in the bundle; `setColorTheme("neon")` loads `themes/neon.css`
  (`march build` copies the built-in themes to `dist/themes/`; `setThemeBase()` or `registerThemes([{ id, href }])`
  for other locations).
- **Motion:** `march/motion` has no side effects; `import "march/motion/install"` (or call
  `installTransitions()` / `installFlip()`) for the extra `transition:` names and `<For animate>`.

Without the plugin, `march/css/ui.css` and `march/css/forms.css` still bundle every component's CSS.

| What                                         | before (one stylesheet, router always) | now            |
| -------------------------------------------- | -------------------------------------- | -------------- |
| App with one `<Button>` — JS, min / gzip     | 20.4 KB / 8.1 KB                       | 14.6 KB / 5.9 KB |
| App with one `<Button>` — CSS, min / gzip    | 109.5 KB / 17.2 KB (+ forms 19.1 KB)   | 15.7 KB / 3.9 KB |
| Themes in the bundle                         | 7                                      | 1 (others lazy) |

`test/size.test.js` builds the one-Button app and fails if another component's class or code, another theme or the
router gets in, or if it grows past its budget (`node bench/size.js` prints the entry sizes).

## Performance, always

A March app is a single-page app that loads progressively: nothing is downloaded before it is needed, everything that
arrives is cached.

- **Small first download.** The entry holds the core, the router and the shell. Each route is its own chunk
  (`() => import("./pages/x.tsx")`); heavy components load with `lazy()`:
  `const Chart = lazy(() => import("./SalesChart.tsx"), { when: "visible", placeholder: "chart", height: "16rem" })`.
  `when` is `immediate` (default), `idle`, `visible` or `interaction`; the place is reserved (CLS 0), a skeleton of
  the given kind (`block`, `text`, `card`, `table`, `chart`, `form`) shows only after 100 ms (never for a cached chunk),
  and the content crossfades in. Errors show a retry in place. The command palette, themes and charts load on first use.
- **One entry file.** `march build` merges the entry and the chunks it imports statically into one file (better gzip,
  fewer requests); the old chunk files become re-export stubs, so lazy pages share the same instances.
- **No waterfalls.** `march build` writes a chunk manifest into `index.html` (a JSON data block, CSP safe). The compiler
  tags each `() => import()` with its key, so loading a route fetches all of its files at once with
  `<link rel="modulepreload">`. Named imports from `march/ui` etc. are compiled to the defining module, and bare
  imports of chunks the entry does not use are removed. Without both, esbuild would put page-only code into a chunk the
  entry must load.
- **Prefetch.** `<Link>` prefetches its route on hover/focus (`prefetch="hover" | "visible" | "idle" | "none"`). When idle after
  the first page, the router prefetches the routes linked from what is on screen with `<link rel="prefetch">` (lowest
  priority, at most 6). Both are off when the user saves data or the connection is 2G-class.
- **Cache.** File names are content-hashed; `march build` writes a `_headers` file (Netlify / Cloudflare Pages format)
  that serves `assets/*` as `immutable` and revalidates the page. With `sw: true` in `march.config.js` it also writes
  `sw.js`: `import { registerServiceWorker } from "march/sw"` caches chunks the first time they arrive, opens
  the app offline on the second visit and deletes the caches of older versions. `register()` is a Trusted Types sink:
  under `require-trusted-types-for 'script'` the CSP must allow the `march-sw` policy.
- **Budget.** Every build prints the gzip size of the entry, of each route (by its path, e.g. `/data`) and of each lazy
  part (`lazy()` components, locale packs) and writes `march-report.json`. With
  `budget: { entry: 15 * 1024, route: 60 * 1024, part: 25 * 1024, routes: { "/data": 80 * 1024 }, css: 40 * 1024, fail: true }`
  an overrun fails the build and names the row (`/data JS 82.3 KB > 80.0 KB`). When the entry is over,
  the build lists its largest modules (`march build --analyze` always does). The goal is under 15 KB of entry JS and an
  LCP under 1 s on slow 4G.
- **Icons** are one module each (`src/icons/glyphs/`, generated from `set.ts`). An icon gallery reads
  `march/icons/catalog` instead of `import * as icons`.

`npm run bench` creates/updates keyed lists of 1,000 and 10,000 rows and runs table, chart (10k–100k points with LTTB)
and animation scenarios. Only changed bindings update; keyed rows are reused and moved, never re-created.

## Security

The library never parses HTML. Text is always `textContent`; `href`/`src` with unsafe schemes become `about:blank`;
`<script>`, `<iframe>`, `innerHTML` and string `style` throw. Motion uses WAAPI/CSSOM (no style attributes). Access
helpers only decide what to show — your server must enforce permissions.

## License

MIT. The licence is unchanged and nothing below is required.

### A small request

If you made something with March, we would be glad if you added this line to your project or used the component:

```tsx
import { MadeWithMarch } from "march/ui";

<MadeWithMarch />                      // Developed with MarchJS and 💗
<MadeWithMarch variant="badge" />      // or "small"
```

Prefer no visible text? `credit: true` in `march.config.js` only adds the comment `<!-- Built with MarchJS -->` to the built `index.html`. The comment is off by default; with it on, production also prints one console line. `march dev` prints a banner once per page (`banner: false` turns it off); production bundles never contain it.
