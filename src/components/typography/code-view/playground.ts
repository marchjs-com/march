import { definePlayground } from "../../meta.ts";

interface Values { lang: string; toolbar: boolean; langLabel: string; lineNumbers: boolean; wrap: boolean; wrapButton: boolean; copy: boolean }

export default definePlayground<Values>({
  options: [
    { key: "lang", label: "Dil", default: "tsx", options: ["tsx", "css", "json", "sh"] },
    { key: "toolbar", label: "Araç çubuğu", default: true },
    { key: "langLabel", label: "Dil etiketi", default: "lang", kind: "segmented", options: [{ value: "lang", label: "dil adı" }, { value: "own", label: "dosya adı" }, { value: "off", label: "yok" }], visibleWhen: (v) => v.toolbar },
    { key: "lineNumbers", label: "Satır numarası", default: true },
    { key: "wrap", label: "Satır kaydır (başlangıç)", default: false },
    { key: "wrapButton", label: "Kaydır düğmesi", default: true, visibleWhen: (v) => v.toolbar },
    { key: "copy", label: "Kopyala düğmesi", default: true, visibleWhen: (v) => v.toolbar },
  ],
});
