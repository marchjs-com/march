# ColorPicker

An advanced color picker: a saturation / brightness area, hue and alpha sliders, an eyedropper (where the browser has
one), an old / new preview (click the old half to go back), the value as hex, rgb() or hsl() text (any CSS color can be
typed or pasted), WCAG contrast on white and black, and palettes: the four HADİ colors, the theme's palette and the
recent picks. Theme colors are read from the tokens at the moment they are picked, so they follow the active theme.

```tsx
<ColorPicker bind:value={$color} />
<ColorPicker value={brand} format="hsl" alpha={false} palettes={[{ label: "HADİ", colors: ["#0b5", "brand-blue"] }]} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | CSS color | `#f2801f` | written in `format` |
| `format` | `hex` `rgb` `hsl` | `hex` | the switcher changes it |
| `alpha` | boolean | `true` | alpha slider; `#rrggbbaa` / `/ a` in the value |
| `palettes` | `ColorPalette[]` or `false` | HADİ + theme | `{ label, colors }`; colors are CSS colors or tokens (`brand-orange`, `cat-3` …) |
| `recent` | number | `8` | recent picks kept (0 hides them) |
| `eyedropper` | boolean | `true` | shown only where `EyeDropper` exists |
| `contrast` | boolean | `true` | contrast ratio and grade on white and black |
| `preview` | boolean | `true` | the old / new preview |
| `formats` | boolean | `true` | the HEX / RGB / HSL switcher |
| `input` | boolean | `true` | the text field with the value |
| `eyedropperIcon` | icon, text or node | pipette | own eyedropper icon |
| `labels` | `ColorPickerLabels` | built-in texts | `{ picker, area, hue, opacity, eyedropper, value, format, contrast, onWhite, onBlack, hadiColors, theme, recent }` |
| `readonly`, `disabled`, `class` | | | |

```tsx
<ColorPicker bind:value={$c} preview={false} formats={false} contrast={false} labels={{ hue: "Tone", theme: "Our palette" }} />
```

The color math is exported: `parse`, `format`, `hsvToRgb`, `rgbToHsv`, `contrastOf`, `mix`, `resolveColor`.

## Accessibility

The area is a `role="slider"` with its value in words ("Saturation 87%, brightness 95%"): arrows move by 1, Shift by
10, Home / End jump (mirrored in RTL). Hue and opacity are range Sliders ("199 degrees", "80%") with the keys of a
native range input. Swatches are buttons named after their color with `aria-pressed`.
The text field has `aria-invalid` while it does not parse. The preview names the new and the old color.

## Composed of

IconButton (eyedropper), Segmented (format), Slider (hue and opacity, each over its own track), TextInput (the value),
Swatch (palette colors, the contrast marks, the shared checkerboard), Badge (contrast), SectionLabel (palette names);
the drag behavior (`march/behaviors/drag`) for the area, the motion engine's color parser, the theme's contrast
helper.
