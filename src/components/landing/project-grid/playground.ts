import { definePlayground } from "../../meta.ts";

interface Values { cols: number; filters: boolean; arrow: string; color: string; motion: boolean }

export default definePlayground<Values>({
  options: [
    { key: "cols", label: "Sütun", default: 3, options: [{ value: 2, label: "2" }, { value: 3, label: "3" }] },
    { key: "filters", label: "Süzgeç çipleri", default: true },
    { key: "color", label: "Seçili çip rengi", default: "default", options: [{ value: "default", label: "vurgu rengi" }, { value: "brand-purple", label: "mor" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-green", label: "yeşil" }], visibleWhen: (v) => v.filters },
    { key: "motion", label: "Süzerken hareket", default: true, visibleWhen: (v) => v.filters },
    { key: "arrow", label: "Kapak rozeti (üstüne gelince)", default: "on", options: [{ value: "on", label: "ok" }, { value: "own", label: "kendi içeriğim (yıl)" }, { value: "off", label: "yok" }] },
  ],
});
