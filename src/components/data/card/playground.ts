import { definePlayground } from "../../meta.ts";

interface Values { head: boolean; actions: boolean; footer: boolean; flush: boolean; plain: boolean }

export default definePlayground<Values>({
  options: [
    { key: "head", label: "Başlık", default: true },
    { key: "actions", label: "Başlık eylemleri", default: true, visibleWhen: (v) => v.head },
    { key: "footer", label: "Alt bilgi", default: true },
    { key: "flush", label: "Kenar boşluksuz gövde", default: false },
    { key: "plain", label: "Çerçevesiz (zemin, kenar, gölge yok)", default: false },
  ],
});
