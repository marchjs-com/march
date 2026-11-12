// Showcase stage for IconButton: size and the danger tone follow the Playground values (playground.ts).
import { IconButton } from "./index.ts";
import { heart } from "../../../icons/glyphs/heart.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { bell } from "../../../icons/glyphs/bell.ts";
import { trash } from "../../../icons/glyphs/trash.ts";

export const code = `<IconButton icon={heart} label="Beğen" on:click={like} />
<IconButton icon={trash} label="Sil" variant="danger" size="sm" />   // label is required (aria-label + title)`

export default function IconButtonDemo(props: { values: { size: string; danger: boolean } }) {
  let $liked = false
  return <div class="sc-row">
    {() => {
      const v = props.values, size = v.size as "md"
      return [
        <IconButton icon={heart} label={() => ($liked ? "Beğenmekten vazgeç" : "Beğen")} size={size} aria-pressed={() => String($liked)} on:click={() => { $liked = !$liked }} />,
        <IconButton icon={star} label="Yıldızla" size={size} />,
        <IconButton icon={bell} label="Bildirimler" size={size} />,
        <IconButton icon={trash} label="Sil" size={size} variant={v.danger ? "danger" : undefined} />,
      ]
    }}
    <span class="hm-muted">{() => ($liked ? "Beğenildi" : "")}</span>
  </div>
}
