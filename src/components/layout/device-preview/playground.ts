import { definePlayground } from "../../meta.ts";

interface Values { device: string; landscape: boolean; touch: boolean; statusBar: boolean; homeIndicator: boolean; camera: boolean }

export default definePlayground<Values>({
  options: [
    { key: "device", label: "Cihaz", default: "iphone-15", options: [{ value: "iphone-15", label: "iPhone 15" }, { value: "pixel-8", label: "Pixel 8" }, { value: "iphone-se", label: "iPhone SE" }, { value: "ipad", label: "iPad" }] },
    { key: "landscape", label: "Yatay", default: false },
    { key: "touch", label: "Dokunma", default: true },
    { key: "statusBar", label: "Durum çubuğu", default: true },
    { key: "homeIndicator", label: "Ana ekran çizgisi", default: true },
    { key: "camera", label: "Kamera", default: true, visibleWhen: (v) => v.device === "iphone-15" || v.device === "pixel-8" },
  ],
});
