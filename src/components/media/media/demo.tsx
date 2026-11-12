// Showcase stage for Media: kind, size and a broken URL from the Playground values; the button opens it in a dialog.
import { Media, openMedia } from "./index.ts";
import { Button } from "../../../ui/button.ts";
import { appUrl } from "../../../base/index.ts";

export const code = `<Media src="media/dusk.jpg" alt="Gün batımında tepeler" size="md" />
<Media src={url} kind="auto" poster={thumb} />     // video / ses / resim uzantıdan
await openMedia("media/hadi-waves.webm", { title: "Önizleme" })`

const SRC: Record<string, [string, string]> = { image: [appUrl("media/dusk.jpg"), ""], video: [appUrl("media/hadi-waves.webm"), appUrl("media/hadi-waves.jpg")] }

export default function MediaDemo(props: { values: { kind: string; size: string; broken: boolean } }) {
  return <div class="sc-col">
    {() => {
      const v = props.values
      const [src, poster] = SRC[v.kind] ?? SRC.image!
      const url = v.broken ? appUrl("media/missing.jpg") : src
      return <div class="sc-col">
        <Media src={url} kind={v.kind as "image"} alt="Gün batımında tepeler" poster={poster || undefined} muted loop size={v.size === "full" ? undefined : (v.size as "md")} fallback="Medya yüklenemedi" />
        <div class="sc-row"><Button size="sm" on:click={() => void openMedia(url, { title: "Önizleme", kind: v.kind as "image", poster: poster || undefined })}>Pencerede aç</Button></div>
      </div>
    }}
  </div>
}
