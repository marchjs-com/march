// Showcase stage for FileUpload: one or several files, what is accepted, and a simulated upload with progress.
import { FileUpload, type UploadFn } from "./index.ts";

export const code = `<FileUpload multiple accept="image/*" maxSize={5_000_000} label="Görselleri bırak ya da seç" />
<FileUpload bind:value={$urls} multiple upload={(file, { onProgress, signal }) => api.upload(file, onProgress, signal)} />`

// a pretend upload: progress in steps, cancellable through the signal
const fake: UploadFn<string> = (file, { onProgress, signal }) => new Promise((resolve, reject) => {
  let p = 0
  const id = setInterval(() => { p += 0.1; onProgress(Math.min(p, 1)); if (p >= 1) { clearInterval(id); resolve(`https://cdn.acme.com/${file.name}`) } }, 250)
  signal.addEventListener("abort", () => { clearInterval(id); reject(new Error("aborted")) })
})

export default function FileUploadDemo(props: { values: { multiple: boolean; accept: string; upload: boolean } }) {
  return <div>{() => {
    const v = props.values
    return <FileUpload multiple={v.multiple} accept={v.accept || undefined} maxSize={5_000_000} upload={v.upload ? fake : undefined}
      label={v.multiple ? "Dosyaları bırak ya da seç" : "Bir dosya bırak ya da seç"} />
  }}</div>
}
