// Showcase stage for Splitter: a list and a preview side by side (Playground values in playground.ts).
import { Splitter } from "./index.ts";

export const code = `<Splitter start={<FileList />} end={<Preview />} initial={0.35} min={0.2} />`

export default function SplitterDemo(props: { values: { initial: number; min: number } }) {
  return <div class="sc-split-frame">
    {() => { const initial = props.values.initial / 100, min = props.values.min / 100; return <Splitter initial={initial} min={min} label="Liste genişliği"
      start={<ul class="sc-split-list"><li>rapor.pdf</li><li>sunum.key</li><li>bütçe.xlsx</li><li>logo.svg</li></ul>}
      end={<div class="sc-split-preview"><strong>rapor.pdf</strong><p class="hm-muted">Tutamacı sürükleyin ya da odaklayıp ← → kullanın; Enter başa döndürür.</p></div>} /> }}
  </div>
}
