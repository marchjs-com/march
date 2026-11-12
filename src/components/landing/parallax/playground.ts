import { definePlayground } from "../../meta.ts";

interface Values { depth: number; pointer: number }

export default definePlayground<Values>({
  options: [
    { key: "depth", label: "Derinlik (kaydırma hızı)", default: 0.35, min: 0, max: 0.8, step: 0.05 },
    { key: "pointer", label: "Fare izleme", default: 1, min: 0, max: 2, step: 0.25 },
  ],
});
