# HADI March roadmap (beyond the current core order)

Sizes: S ≈ a day, M ≈ a few days, L ≈ a week or more of focused work. Priorities are decided by the founder; the current
core order (docs/parallel.md) does not change because of this list. Visual regression and DevTools shorten the bug loop
and may be worth pulling forward.

The motion core is NOT on this list: it is core order step 10 (docs/parallel.md) — one engine for every animation
(value layer + drivers, one clock, compositor-only, off-screen stops, 200-item stagger frame-drop check).

| # | Area | Size | Needs | Notes |
|---|---|---|---|---|
| 1 | DevTools panel: signals, component tree, requests (net), events (channels), manager state; in-app panel + optional browser extension | L | messaging, net, managers | app panel first, extension later |
| 2 | Visual regression: every showcase page × 5 widths × light/dark, pixel diff against a baseline, threshold, HTML report | M | tools/visual-audit.mjs | can start now; baseline per commit |
| 3 | Automatic accessibility audit: contrast, ARIA, keyboard, focus per component; AA required in tests | M | modular structure (per-component check) | extends march check component |
| 4 | Form engine: dynamic forms from JSON/TS schema, conditional fields, repeating groups, multi-step, server validation, drafts | L | managers (DirtyState), net | builds on forms + schema |
| 5 | State machines: `machine()`, typed events, guards, visualisation (showcase, DevTools) | M | — | small core, optional module |
| 6 | Server render + edge: render at request time (Cloudflare Workers), hydration; continues SEO prerender | L | router stable, net | |
| 7 | PWA + mobile package: installable, manifest, push, offline; later a Capacitor shell | M | net, Offline manager, sw | |
| 8 | Design-token export: Figma (Tokens Studio JSON), Flutter (HADİ mobile ThemeData / hadi_colors.dart) | S | — | from theme tokens |
| 9 | Version / migration tools: `march upgrade` codemods, API changelog, warnings | M | 0.1.0 release | |
| 10 | App templates: `march create --template admin|landing|social|shop` | M | most of the above | last |

## Infrastructure (founder, 12 Nov 2026; details and dependencies in docs/parallel.md › Infrastructure)

| # | Area | Size | Needs |
|---|---|---|---|
| w | Version and stability contract (stable / experimental / deprecated in meta.ts, deprecation warnings, generated CHANGELOG, semver) | M | modular structure |
| x | Size and performance guard in CI (size, Slow 3G first load, frame rate; regression fails; `npm run perf`) | M | — |
| y | Debug ids (component / signal names, file:line in errors and DevTools; dev only) | M | compiler |
| z | Accessibility tree snapshots per showcase page | S | visual-audit |
| aa | Package contract test (`npm pack` → temporary project, end to end) | S | — |
| bb | One source: docs.md + demo.tsx → docs, showcase, AI catalogue (`--check`) | M | modular structure |
