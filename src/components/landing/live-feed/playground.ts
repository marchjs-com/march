import { definePlayground } from "../../meta.ts";

interface Values { variant: string; every: number; max: number }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "list", options: [{ value: "list", label: "satırlar" }, { value: "wall", label: "duvar" }] },
    { key: "every", label: "Aralık (ms)", default: 2400, min: 800, max: 6000, step: 200 },
    { key: "max", label: "Ekranda", default: 5, min: 2, max: 9, step: 1 },
  ],
});
