import { definePlayground } from "../../meta.ts";

interface Values { device: string; landscape: boolean; touch: boolean }

export default definePlayground<Values>({
  options: [
    { key: "device", label: "Cihaz", default: "iphone-15", options: [{ value: "iphone-15", label: "iPhone 15" }, { value: "pixel-8", label: "Pixel 8" }, { value: "iphone-se", label: "iPhone SE" }, { value: "ipad", label: "iPad" }] },
    { key: "landscape", label: "Yatay", default: false },
    { key: "touch", label: "Dokunma", default: true },
  ],
});
