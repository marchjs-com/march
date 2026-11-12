import { definePlayground } from "../../meta.ts";

interface Values { mode: string; format: string; value: number }

export default definePlayground<Values>({
  options: [
    { key: "mode", label: "Tür", default: "count", options: [{ value: "count", label: "sayma" }, { value: "roll", label: "sayaç (odometre)" }] },
    { key: "format", label: "Biçim", default: "number", options: [{ value: "number", label: "sayı" }, { value: "currency", label: "para" }, { value: "percent", label: "yüzde" }, { value: "compact", label: "kısa" }] },
    { key: "value", label: "Değer", default: 12840, min: 0, max: 99999, step: 137 },
  ],
});
