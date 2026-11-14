// Showcase stage for the page corners: add a control to a corner of this page and take it out again.
import { addCornerControl, type Corner } from "./index.ts";
import { signal, effect, onCleanup } from "../../../core/reactive.ts";

export const code = `import { addCornerControl, BottomRightControls } from "hadi-march/layout"

const off = addCornerControl("bottom-end", <button>Geri bildirim</button>, 10)
off()  // take it out (also when the component goes away)`

const CORNER_NAMES: Record<Corner, string> = { "top-start": "üst baş", "top-end": "üst son", "bottom-start": "alt baş", "bottom-end": "alt son" }

export default function CornersDemo(props: { values: { corner: Corner } }) {
  const added = signal<Node[]>([])
  let offs: (() => void)[] = []
  const add = (): void => {
    const n = added().length + 1
    const el = <button type="button" class="hm-btn hm-btn-sm hm-btn-primary sc-corner-chip">{`HADİ ${n}`}</button> as Node
    added.set([...added(), el])
  }
  const clear = (): void => { added.set([]) }
  // the added controls sit in the chosen corner: picking another corner moves them there
  effect(() => {
    const corner = props.values.corner
    offs.forEach((off) => off())
    offs = added().map((el, i) => addCornerControl(corner, el, i + 1))
  })
  onCleanup(() => offs.forEach((off) => off()))
  return <div class="sc-corner-demo">
    <p class="hm-muted">Seçili köşeye sayfa çapında bir denetim ekle; köşedekiler sırayla dizilir, üst üste binmez.</p>
    <p>Hedef köşe: <strong>{() => CORNER_NAMES[props.values.corner]}</strong>{() => (added().length ? ` (${added().length} denetim orada)` : "")}</p>
    <div class="sc-row">
      <button type="button" class="hm-btn hm-btn-primary" data-audit-try onClick={add}>Köşeye ekle</button>
      <button type="button" class="hm-btn" onClick={clear} disabled={() => added().length === 0}>{() => `Hepsini çıkar (${added().length})`}</button>
    </div>
  </div>
}
