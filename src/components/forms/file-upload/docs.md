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

## Accessibility

The drop zone is a `role="button"` (Enter / Space open the file chooser); rejected files are listed in a
`role="alert"`; every progress bar is labelled "Uploading report.pdf", and each row's button says "Cancel upload of …"
or "Remove …".

## Composed of

Progress (upload bars), OverflowText (long file names) and the dropzone behavior (drag over, drop, accept check).
