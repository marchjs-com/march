import { definePlayground } from "../../meta.ts";

interface Values { direction: string; gap: number; align: string; wrap: boolean }

export default definePlayground<Values>({
  options: [
    { key: "direction", label: "Yön", default: "row", options: [{ value: "row", label: "satır" }, { value: "column", label: "sütun" }] },
    { key: "gap", label: "Boşluk", default: 3, min: 0, max: 8 },
    { key: "align", label: "Hizalama", default: "center", options: ["start", "center", "end", "stretch"] },
    { key: "wrap", label: "Satır kaydır", default: true, visibleWhen: (v) => v.direction === "row" },
  ],
});
