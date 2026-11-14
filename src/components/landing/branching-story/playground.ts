import { definePlayground } from "../../meta.ts";

interface Values { trail: boolean; endings: boolean; transition: string; keys: boolean; choice: string; texts: boolean }

export default definePlayground<Values>({
  options: [
    { key: "trail", label: "Seçilen yol", default: true },
    { key: "endings", label: "Bulunan sonlar", default: true, visibleWhen: (v) => v.trail },
    { key: "transition", label: "Sayfa geçişi", default: "turn", options: [{ value: "turn", label: "sayfa çevirme" }, { value: "slide", label: "kayma" }, { value: "fade", label: "solma" }, { value: "own", label: "kendi hareketim" }, { value: "none", label: "yok" }] },
    { key: "keys", label: "Rakam tuşları (1–9)", default: true },
    { key: "choice", label: "Seçenek içeriği", default: "default", options: [{ value: "default", label: "hazır" }, { value: "own", label: "kendi çizimim" }] },
    { key: "texts", label: "Kendi metinlerim", default: false },
  ],
});
