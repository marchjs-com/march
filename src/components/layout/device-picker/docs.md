# DevicePicker

Choose a device to preview on: the whole DevicePreview catalog — phones, tablets and desktop screens, in sections by
kind, each a roomy grid that takes the height it needs (the list never scrolls by itself) — each device with a
silhouette in its proportions, its CSS size, pixel ratio and whether it is a touch screen. Search by name or size
("390", "ipad"), filter by group, switch portrait / landscape, and make your own devices (name, width × height, pixel
ratio, kind, touch), saved in this browser; a device of yours has a remove button.

```tsx
import { DevicePicker, DevicePreview } from "march/layout";

const $device = signal("iphone-15"), $land = signal(false)
<DevicePicker value={$device} landscape={$land} fit />
<DevicePreview device={$device} landscape={$land} controls>…</DevicePreview>
```

It is a panel: put it in a `Popover` for a toolbar (MarchIDE's preview does).

## Props

| Prop | |
|---|---|
| `value` | The device id (a signal, `bind:value` or `value` + `onChange`); `""` is "fit the panel". |
| `landscape` | A signal: the portrait / landscape switch shows when it is given. |
| `fit` | Offer "Fit the panel" (a pressed button in the top row; `true`, or your own text). |
| `devices` | The devices (default: the catalog and your own). |
| `group` | The group shown first: `"all"` (default), `"phone"`, `"tablet"`, `"desktop"`, `"mine"` (or a signal). |
| `search` | The search field (default true). |
| `create` | The "your own device" button in the top row and its form (default true). |
| `label` | Accessible name of the list (default "Devices", translated). |
| `class` | Class on the root (`.m-dpick`). |

`deviceSilhouette(spec, landscape)` draws the small device shape on its own.

## Accessibility

Each device is a button in a named list (selected state on the chosen one); the groups and the orientation are
Segmented controls (arrow keys); the form's fields have labels.

## Composed of

SearchBox, Segmented, ListRow, SectionLabel, Empty, Field, TextInput, NumberInput, Toggle, Button, IconButton.
