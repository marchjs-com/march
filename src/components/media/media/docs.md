# Media

One element for images, video and audio: it fits its container, guesses the kind from the extension (`kind="auto"`), shows controls for video and audio, and swaps in a text fallback when the file fails to load. `openMedia(url)` shows it in a dialog.

```tsx
<Media src={url} kind="auto" alt="Hills at dusk" poster={thumb} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `src` | `string` / accessor | | nothing: "No media" |
| `kind` | `image` `video` `audio` `auto` | `image` | `auto`: from the extension (`mediaKind(src)`) |
| `alt` | `string` / accessor | `""` | images |
| `poster` | `string` | | video |
| `controls` | `boolean` | `true` | video and audio |
| `autoplay`, `loop`, `muted` | `boolean` | `false` | |
| `size` | `sm` `md` | | `sm`: a square thumbnail |
| `fallback` | text / node / accessor | "Could not load media", "No media" (translated) | shown when loading fails or there is no `src` |
| `class` | class value | | |

`openMedia(src, { title, kind, alt, poster, size, autoplay, fallback })` returns the dialog's promise (`title` defaults to "Preview", translated).

```tsx
<Media src={url} fallback={<Empty icon={image} title="The photo is gone" />} />
```

## Accessibility

Images take `alt` (empty: decorative); video and audio keep native controls (keyboard and screen reader friendly).
A failed load is announced as a status message. Images load lazily and decode off the main thread.

## Composed of

Dialog (openMedia).
