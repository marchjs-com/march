# FileUpload

Drop files or click to choose. `accept` and `maxSize` are checked before anything is kept (the reasons are listed);
images and audio get a preview (object URLs are revoked on cleanup). With an `upload(file, { onProgress, signal })`
function each file shows its progress and can be cancelled, and the value becomes what `upload` resolves with.

```tsx
<FileUpload multiple accept="image/*" maxSize={5_000_000} label="Drop images or choose" />
<FileUpload bind:value={$urls} multiple upload={(file, { onProgress, signal }) => api.upload(file, onProgress, signal)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `value` / `bind:value` | File, File[] or upload results | `null` / `[]` | |
| `accept` | string | — | `"image/*,.pdf"` |
| `multiple` | boolean | — | |
| `maxSize` | bytes | — | |
| `maxFiles` | number | — | |
| `upload` | `(file, { onProgress, signal }) => Promise` | — | progress: 0…1 or `{ loaded, total }` |
| `label` | node | "Drop a file here or click to choose" | |
| `onError` | `(message, file) => void` | — | |
| `hint` | `false`, node, text or `() => node` | accept · max size | the small line under the drop text |
| `preview` | boolean | `true` | `false`: no thumbnails / audio players |
| `removeIcon` | node, text or `() => node` | "×" | content of a file's remove button |
| `labels` | `{ max?(size), uploaded?, cancel?, uploading?(name), cancelUpload?(name), remove?(name), typeNotAllowed?(name), tooLarge?(name, max), tooMany?(max) }` | built-in texts | every other text, including the rejection messages |
| `class`, `color`, `id`, `name`, `disabled`, `readonly`, `required`, `invalid`, `aria-label` | | — | the props every control takes; `color` is a theme token |

`<FileUpload multiple label="Dosyaları bırak" hint="PNG ya da JPG, en çok 5 MB" preview={false}
removeIcon={() => <Icon of={trash} />} labels={{ uploaded: "Tamam", cancel: "Vazgeç", tooLarge: (n, max) => `${n} çok büyük (${max})` }} />`.

## Accessibility

The drop zone is a `role="button"` (Enter / Space open the file chooser); rejected files are listed in a
`role="alert"`; every progress bar is labelled "Uploading report.pdf", and each row's button says "Cancel upload of …"
or "Remove …".

## Composed of

Progress (upload bars), OverflowText (long file names) and the dropzone behavior (drag over, drop, accept check).
