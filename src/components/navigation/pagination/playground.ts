import { definePlayground } from "../../meta.ts";

interface Values { pages: number; siblings: number }

export default definePlayground<Values>({
  options: [
    { key: "pages", label: "Sayfa sayısı", default: 20, min: 1, max: 60 },
    { key: "siblings", label: "Komşu sayfa", default: 1, options: [0, 1, 2] },
  ],
});
