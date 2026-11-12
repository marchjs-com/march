// Showcase stage for EasingCurveEditor: the curve is registered as "hadi-pop" in the motion engine; the button runs a
// real engine animation with that name, for the Playground values (playground.ts).
import { untrack } from "../../../core/reactive.ts";
import { animate } from "../../../motion/engine/playback.ts";
import { EasingCurveEditor } from "./index.ts";

export default function EasingCurveEditorDemo(props: { values: { preview: string; duration: number; presets: boolean; readonly: boolean } }) {
  let $e = "cubic-bezier(.34, 1.56, .64, 1)"
  const card = (<div class="sc-ec-card">HADİ</div>) as HTMLElement
  const run = () => animate(card, [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-1.5rem) scale(1.08)" }, { transform: "translateY(0) scale(1)" }], { duration: props.values.duration, easing: "hadi-pop" })
  return <div class="sc-ec-demo">
    {() => <EasingCurveEditor value={untrack(() => $e)} onChange={(v: string) => { $e = v }} name="hadi-pop" preview={props.values.preview as "move"} duration={props.values.duration}
      presets={props.values.presets ? undefined : false} readonly={props.values.readonly} />}
    <div class="sc-ec-try">{card}<button type="button" class="hm-btn hm-btn-primary" onClick={run}>"hadi-pop" ile oynat</button></div>
  </div>
}
