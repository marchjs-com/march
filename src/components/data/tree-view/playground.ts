import { definePlayground } from "../../meta.ts";

interface Values { selection: string; draggable: boolean; icons: boolean; load: string }

export default definePlayground<Values>({
  options: [
    { key: "selection", label: "Seçim", default: "multiple", options: [{ value: "single", label: "tek" }, { value: "multiple", label: "çoklu" }, { value: "none", label: "yok" }] },
    { key: "load", label: "Tembel klasörler", default: "slow", options: [{ value: "fast", label: "hızlı" }, { value: "slow", label: "yavaş" }, { value: "fail", label: "hata" }] },
    { key: "draggable", label: "Sürükle-bırak", default: true },
    { key: "icons", label: "İkonlar", default: true },
  ],
});
