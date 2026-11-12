# Component checklist

Every component lives in `src/components/<name>/` and is done only when all of this holds. `march check component
<name>` checks the source items (✔ / ✖) and lists the browser items (·), which the showcase, `tools/visual-audit.mjs` and
`tools/control-audit.mjs` (every option control changes something visible) cover. `node tools/gen-registry.js` writes
the barrel, the registry and the catalogues; `--check` (and `npm test`) fails when they drift.

## Start

```
march gen component <name>      # in the hadi-march repo: the folder below, then gen-registry
march check component <name>
```

## Folder

| File | What |
|---|---|
| `index.ts` | the component; draws only — state from shared engines (positioning, collection, field, variants …) and behaviors (`src/behaviors`) |
| `<name>.css` | `hm-` classes, theme tokens, logical properties, durations from `--hm-dur*`, no `@keyframes` (motion core) |
| `<name>.test.js` | behaviour, ARIA, keyboard |
| `docs.md` | first paragraph + first code block feed the catalogues; `## Props`, `## Accessibility`, `## Composed of` |
| `demo.tsx` | showcase stage: `default (props: { values })` draws it for the Playground values |
| `playground.ts` | options with an effect only (`visibleWhen` while they have none); choices go through ChoicePicker |
| `meta.ts` | `name`, `status` (stable / experimental / deprecated), `since`, `summary`, `composedOf`, `behaviors`, `hubs`; `entry` for a heavy feature with its own package entry (e.g. `hadi-march/flow`): it stays out of the `hadi-march/ui` barrel and the registry, and its page imports `demo.tsx` + `playground.ts` (type-only meta import) itself |

## Rules

- **Compose, never copy.** A complex component names what it is built from in `meta.composedOf` and uses it (the check
  fails when a named component is not used). Before writing a list, popup, field or chip: use Listbox / position /
  field / Chip.
- **Source checks:** no innerHTML, no string styles (CSP), no eval; accessible names through `t```; CSS prefix,
  tokens, RTL-safe properties, no new keyframes; docs sections; every Playground option is read by the demo; tests pass.
- **Browser checks:** theme + accent in light and dark, RTL mirror, keyboard only, reduced motion, no overflow from
  320 to 1440 px, lazy + placeholder (no layout shift), size budget.
- English identifiers; user text through i18n.
- A folder imports other units only through their `index.ts`; core (`src/core`, `src/dom`) never imports a unit.
