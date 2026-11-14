import { definePlayground } from "../../meta.ts";

export default definePlayground<{ multiple: boolean; accept: string; upload: boolean; hint: string; preview: boolean; remove: string }>({
  options: [
    { key: "multiple", label: "Birden çok dosya", default: true },
    { key: "accept", label: "Kabul edilen", default: "image/*", options: [{ value: "", label: "her tür" }, { value: "image/*", label: "görsel" }, { value: ".pdf", label: "PDF" }] },
    { key: "upload", label: "Yükleme ilerlemesi", default: true },
    { key: "hint", label: "Alt satır (ipucu)", default: "auto", options: [{ value: "auto", label: "tür · boyut" }, { value: "own", label: "kendi metnim" }, { value: "off", label: "yok" }] },
    { key: "preview", label: "Görsel önizlemesi", default: true },
    { key: "remove", label: "Kaldır düğmesi", default: "x", options: [{ value: "x", label: "×" }, { value: "icon", label: "çöp kutusu ikonu" }] },
  ],
});
