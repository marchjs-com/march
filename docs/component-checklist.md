# Component checklist

Every component lives in `src/components/<category>/<name>/` and is done only when all of this holds. `march check component
<name>` checks the source items (✔ / ✖) and lists the browser items (·), which the showcase, `tools/visual-audit.mjs` and
`tools/control-audit.mjs` (every option control changes something visible — at once, or on the next interaction the demo marks with `data-audit-try` (a popup trigger and a resize handle are tried by themselves) — and stays the same DOM node while it is used; `npm run audit:controls`, run by CI on the built
showcase) cover. `test/playground-keys.test.js` (in `npm test`) fails when demo.tsx never reads a Playground key. `node tools/gen-registry.js` writes
the barrel, the registry and the catalogues; `--check` (and `npm test`) fails when they drift.

## Start

```
march gen component <Name> --category <id> [--parts A,B]   # in the hadi-march repo: the folder below, then gen-registry
march check component <category>/<name>
```

## Folder

| File | What |
|---|---|
| `index.ts` | the component; draws only — state from shared engines (positioning, collection, field, variants …) and behaviors (`src/behaviors`) |
| `<name>.css` | `m-` classes, theme tokens, logical properties, durations from `--m-dur*`, no `@keyframes` (motion core) |
| `<name>.test.js` | behaviour, ARIA, keyboard |
| `docs.md` | first paragraph + first code block feed the catalogues; `## Props`, `## Accessibility`, `## Composed of` |
| `demo.tsx` | showcase stage: `default (props: { values })` draws it for the Playground values. A thunk that rebuilds the component reads the values itself (`{() => { const v = { ...props.values }; return <X tone={v.tone} /> }}`): a value only passed on as a prop becomes a live getter the component reads once, untracked, and the option changes nothing. An option that acts on the next interaction shows its effect at once (a `sc-demo-call` line, or the state it shapes opened) |
| `playground.ts` | options with an effect only (`visibleWhen` while they have none); choices go through ChoicePicker |
| `meta.ts` | `name`, `status` (stable / experimental / deprecated), `since`, `summary`, `category`, `composedOf`, `behaviors`, `hubs`; `entry` for a heavy feature with its own package entry (e.g. `hadi-march/flow`): it stays out of the `hadi-march/ui` barrel and the registry, and its page imports `demo.tsx` + `playground.ts` (type-only meta import) itself |

## Category

`src/components/categories.ts` is the one list: layout, typography, actions, forms, data, feedback, overlays,
navigation, media, motion, social, composite, landing. `meta.category` names it and must match the folder; the
category is the subpath (`import { Chip } from "hadi-march/actions"`), the showcase menu group, and the section in
docs/components.md and the AI catalogue. A component built from other components (NavSidebar, Wizard, ThemeMenu,
CommandPalette, ConsentBanner …) is **composite**: `meta.composedOf` must name its parts, each a registered component,
and the showcase card shows "Şunlardan oluşur" with links to them. Missing parts are written as their own components
first.

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
