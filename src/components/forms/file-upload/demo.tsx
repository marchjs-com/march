// Showcase stage for FileUpload: one or several files, what is accepted, and a simulated upload with progress.
import { FileUpload, type UploadFn } from "./index.ts";
import { Icon } from "../../../icons/index.ts";
import { trash } from "../../../icons/glyphs/trash.ts";

export const code = `<FileUpload multiple accept="image/*" maxSize={5_000_000} label="Görselleri bırak ya da seç" />
<FileUpload bind:value={$urls} multiple upload={(file, { onProgress, signal }) => api.upload(file, onProgress, signal)} />
<FileUpload multiple hint="PNG ya da JPG, en çok 5 MB" preview={false} removeIcon={() => <Icon of={trash} />}
  labels={{ uploaded: "Yüklendi", cancel: "Vazgeç", tooLarge: (name, max) => \`\${name} çok büyük (en çok \${max})\` }} />`

// a pretend upload: progress in steps, cancellable through the signal
const fake: UploadFn<string> = (file, { onProgress, signal }) => new Promise((resolve, reject) => {
  let p = 0
  const id = setInterval(() => { p += 0.1; onProgress(Math.min(p, 1)); if (p >= 1) { clearInterval(id); resolve(`https://cdn.hadisosyal.com/${file.name}`) } }, 250)
  signal.addEventListener("abort", () => { clearInterval(id); reject(new Error("aborted")) })
})

export default function FileUploadDemo(props: { values: { multiple: boolean; accept: string; upload: boolean; hint: string; preview: boolean; remove: string } }) {
  return <div>{() => {
    const v = props.values
    return <FileUpload multiple={v.multiple} accept={v.accept || undefined} maxSize={5_000_000} upload={v.upload ? fake : undefined}
      label={v.multiple ? "Dosyaları bırak ya da seç" : "Bir dosya bırak ya da seç"}
      hint={v.hint === "off" ? false : v.hint === "own" ? "En çok 5 MB; görseller önerilir" : undefined} preview={v.preview}
      removeIcon={v.remove === "icon" ? () => <Icon of={trash} /> : undefined}
      labels={{ uploaded: "Yüklendi", cancel: "Vazgeç", max: (s: string) => `en çok ${s}`, remove: (n: string) => `${n} dosyasını kaldır` }} />
  }}</div>
}
