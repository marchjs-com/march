// Showcase stage for BeforeAfter: the same HADİ screen, before (grey, flat) and after (the new design).
import { BeforeAfter } from "./index.ts";
import { MockApp } from "../demo-kit.tsx";

export const code = `<BeforeAfter before={<img src="eski.png" alt="" />} after={<img src="yeni.png" alt="" />}
  beforeLabel="Önce" afterLabel="Sonra" />
<BeforeAfter orientation="vertical" follow before={…} after={…} />   // the divider follows the pointer`

export default function BeforeAfterDemo(props: { values: { orientation: string; follow: boolean; labels: boolean; value: number } }) {
  return <div class="sc-ba-stage">
    {() => {
      const v = { ...props.values }
      return <BeforeAfter class="sc-ba" orientation={v.orientation as "horizontal" | "vertical"} follow={v.follow}
        value={() => props.values.value} beforeLabel={v.labels ? "Önce" : undefined} afterLabel={v.labels ? "Sonra" : undefined}
        before={<MockApp class="sc-ba-old" />} after={<MockApp />} />
    }}
  </div>
}
