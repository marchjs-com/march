# Changelog

All notable changes to HADI March. Versions follow [semver](https://semver.org/).

## 0.1.0 — unreleased

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
