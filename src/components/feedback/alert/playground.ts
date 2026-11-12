import { definePlayground } from "../../meta.ts";

interface Values { tone: string; title: boolean; dismissable: boolean }

export default definePlayground<Values>({
  options: [
    { key: "tone", label: "Ton", default: "info", kind: "cards", options: [{ value: "info", label: "bilgi" }, { value: "success", label: "başarı" }, { value: "warn", label: "uyarı" }, { value: "danger", label: "tehlike" }, { value: "neutral", label: "nötr" }] },
    { key: "title", label: "Başlık", default: true },
    { key: "dismissable", label: "Kapatılabilir", default: true },
  ],
});
