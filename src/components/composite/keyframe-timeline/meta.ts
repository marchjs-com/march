import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "KeyframeTimeline",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Keyframe timeline on the motion engine: transport, scrub ruler and playhead, colored lanes with value curves, draggable keyframes, EasingCurveEditor per keyframe.",
  composedOf: ["EasingCurveEditor", "Card", "TimeRuler", "ListRow", "StatusDot", "IconButton", "Segmented", "NumberInput"],
  behaviors: ["motion engine (timeline / Playback, easings)", "drag"],
  hubs: [],
  showcase: "/editors",
});
