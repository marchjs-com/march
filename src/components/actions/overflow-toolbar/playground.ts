import { definePlayground } from "../../meta.ts";

interface Values { width: number; size: string; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "width", label: "Genişlik", default: 520, min: 180, max: 760, step: 20, unit: "px" },
    { key: "size", label: "Boyut", default: "sm", options: ["sm", "md"] },
    { key: "labels", label: "Etiketleri göster", default: false },
  ],
});
