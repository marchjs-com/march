import { definePlayground } from "../../meta.ts";

interface Values { state: string; width: number }

export default definePlayground<Values>({
  options: [
    { key: "state", label: "Durum", default: "saved", options: [{ value: "saved", label: "kaydedildi" }, { value: "busy", label: "kaydediliyor" }, { value: "error", label: "hata" }] },
    { key: "width", label: "Genişlik", default: 640, min: 220, max: 760, step: 20, unit: "px" },
  ],
});
