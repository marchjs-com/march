# HADI March

**Run once, then march.** A small, fast UI library for TypeScript and JavaScript where components run a single time and
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
npm i github:tlghn/hadimarch#<commit-sha>   # pin a commit; not on the npm registry yet
npm i -D esbuild typescript
node node_modules/hadi-march/cli/march.js dev      # index.html + src/main.tsx, live reload, error overlay
node node_modules/hadi-march/cli/march.js build    # dist/
node node_modules/hadi-march/cli/march.js check    # type-check, including March syntax
```

Node runs `.ts`/`.tsx` sources directly: `node --import hadi-march/register --test` for component tests. March ships its
TypeScript sources; node refuses to strip types under `node_modules`, so the CLI, the compiler and `hadi-march/register`
strip or relocate March's own files themselves (node >= 22.18). Importing `hadi-march` from plain node needs `--import hadi-march/register`.

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
| `hadi-march` | signals, store basics, JSX runtime, control flow, pipes, `t`, `define()` |
| `hadi-march/store` | `subscribe`, `on(store, "users.*.name")`, `persist`, `history`, `readonly`, `snapshot`, `derive` |
| `hadi-march/i18n` | ICU `format`, `loadLocale`, `dir`, `typed<Catalog>()`; `hadi-march/i18n/tr` Turkish pack |
| `hadi-march/router` | file routes, `_layout` files, redirects, guards, `beforeLeave`, preload, `setMeta`, typed `Href` |
| `hadi-march/data` | `query`, `mutation`, `invalidate`, `fetchJson`; `setAccess`, `can`, `<Can>`, `<Gate>` |
| `hadi-march/schema` | `schema({...})`, `Infer<>`, validation, coercion, columns |
| `hadi-march/ui` | Page, AppShell, NavMenu, CommandPalette, Dialog (`confirm`/`prompt`/`askReason`), Toast, Tabs, forms… |
| `hadi-march/table` | sort, filters, saved views, server paging, virtual scroll, selection, inline edit, CSV, URL sync |
| `hadi-march/crud` | `crud(source, { schema })` list/create/edit/delete |
| `hadi-march/charts` | Line, Area, Bar, Pie, Sparkline, Stat, Heatmap, ProgressRing, BarList |
| `hadi-march/motion` | `animate`, `spring`, `tween`, `timeline`, FLIP `<For animate>`, `inView`/`reveal`/`parallax`, page transitions, `drag`/`swipe`/`magnet`/`tilt` |
| `hadi-march/fx` | `Particles`, `Aurora`, `Noise`, `spotlight`, `confetti` |
| `hadi-march/testing` | tiny DOM for `node --test`, `renderTest()`, `mockFetch` |

Docs: [`docs/`](docs) · Examples: [`examples/`](examples) (counter, form, router, async, table, charts, **showcase**) ·
Türkçe: [`README.tr.md`](README.tr.md) · Changes: [`CHANGELOG.md`](CHANGELOG.md)

## Themes

Every component reads design tokens (CSS custom properties). A theme is ~25 colors per mode (light and dark), a body and a
display font and a base radius; surfaces, hover and soft tints, borders, radii and shadows are derived with `color-mix()`.
Built-in themes (`src/theme/presets.ts` → `src/css/themes.css`): **hadi** (default, the HADİ Sosyal brand: Figtree +
Bricolage Grotesque), krem, gece, neon, indigo, minimal, kontrast. Switching is one attribute, no inline styles:

```js
import "hadi-march/css/font.css";      // self-hosted Inter, Figtree, Bricolage Grotesque (OFL), font-src 'self'
import "hadi-march/css/tokens.css";     // tokens + every built-in theme
import { setColorTheme, setTheme, ThemePicker } from "hadi-march/ui";

setColorTheme("neon");                 // <html data-hm-theme="neon">, remembered in localStorage
setTheme("dark");                      // light | dark | system
<ThemePicker />                        // theme list with live swatches + appearance switch
<section data-hm-theme="gece">…</section>   // scope a theme to part of the page
```

Write your own: `defineTheme({ id, name, font, display, radius, light: {...}, dark: {...} })` from `hadi-march/theme`,
write `themeCss(def)` to a .css file at build time, load it, and `registerThemes([{ id, name }])` to offer it in pickers.
Icons: `hadi-march/icons` (132 original SVG icons, each a separate export, rendered with createElementNS).
Live gallery of everything: `node examples/showcase/build.mjs --serve`.

## Performance

`npm run bench` creates/updates keyed lists of 1,000 and 10,000 rows and runs table, chart (10k–100k points with LTTB)
and animation scenarios. Only changed bindings update; keyed rows are reused and moved, never re-created.

## Security

The library never parses HTML. Text is always `textContent`; `href`/`src` with unsafe schemes become `about:blank`;
`<script>`, `<iframe>`, `innerHTML` and string `style` throw. Motion uses WAAPI/CSSOM (no style attributes). Access
helpers only decide what to show — your server must enforce permissions.

## License

MIT
