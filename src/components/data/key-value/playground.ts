import { definePlayground } from "../../meta.ts";

interface Values { columns: number; hint: boolean; empty: boolean }

export default definePlayground<Values>({
  options: [
    { key: "columns", label: "Sütun", default: 2, options: [1, 2, 3, 4] },
    { key: "hint", label: "İpucu satırı", default: true },
    { key: "empty", label: "Boş değer", default: false },
  ],
});
