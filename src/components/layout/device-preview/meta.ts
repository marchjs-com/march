import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "DevicePreview",
  status: "experimental",
  since: "0.1.0",
  summary: "Content as on a real phone or tablet: device body, notch, status bar, home indicator, real screen size, rotation; the mouse acts as a finger (drag to scroll, fling, long press).",
  category: "layout",
  composedOf: ["OverlayScope"],
  behaviors: ["touch emulation"],
  showcase: "/layout",
});
