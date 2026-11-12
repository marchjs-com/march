# Icons

March draws icons as SVG built with `createElementNS` (no `innerHTML`, Trusted Types safe). An icon is plain data
— a name and its shapes — and every icon is its own export, so a bundle holds only the icons it imports.

## The March set

```tsx
import { Icon, users, search } from "hadi-march/icons";

<Icon of={users} />                       // decorative: inherits the text color, 16 px
<Icon of={search} size="lg" label="Search" />  // "xs" 12 · "sm" 14 · "md" 16 · "lg" 20 · "xl" 24 · "em" (font size)
<Button icon={search}>Search</Button>     // every `icon` prop takes an icon
```

Props may be live: `<Icon of={$icon} size={$size} />` repaints the same `<svg>` in place. For galleries and pickers,
`hadi-march/icons/catalog` exports every built-in icon as data (`ICONS`) in one module.

## Open-source icon packs

Nine open-source sets ship as optional subpaths. Import single icons; each one is a separate `/* @__PURE__ */` export,
so only what you use is bundled (one Tabler icon is a few hundred bytes).

| Subpath | Set | License | Drawn as |
| --- | --- | --- | --- |
| `hadi-march/icons/lucide` | Lucide | ISC | stroke 2 px, 24 grid |
| `hadi-march/icons/tabler` | Tabler Icons (outline) | MIT | stroke 2 px, 24 grid |
| `hadi-march/icons/heroicons` | Heroicons (24 outline) | MIT | stroke 1.5 px, 24 grid |
| `hadi-march/icons/phosphor` | Phosphor (regular) | MIT | fill, 256 grid |
| `hadi-march/icons/feather` | Feather | MIT | stroke 2 px, 24 grid |
| `hadi-march/icons/material-symbols` | Material Symbols (outlined, 400) | Apache-2.0 | fill, 960 grid |
| `hadi-march/icons/remix` | Remix Icon (line and fill) | Apache-2.0 | fill, 24 grid |
| `hadi-march/icons/bootstrap` | Bootstrap Icons | MIT | fill, 16 grid |
| `hadi-march/icons/simple-icons` | Simple Icons (brands) | CC0-1.0 | fill, 24 grid |

```tsx
import { Icon } from "hadi-march/icons";
import { rocket } from "hadi-march/icons/lucide";
import { chartBar } from "hadi-march/icons/tabler";

<Icon of={rocket} size="lg" />
<Button icon={chartBar}>Report</Button>
```

Export names are the set's file names in camelCase (`arrow-left` → `arrowLeft`); a name that starts with a digit gets
an `i` (`1st` → `i1st`), a reserved word gets `Icon` (`delete` → `deleteIcon`). Each pack folder holds the set's
`LICENSE` text as shipped by its authors. Brand icons (Simple Icons) are trademarks of their owners.

A shared drawing layer handles the differences (`packPaint`, the `paint` hook every pack icon carries; it loads with
the first pack icon and adds nothing to start-up code): the set's grid (`vb`: Phosphor 256, Material Symbols 960,
Bootstrap 16…), its stroke width (`sw`, set on each shape, so it wins over the theme's `--hm-icon-stroke`) or `fill`,
shapes filled even-odd (`eo`), and `currentColor` for both. Icons that point along the reading direction (left / right
arrows, chevrons, back / forward, undo / redo, reply, send, log in / out, indent) carry `rtl` and mirror in
right-to-left text (`.hm-svg-rtl:dir(rtl)`); up / down, left-right pairs and text alignment stay as drawn. The HADI
March set does not mirror by itself: components that use its arrows flip them where needed.

### Icons by name

```tsx
import { registerIconPack, icon, loadIcon, Icon } from "hadi-march/icons/packs";
import lucide from "hadi-march/icons/lucide/pack";

registerIconPack(lucide);

<Icon name="lucide:rocket" size="xl" />           // "pack:name"; the pack's icons load on first use
<Icon name="user" />                              // no prefix: the March set
<Button icon={icon("tabler:chart-bar")}>Report</Button>  // icon(): any icon prop
await loadIcon("lucide:rocket");                  // IconDef | undefined once the pack has loaded
```

`Icon` from `hadi-march/icons/packs` is the `<Icon>` of `hadi-march/icons` plus `name`. `icon(name)` is reactive: read
in a component it updates when the pack arrives (or when the pack is registered later); until then, and for an unknown
name, it is an icon without shapes, so it is safe in any icon prop. A component that draws its icon once (a button)
shows it as soon as the pack is already loaded: `await loadIcon(…)` first, or import the icon directly.

A pack loaded by name is one lazy chunk with the whole set; prefer single imports where bundle size matters. Your own
set is any object with `{ id, name, license, resolve(name) }` (`resolve` may return a promise); `packIcon(name, shapes,
{ vb, sw, fill, rtl, eo })` makes icons drawn by the shared layer:

```ts
import { registerIconPack, packIcon } from "hadi-march/icons/packs";

const acme = { star: packIcon("star", ["M12 2 15 9h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"], { fill: true }) };
registerIconPack({ id: "acme", name: "Acme", license: "MIT", resolve: (n) => acme[n] });
```

`iconPacks()` lists the registered packs, `iconPack(id)` returns one, `parseIconRef("lucide:user")` splits a name.

## Adding or updating a pack: `march icons`

Packs are converted once from the set's official npm package; they are not runtime dependencies.

```bash
march icons list                       # known packs, their package and mode
march icons add lucide tabler          # or: all
march icons add remix --version 4.9.1  # a given release
march icons gallery public/icon-packs  # JSON for an icon browser (index.json, names.json, <pack>.json)
```

`add` downloads the tarball from `registry.npmjs.org`, checks it against the registry's sha512, unpacks it as data
into its own folder (nothing in it is run) and converts every SVG: `path`, `circle`, `rect`, `line`, `polyline`,
`polygon` and `ellipse` become March shapes, even-odd paths keep their fill rule, sizing boxes are dropped, and an icon
that needs a transform, mask or gradient is skipped and reported. A set whose license is not MIT, ISC, Apache-2.0,
CC0-1.0, CC-BY-4.0 or OFL-1.1 is refused. Output, per pack, in `src/icons/packs/<id>/` (`--out` to change):

- `index.js` / `index.d.ts`: one export per icon
- `pack.js`: the pack for `registerIconPack`
- `LICENSE`, `pack.json` (name, version, license, count)

In the March repository, `node tools/icon-packs.js …` does the same.
