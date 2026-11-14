import { definePlayground } from "../../meta.ts";

interface Values { view: string; step: string; locale: string; weekends: boolean; editable: boolean; toolbar: string; nowLine: boolean; event: string; help: string; animate: boolean }

export default definePlayground<Values>({
  options: [
    { key: "view", label: "Görünüm", default: "week", options: [{ value: "month", label: "ay" }, { value: "week", label: "hafta" }, { value: "day", label: "gün" }] },
    { key: "locale", label: "Tarih dili", default: "tr", options: [{ value: "tr", label: "Türkçe" }, { value: "en-US", label: "English (US)" }, { value: "ar-EG", label: "العربية" }, { value: "de", label: "Deutsch" }] },
    { key: "step", label: "Adım", default: "15", options: [{ value: "5", label: "5 dk" }, { value: "15", label: "15 dk" }, { value: "30", label: "30 dk" }], visibleWhen: (v) => v.view !== "month" && v.editable },
    { key: "weekends", label: "Hafta sonu", default: true, visibleWhen: (v) => v.view === "week" },
    { key: "editable", label: "Düzenlenebilir", default: true },
    { key: "toolbar", label: "Üst çubuk", default: "full", options: [{ value: "full", label: "tam" }, { value: "noToday", label: "Bugün düğmesi yok" }, { value: "noViews", label: "görünüm seçici yok" }, { value: "off", label: "yok" }] },
    { key: "event", label: "Etkinlik içeriği", default: "default", options: [{ value: "default", label: "hazır" }, { value: "own", label: "kendi içeriğim" }] },
    { key: "nowLine", label: "Şimdi çizgisi", default: true, visibleWhen: (v) => v.view !== "month" },
    { key: "help", label: "Alt ipucu", default: "on", options: [{ value: "on", label: "hazır metin" }, { value: "own", label: "kendi metnim" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.editable },
    { key: "animate", label: "Hareket", default: true },
  ],
});
