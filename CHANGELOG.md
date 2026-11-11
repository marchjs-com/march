# Changelog

All notable changes to HADI March. Versions follow [semver](https://semver.org/).

## 0.1.0 — unreleased

### Added
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
