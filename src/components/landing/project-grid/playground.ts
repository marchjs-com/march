import { definePlayground } from "../../meta.ts";

interface Values { cols: number; filters: boolean }

export default definePlayground<Values>({
  options: [
    { key: "cols", label: "Sütun", default: 3, options: [{ value: 2, label: "2" }, { value: 3, label: "3" }] },
    { key: "filters", label: "Süzgeç çipleri", default: true },
  ],
});
