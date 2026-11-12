import { definePlayground } from "../../meta.ts";

interface Values { toolbar: string; mentions: boolean; emoji: boolean; counter: boolean; readonly: boolean; rows: number; output: boolean }

export default definePlayground<Values>({
  options: [
    { key: "toolbar", label: "Araç çubuğu", default: "full", kind: "segmented", options: [{ value: "full", label: "tam" }, { value: "minimal", label: "sade" }, { value: "none", label: "yok" }] },
    { key: "mentions", label: "@ bahsetme", default: true },
    { key: "emoji", label: ": emoji", default: true },
    { key: "counter", label: "Sayaç", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
    { key: "rows", label: "Yükseklik (satır)", default: 7, min: 3, max: 14, step: 1 },
    { key: "output", label: "Markdown çıktısı", default: true },
  ],
});
