import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "DevicePreview",
  status: "experimental",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Content as on a real device: phone / tablet body or desktop window, ~35 devices, real size, turning; the mouse as 1–3 fingers (real touch events, pinch, rotate, gestures); a control rail for shake, tilt, offline, battery, background and keyboard.",
  category: "layout",
  composedOf: ["OverlayScope", "IconButton", "Button", "Menu", "Popover", "Slider", "Toggle"],
  behaviors: ["touch emulation", "device events"],
});
