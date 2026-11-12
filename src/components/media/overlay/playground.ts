import { definePlayground } from "../../meta.ts";

interface Values { effect: string; front: boolean; opacity: number }

export default definePlayground<Values>({
  options: [
    { key: "effect", label: "Efekt", default: "mesh", kind: "grid", options: ["glass", "gradient", "mesh", "noise", "vignette", "spotlight", "grid", "dots"] },
    { key: "front", label: "İçeriğin önünde", default: false },
    { key: "opacity", label: "Opaklık", default: 1, min: 0.2, max: 1, step: 0.1 },
  ],
});
