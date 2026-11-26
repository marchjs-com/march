# PixelFont

Text in a pixel font on a small LED screen, as wide as the text. The fonts are March's own drawings: "5x7" with every
Turkish letter (Ç Ğ İ Ö Ş Ü ç ğ ı ö ş ü, Â â, ₺ €) and "8x8", the same letters one column bolder. Letters are as wide
as they are drawn (an "i" is narrow); digits are all five wide so a clock never jumps; `:heart:` puts a pixel emoji in
the line. A still LED label, badge or heading; LedBoard is the one that moves.

```tsx
<PixelFont text="HADİ :heart:" color="amber" />
<PixelFont text="Kapı 3" font="8x8" shape="square" ink="#3ddc84" />
<PixelFont text="7" cols={12} align="end" label="Seven waiting" />
```

## Props

| Prop | |
|---|---|
| `text` | The text; `:name:` shows a built-in emoji (see PixelSprite). |
| `font` | "5x7" (default) or "8x8". |
| `spacing` | LEDs between letters. Default 1. |
| `ink` | Color of the letters ("#ff8a00"); default the screen's color. |
| `cols` / `align` / `margin` | A fixed screen width, where the text sits in it ("start", "center", "end") and the margin (default 1). |
| `shape`, `gap`, `roundness`, `bloom`, `ghost`, `scanlines`, `color`, `panel`, `pitch` | The LED look (see LedMatrix). |
| `label` | Accessible name; default the text (emoji read by their names). |
| `class` | Extra class on the root. |

## Layout for any LED part

`layoutText(text, { font, spacing, space, rgb, time })` gives `{ frame, parts }` (8 rows high);
`wrapText(text, cols)` breaks text into lines that fit (a word wider than a line is cut); `textWidth`, `textParts`,
`hasGlyph`. A character the font does not have falls back to its base letter (é → e), then to "?".

## Accessibility

An image named by the text itself (`:heart:` is read as "heart"), so a screen reader hears what the LEDs say.
