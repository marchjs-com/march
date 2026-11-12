import { definePlayground } from "../../meta.ts";

export default definePlayground<{ rows: number; counter: boolean }>({
  options: [
    { key: "rows", label: "Satır", default: 3, min: 2, max: 8 },
    { key: "counter", label: "Karakter sayacı", default: true },
  ],
});
