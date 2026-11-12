import { definePlayground } from "../../meta.ts";

interface Values { count: number; heights: string; gap: number; overscan: number }

export default definePlayground<Values>({
  options: [
    { key: "count", label: "Satır", default: 10000, options: [{ value: 100, label: "100" }, { value: 10000, label: "10.000" }, { value: 100000, label: "100.000" }] },
    { key: "heights", label: "Yükseklik", default: "mixed", options: [{ value: "same", label: "eşit" }, { value: "mixed", label: "karışık" }] },
    { key: "gap", label: "Ara", default: 8, options: [0, 8, 16] },
    { key: "overscan", label: "Ekran dışı pay", default: 300, options: [{ value: 0, label: "0" }, { value: 300, label: "300 px" }, { value: 1200, label: "1200 px" }] },
  ],
});
