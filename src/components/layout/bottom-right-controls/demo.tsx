// Showcase stage for the page corners: add a control to a corner of this page and take it out again.
import { addCornerControl, type Corner } from "./index.ts";
import { signal } from "../../../core/reactive.ts";

export const code = `import { addCornerControl, BottomRightControls } from "hadi-march/layout"

const off = addCornerControl("bottom-end", <button>Geri bildirim</button>, 10)
off()  // take it out (also when the component goes away)`

export default function CornersDemo(props: { values: { corner: Corner } }) {
  const added = signal<(() => void)[]>([])
  const add = (): void => {
    const n = added().length + 1
    const el = <button type="button" class="hm-btn hm-btn-sm hm-btn-primary sc-corner-chip">{`HADİ ${n}`}</button> as Node
    added.set([...added(), addCornerControl(props.values.corner, el, n)])
  }
  const clear = (): void => { added().forEach((off) => off()); added.set([]) }
  return <div class="sc-corner-demo">
    <p class="hm-muted">Seçili köşeye sayfa çapında bir denetim ekle; köşedekiler sırayla dizilir, üst üste binmez.</p>
    <div class="sc-row">
      <button type="button" class="hm-btn hm-btn-primary" onClick={add}>Köşeye ekle</button>
      <button type="button" class="hm-btn" onClick={clear} disabled={() => added().length === 0}>{() => `Hepsini çıkar (${added().length})`}</button>
    </div>
  </div>
}
