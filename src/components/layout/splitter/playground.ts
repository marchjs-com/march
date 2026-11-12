import { definePlayground } from "../../meta.ts";

interface Values { initial: number; min: number }

export default definePlayground<Values>({
  options: [
    { key: "initial", label: "Başlangıç payı", default: 35, min: 20, max: 80, step: 5, unit: "%" },
    { key: "min", label: "En küçük pay", default: 20, min: 5, max: 40, step: 5, unit: "%" },
  ],
});
