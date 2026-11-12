import { definePlayground } from "../../meta.ts";

interface Values { view: string; step: string; locale: string; weekends: boolean; editable: boolean }

export default definePlayground<Values>({
  options: [
    { key: "view", label: "Görünüm", default: "week", options: [{ value: "month", label: "ay" }, { value: "week", label: "hafta" }, { value: "day", label: "gün" }] },
    { key: "locale", label: "Tarih dili", default: "tr", options: [{ value: "tr", label: "Türkçe" }, { value: "en-US", label: "English (US)" }, { value: "ar-EG", label: "العربية" }, { value: "de", label: "Deutsch" }] },
    { key: "step", label: "Adım", default: "15", options: [{ value: "5", label: "5 dk" }, { value: "15", label: "15 dk" }, { value: "30", label: "30 dk" }], visibleWhen: (v) => v.view !== "month" && v.editable },
    { key: "weekends", label: "Hafta sonu", default: true, visibleWhen: (v) => v.view === "week" },
    { key: "editable", label: "Düzenlenebilir", default: true },
  ],
});
