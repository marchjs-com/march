import { definePlayground } from "../../meta.ts";

interface Values { trail: boolean; endings: boolean }

export default definePlayground<Values>({
  options: [
    { key: "trail", label: "Seçilen yol", default: true },
    { key: "endings", label: "Bulunan sonlar", default: true },
  ],
});
