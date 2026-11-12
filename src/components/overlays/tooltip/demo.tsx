// Showcase stage for Tooltip: hover or focus the control; the Playground picks what it describes (playground.ts).
import { Tooltip } from "./index.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";
import { bell } from "../../../icons/glyphs/bell.ts";

export const code = `<Tooltip text="Bağlantıyı kopyala" placement="top">
  <Button variant="ghost" icon={link}>Paylaş</Button>
</Tooltip>                                  // hover (after a short delay) or keyboard focus; Esc hides`

export default function TooltipDemo(props: { values: { target: string } }) {
  return <div class="sc-row">
    {() => (props.values.target === "icon"
      ? <Tooltip text="3 yeni bildirim" placement="bottom"><IconButton icon={bell} label="Bildirimler" /></Tooltip>
      : <Tooltip text="Bu bir ipucu: odakla ya da üstüne gel" placement="top"><Button variant="ghost" icon={sparkles}>Üstüme gel</Button></Tooltip>)}
  </div>
}
