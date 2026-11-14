import { definePlayground } from "../../meta.ts";

interface Values { content: string; placement: string; motion: string; title: boolean; closable: boolean; width: string; outside: boolean }

export default definePlayground<Values>({
  options: [
    { key: "content", label: "İçerik", default: "form", options: [{ value: "form", label: "süzgeç formu" }, { value: "list", label: "seçenek listesi" }] },
    { key: "placement", label: "Yer", default: "bottom-start", options: [{ value: "bottom-start", label: "alt · baş" }, { value: "bottom", label: "alt · orta" }, { value: "bottom-end", label: "alt · son" }, { value: "top-start", label: "üst · baş" }, { value: "top", label: "üst · orta" }, { value: "top-end", label: "üst · son" }] },
    { key: "motion", label: "Açılış hareketi", default: "scale", options: [{ value: "scale", label: "büyüyerek" }, { value: "fade", label: "belirerek" }, { value: "rise", label: "yükselerek" }, { value: "none", label: "yok" }] },
    { key: "title", label: "Başlık çubuğu", default: true },
    { key: "closable", label: "Kapat düğmesi", default: true, visibleWhen: (v) => v.title },
    { key: "width", label: "Genişlik", default: "auto", options: [{ value: "auto", label: "içerik" }, "sm", "md", "lg"] },
    { key: "outside", label: "Dışarı tıklayınca kapan", default: true },
  ],
});
