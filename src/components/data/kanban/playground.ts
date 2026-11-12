import { definePlayground } from "../../meta.ts";

interface Values { columns: number; tones: boolean }

export default definePlayground<Values>({
  options: [
    { key: "columns", label: "Sütun", default: 3, options: [2, 3, 4] },
    { key: "tones", label: "Tonlu başlık", default: true },
  ],
});
