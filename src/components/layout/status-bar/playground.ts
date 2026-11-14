import { definePlayground } from "../../meta.ts";

interface Values { state: string; width: number; dot: string; pulse: boolean }

export default definePlayground<Values>({
  options: [
    { key: "state", label: "Durum", default: "saved", options: [{ value: "saved", label: "kaydedildi" }, { value: "busy", label: "kaydediliyor" }, { value: "error", label: "hata" }] },
    { key: "width", label: "Genişlik", default: 640, min: 220, max: 760, step: 20, unit: "px" },
    { key: "dot", label: "Durum noktası", default: "dot", options: [{ value: "dot", label: "nokta" }, { value: "own", label: "kendi işaretim" }, { value: "off", label: "yok" }] },
    { key: "pulse", label: "Meşgulken nabız", default: true, visibleWhen: (v) => v.state === "busy" && v.dot !== "off" },
  ],
});
