import { definePlayground } from "../../meta.ts";

interface Values { variant: string; align: string }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Arka plan", default: "gradient", options: [{ value: "gradient", label: "gradyan" }, { value: "mesh", label: "ağ" }, { value: "glass", label: "cam" }, { value: "plain", label: "sade" }, { value: "video", label: "video" }] },
    { key: "align", label: "Hiza", default: "center", options: [{ value: "center", label: "orta" }, { value: "start", label: "baş" }] },
  ],
});
