import { definePlayground } from "../../meta.ts";

interface Values { state: string; size: string; add: string; loading: boolean; color: string }

export default definePlayground<Values>({
  options: [
    { key: "state", label: "Durum", default: "new", options: [{ value: "new", label: "yeni" }, { value: "seen", label: "görüldü" }, { value: "close", label: "yakın arkadaş" }, { value: "none", label: "yok" }] },
    { key: "color", label: "Halka rengi", default: "sweep", options: [{ value: "sweep", label: "HADİ renkleri" }, { value: "brand-purple", label: "mor" }, { value: "brand-orange", label: "turuncu" }, { value: "brand-blue", label: "mavi" }], visibleWhen: (v) => v.state === "new" || v.state === "close" },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "add", label: "Rozet", default: "off", options: [{ value: "off", label: "yok" }, { value: "on", label: "+" }, { value: "own", label: "kendi ikonum" }] },
    { key: "loading", label: "Yükleniyor", default: false, visibleWhen: (v) => v.state !== "none" },
  ],
});
