import { definePlayground } from "../../meta.ts";

interface Values { rate: number; dot: boolean }

export default definePlayground<Values>({
  options: [
    { key: "rate", label: "Dakikada artış", default: 40, min: 4, max: 400, step: 4 },
    { key: "dot", label: "Canlı noktası", default: true },
  ],
});
