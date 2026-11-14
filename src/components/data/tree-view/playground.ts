import { definePlayground } from "../../meta.ts";

interface Values { selection: string; draggable: boolean; icons: boolean; load: string; chevron: string; color: string; animate: boolean; labels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "selection", label: "Seçim", default: "multiple", options: [{ value: "single", label: "tek" }, { value: "multiple", label: "çoklu" }, { value: "none", label: "yok" }] },
    { key: "load", label: "Tembel klasörler", default: "slow", options: [{ value: "fast", label: "hızlı" }, { value: "slow", label: "yavaş" }, { value: "fail", label: "hata" }] },
    { key: "draggable", label: "Sürükle-bırak", default: true },
    { key: "icons", label: "İkonlar", default: true },
    { key: "chevron", label: "Açma oku", default: "on", options: [{ value: "on", label: "ok" }, { value: "own", label: "kendi işaretim (+ / −)" }, { value: "off", label: "yok" }] },
    { key: "color", label: "Seçim rengi", default: "", options: [{ value: "", label: "vurgu rengi" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-purple", label: "mor" }, { value: "success", label: "yeşil" }] },
    { key: "animate", label: "Açılma hareketi", default: true },
    { key: "labels", label: "Kendi metinlerim (boş arama, yeniden dene)", default: false },
  ],
});
