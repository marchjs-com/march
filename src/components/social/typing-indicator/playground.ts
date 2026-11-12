import { definePlayground } from "../../meta.ts";

interface Values { people: number; variant: string; text: boolean }

export default definePlayground<Values>({
  options: [
    { key: "people", label: "Yazan", default: 1, options: [{ value: 0, label: "kimse" }, { value: 1, label: "1" }, { value: 2, label: "2" }, { value: 4, label: "4" }] },
    { key: "variant", label: "Görünüm", default: "bubble", options: [{ value: "bubble", label: "balon" }, { value: "inline", label: "satır" }], visibleWhen: (v) => v.people > 0 },
    { key: "text", label: "Metin", default: true, visibleWhen: (v) => v.people > 0 },
  ],
});
