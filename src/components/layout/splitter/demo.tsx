// Showcase stage for Splitter: a list and a preview side by side (Playground values in playground.ts).
import { Splitter } from "./index.ts";
import { moreVertical } from "../../../icons/glyphs/moreVertical.ts";
import { Icon } from "../../../icons/index.ts";

export const code = `<Splitter start={<FileList />} end={<Preview />} initial={0.35} min={0.2} />
<Splitter start={…} end={…} handle={<Icon of={moreVertical} />} color="brand-orange" />   // handle={false}: sabit`

export default function SplitterDemo(props: { values: { initial: number; min: number; handle: string; color: string } }) {
  return <div class="sc-split-frame">
    {() => { const initial = props.values.initial / 100, min = props.values.min / 100, color = props.values.color as "primary"
      const handle = props.values.handle === "off" ? false : props.values.handle === "grip" ? <Icon of={moreVertical} /> : true
      return <Splitter initial={initial} min={min} handle={handle} color={color} label="Liste genişliği"
      start={<ul class="sc-split-list"><li>rapor.pdf</li><li>sunum.key</li><li>bütçe.xlsx</li><li>logo.svg</li></ul>}
      end={<div class="sc-split-preview"><strong>rapor.pdf</strong><p class="hm-muted">Tutamacı sürükleyin ya da odaklayıp ← → kullanın; Enter başa döndürür.</p></div>} /> }}
  </div>
}
