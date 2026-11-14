import { definePlayground } from "../../meta.ts";

export default definePlayground<{ rows: number; counter: boolean; mono: boolean; tabIndent: boolean }>({
  options: [
    { key: "rows", label: "Satır", default: 3, min: 2, max: 8 },
    { key: "counter", label: "Karakter sayacı", default: true },
    { key: "mono", label: "Eş aralıklı yazı (kod)", default: false },
    { key: "tabIndent", label: "Tab girinti yapar", default: false },
  ],
});
