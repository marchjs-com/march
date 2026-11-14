import { definePlayground } from "../../meta.ts";

interface Values { duration: number; reply: boolean; like: boolean; start: string; progress: boolean; header: boolean; buttons: boolean; arrows: boolean; ownLabels: boolean }

export default definePlayground<Values>({
  options: [
    { key: "start", label: "Başlangıç", default: "u1", options: [{ value: "u1", label: "ilk kişi" }, { value: "u3", label: "üçüncü kişi" }] },
    { key: "duration", label: "Hikâye süresi", default: 5000, options: [{ value: 3000, label: "3 sn" }, { value: 5000, label: "5 sn" }, { value: 8000, label: "8 sn" }] },
    { key: "reply", label: "Yanıt alanı", default: true },
    { key: "like", label: "Beğeni", default: true },
    { key: "progress", label: "İlerleme çubukları", default: true },
    { key: "header", label: "Avatar ve zaman", default: true },
    { key: "buttons", label: "Duraklat / kapat düğmeleri", default: true },
    { key: "arrows", label: "Önceki / sonraki okları", default: true },
    { key: "ownLabels", label: "Kendi metinlerim (yanıt alanı)", default: false, visibleWhen: (v) => v.reply },
  ],
});
