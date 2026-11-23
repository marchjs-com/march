# Component checklist

Every component lives in `src/components/<category>/<name>/` and is done only when all of this holds. `march check component
<name>` checks the source items (✔ / ✖) and lists the browser items (·), which the site's component pages and its browser
checks cover (marchjs.com: every option control changes something visible — at once, or on the next interaction the demo
marks with `data-audit-try` (a popup trigger and a resize handle are tried by themselves) — and stays the same DOM node
while it is used). The card's demo and Options panel are the site's files (marchjs.com: `src/catalog/<category>/<name>/demo.tsx`,
`playground.ts`); its build fails when a component has no card, or an option its demo never reads. `node tools/gen-registry.js` writes
the barrels, the package exports and the catalogues; `--check` (and `npm test`) fails when they drift.

## Start

```
march gen component <Name> --category <id> [--parts A,B]   # in the march repo: the folder below, then gen-registry
march check component <category>/<name>
```

Then its card on the site: `src/catalog/<category>/<name>/demo.tsx` (draws it for the option values; a thunk that
rebuilds the component reads the values itself) and `playground.ts` (options with an effect only), in marchjs.com.

## Folder

| File | What |
|---|---|
| `index.ts` | the component; draws only — state from shared engines (positioning, collection, field, variants …) and behaviors (`src/behaviors`) |
| `<name>.css` | `m-` classes, theme tokens, logical properties, durations from `--m-dur*`, no `@keyframes` (motion core) |
| `<name>.test.js` | behaviour, ARIA, keyboard |
| `docs.md` | first paragraph + first code block feed the catalogues; `## Props`, `## Accessibility`, `## Composed of` |
| `meta.ts` | `name`, `status` (stable / experimental / deprecated), `since`, `summary`, `category`, `composedOf`, `behaviors`, `hubs`; `entry` for a heavy feature with its own package entry (e.g. `march/flow`): it stays out of the `march/ui` barrel; `barrel: false` for a large component kept out of the barrels (its own export `march/components/<category>/<name>`); `root` when the root element's class is not the first class its stylesheet styles |

## Category

`src/components/categories.ts` is the one list: layout, typography, actions, forms, data, feedback, overlays,
navigation, media, motion, social, composite, landing. `meta.category` names it and must match the folder; the
category is the subpath (`import { Chip } from "march/actions"`) and the section in docs/components.md and the AI
catalogue. A component built from other components (NavSidebar, Wizard, ThemeMenu,
CommandPalette, ConsentBanner …) is **composite**: `meta.composedOf` must name its parts, each a registered component
(the site's card links to them). Missing parts are written as their own components
first.

## Rules

- **Compose, never copy.** A complex component names what it is built from in `meta.composedOf` and uses it (the check
  fails when a named component is not used). Before writing a list, popup, field or chip: use Listbox / position /
  field / Chip.
- **Source checks:** no innerHTML, no string styles (CSP), no eval; accessible names through `t```; CSS prefix,
  tokens, RTL-safe properties, no new keyframes; docs sections; tests pass.
- **Browser checks:** theme + accent in light and dark, RTL mirror, keyboard only, reduced motion, no overflow from
  320 to 1440 px, lazy + placeholder (no layout shift), size budget.
- English identifiers; user text through i18n.
- A folder imports other units only through their `index.ts`; core (`src/core`, `src/dom`) never imports a unit.
