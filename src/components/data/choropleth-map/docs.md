# ChoroplethMap

Regions coloured by a value: population by province, rainfall, sales by region. The built-in map is Turkey's 81
provinces; rows find their province by plate code (`34`, `"34"`), ISO id (`"TR-34"`) or name (`"İstanbul"`,
`"istanbul"`, `"ISTANBUL"`: case, diacritics and Turkish İ/ı do not matter). Bring your own regions with `shapes`
(`[{ id, name, d, cx?, cy? }]` + `viewBox`, or a GeoJSON FeatureCollection, projected equirectangularly). The value
becomes a colour on a continuous scale (sequential, diverging, your own colours) or in classes (`bins`); the legend
under the map shows the gradient or the classes, and a class click highlights its regions.

```tsx
<ChoroplethMap data={$population} id="plate" value="people" format="compact" title="Nüfus" labels />
<ChoroplethMap data={growth} colorScale="diverging" mid={0} format={["percent", 1]} legend="right" />
<ChoroplethMap data={sales} bins={[100, 500, 1000]} colors={["#e0f2fe", "#38bdf8", "#0369a1", "#082f49"]} focus={["İzmir", "Manisa", "Aydın"]} />
<ChoroplethMap shapes={myGeoJson} data={rows} id="name" onSelect={(p) => open(p.id)} />
```

The Turkey map is its own chunk (`turkey.ts`, about 29 KB before gzip) loaded with `import()` the first time a map
without `shapes` is drawn; until then a light skeleton holds the place. `loadTurkey()` returns that promise (tests,
prefetching).

## Props

| Prop | |
|---|---|
| `data` | Rows: an array, a signal or a function returning one. |
| `id` | The region of a row: a key or getter. Default "id". Matches id, plate code or name. |
| `value` | The value of a row: a key or getter. Default "value". |
| `map` | Built-in map: "turkey" (default, the 81 provinces) or "turkey-regions" (the 7 geographic regions, rows matched by region name: "Ege", "İç Anadolu"…). Ignored when `shapes` is given. |
| `shapes` | Your regions: `[{ id, name, d, cx?, cy? }]` or a GeoJSON FeatureCollection (Polygon / MultiPolygon). |
| `viewBox` | Coordinate box of `shapes`: `[w, h]` or `[x, y, w, h]`. Default: the shapes' bounds. |
| `colorScale` | "sequential" (default), "diverging", or two / three CSS colours or tokens. |
| `bins` | Classes: a count (equal intervals between min and max) or a list of thresholds. |
| `min` / `max` | Colour domain. Default: the data's minimum and maximum. |
| `mid` | Centre of a diverging scale. Default: the middle of the domain. |
| `colors` | A list of colours used as the ramp's stops (with `bins`: one colour per class). |
| `noData` | Fill of regions without a value. Default: a light hatch. |
| `labels` | `true` / "name", "value" or `(point) => text`; a label shows only where it fits (zooming in reveals more). |
| `focus` | Regions to fit the view to; changing it glides there. |
| `zoom` | Zoom and pan (default `true`): Ctrl/⌘ + wheel or a trackpad / two-finger pinch, drag to pan when zoomed, + − ⟲ buttons, keys + − 0. |
| `format` | Value format for tooltip, labels, legend and table: a pipe name, `[pipe, ...args]` or a function. |
| `tooltip` | `true` (default), `false` or `(point) => content`. |
| `onSelect` | Called with the clicked / Enter-pressed region: `{ id, name, value, label, bin, datum, shape }`. |
| `animate` | Motion (default on, a spring): `false`, an easing name, `{ duration, easing, stagger, delay, enter, update, exit }` or `(ctx) => …`. |
| `legend` | `true` / "bottom" (default), "right" (beside the map) or `false`. |
| `title` / `description` | Accessible name (SVG title, table caption) and longer description. |
| `xLabel` / `yLabel` | Table headers (region, value); `yLabel` also names the value in the tooltip. |
| `empty` / `width` / `height` / `class` / `export` | No-data content, size (height follows the map's aspect by default), wrapper class, export buttons. |

`projectGeo(featureCollection, width)`, `pathBox(d)` and `regionKey(value)` are exported for your own drawing.
Class hooks: `m-choropleth-region`, `-none`, `-dim`, `-selected`, `-raised`, `-label`, `-legend`, `-ramp`, `-class`,
`-zoom`; tokens `--m-chart-hi` / `--m-chart-lo` / `--m-chart-neg` / `--m-chart-mid` (scale), `--m-choropleth-border`,
`--m-choropleth-focus`.

## Accessibility

- The SVG has a title and description; a visually hidden table lists every region with its value.
- Tab reaches the map; the arrow keys move to the nearest region in that direction, Enter / Space select, Escape clears;
  the tooltip and the raised outline follow the keyboard region. + / − / 0 zoom when `zoom` is on.
- Legend classes are toggle buttons with `aria-pressed`; zoom buttons have labels.

## Motion

- Enter: the regions fade and colour in as a wave from west to east (with `stagger`, the stagger runs west → east).
- Update: a new value morphs the colour (each region tweens its place on the scale; colours mix in OKLab).
- Exit: shapes that leave fade out before they are removed.
- Focus and the zoom buttons glide the view; wheel, pinch and drag follow the hand. The hovered region rises.
- Reduced motion or `animate={false}`: everything takes its place at once.

## Data

Turkey's provinces come from Natural Earth admin-1 (1:10m), public domain (naturalearthdata.com), simplified and
projected equirectangularly by `tools/gen-turkey-map.mjs`.
