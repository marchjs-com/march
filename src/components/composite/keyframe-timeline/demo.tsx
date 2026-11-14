// Showcase stage for KeyframeTimeline: three scenes, for the Playground values (playground.ts).
import { signal } from "../../../core/reactive.ts";
import { KeyframeTimeline, type TimelineModel } from "./index.ts";

const SCENES: Record<string, TimelineModel> = {
  intro: { duration: 2400, tracks: [
    { id: "l-y", target: "HADİ", prop: "y", keys: [{ at: 0, value: -60 }, { at: 700, value: 0, easing: "back" }] },
    { id: "l-o", target: "HADİ", prop: "opacity", keys: [{ at: 0, value: 0 }, { at: 500, value: 1, easing: "out" }] },
    { id: "t-x", target: "Başlık", prop: "x", keys: [{ at: 300, value: -120 }, { at: 1100, value: 0, easing: "expo" }] },
    { id: "t-o", target: "Başlık", prop: "opacity", keys: [{ at: 300, value: 0 }, { at: 900, value: 1 }] },
    { id: "b-s", target: "Başla", prop: "scale", keys: [{ at: 1100, value: 0 }, { at: 1600, value: 1.15, easing: "out" }, { at: 1900, value: 1, easing: "in-out" }] },
    { id: "b-r", target: "Başla", prop: "rotate", keys: [{ at: 1100, value: -20 }, { at: 1800, value: 0, easing: "back" }] },
  ] },
  bounce: { duration: 1600, tracks: [
    { id: "y", target: "Top", prop: "y", keys: [{ at: 0, value: -70 }, { at: 500, value: 30, easing: "in" }, { at: 900, value: -30, easing: "out" }, { at: 1250, value: 30, easing: "in" }, { at: 1600, value: 0, easing: "out" }] },
    { id: "s", target: "Top", prop: "scale", keys: [{ at: 450, value: 1 }, { at: 520, value: 0.8 }, { at: 620, value: 1, easing: "out" }, { at: 1200, value: 1 }, { at: 1270, value: 0.85 }, { at: 1360, value: 1, easing: "out" }] },
  ] },
  orbit: { duration: 3000, tracks: [
    { id: "r", target: "Uydu", prop: "rotate", keys: [{ at: 0, value: 0 }, { at: 3000, value: 360, easing: "linear" }] },
    { id: "x", target: "Uydu", prop: "x", keys: [{ at: 0, value: -90 }, { at: 1500, value: 90, easing: "in-out" }, { at: 3000, value: -90, easing: "in-out" }] },
    { id: "g", target: "Gezegen", prop: "scale", keys: [{ at: 0, value: 1 }, { at: 1500, value: 1.2, easing: "in-out" }, { at: 3000, value: 1, easing: "in-out" }] },
  ] },
}

const BAR: Record<string, boolean | ("play" | "time")[]> = { all: true, short: ["play", "time"], none: false }

export default function KeyframeTimelineDemo(props: { values: { scene: string; snap: number; loop: boolean; stage: boolean; readonly: boolean; transport: string; inspector: boolean; curves: boolean; labels: boolean } }) {
  return <div class="sc-ed-one">
    {() => {
      const model = signal(structuredClone(SCENES[props.values.scene] ?? SCENES.intro!))
      // the playback bar, the lane curves and the first loop state are read when the timeline is made: it is made again when they change
      const parts = { transport: BAR[props.values.transport], curves: props.values.curves, loop: props.values.loop }
      return <KeyframeTimeline value={model} snap={props.values.snap} stage={props.values.stage} readonly={props.values.readonly} autoplay
        {...parts} inspector={props.values.inspector}
        labels={props.values.labels ? { hint: "Bir kareye dokun: zamanı, değeri ve eğrisi burada açılır.", time: "Ne zaman (ms)", value: "Kaç" } : undefined} />
    }}
  </div>
}
