import { definePlayground } from "../../meta.ts";

interface Values { width: number; siblings: boolean }

export default definePlayground<Values>({
  options: [
    { key: "width", label: "Genişlik", default: 560, min: 200, max: 760, step: 20, unit: "px" },
    { key: "siblings", label: "Kardeş menüleri", default: true },
  ],
});
