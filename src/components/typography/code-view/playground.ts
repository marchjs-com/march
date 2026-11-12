import { definePlayground } from "../../meta.ts";

interface Values { lang: string; lineNumbers: boolean; wrap: boolean; copy: boolean }

export default definePlayground<Values>({
  options: [
    { key: "lang", label: "Dil", default: "tsx", options: ["tsx", "css", "json", "sh"] },
    { key: "lineNumbers", label: "Satır numarası", default: true },
    { key: "wrap", label: "Satır kaydır (başlangıç)", default: false },
    { key: "copy", label: "Kopyala düğmesi", default: true },
  ],
});
