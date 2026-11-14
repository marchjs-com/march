// Showcase stage for ColorPicker: the picker and a card painted with its value, for the Playground values (playground.ts).
import { setStyle } from "../../../core/util.ts";
import { effect, untrack } from "../../../core/reactive.ts";
import { ColorPicker, type ColorFormat } from "./index.ts";

export default function ColorPickerDemo(props: { values: { format: string; alpha: boolean; palettes: boolean; contrast: boolean; eyedropper: boolean; readonly: boolean; preview: boolean; formats: boolean; input: boolean } }) {
  let $c = "#1d9ad6"
  const card = (<div class="sc-cp-card"><b>HADİ</b><span>{$c}</span></div>) as HTMLElement
  effect(() => setStyle(card, { "--sc-cp": $c }))
  return <div class="sc-cp-demo">
    {() => <ColorPicker value={untrack(() => $c)} onChange={(v: string) => { $c = v }} format={props.values.format as ColorFormat} alpha={props.values.alpha} palettes={props.values.palettes ? undefined : false}
      contrast={props.values.contrast} eyedropper={props.values.eyedropper} readonly={props.values.readonly}
      preview={props.values.preview} formats={props.values.formats} input={props.values.input} />}
    {card}
  </div>
}
