import { definePlayground } from "../../meta.ts";

interface Values { panels: number; panel: string }

export default definePlayground<Values>({
  options: [
    { key: "panels", label: "Panel sayısı", default: 5, min: 3, max: 8, step: 1 },
    { key: "panel", label: "Panel genişliği", default: "26rem", options: [{ value: "18rem", label: "dar" }, { value: "26rem", label: "orta" }, { value: "40rem", label: "geniş" }] },
  ],
});
