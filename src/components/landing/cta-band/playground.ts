import { definePlayground } from "../../meta.ts";

interface Values { variant: string; align: string; backdrop: boolean; reveal: string }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Arka plan", default: "gradient", options: [{ value: "gradient", label: "gradyan" }, { value: "mesh", label: "ağ" }, { value: "glass", label: "cam" }, { value: "plain", label: "sade" }, { value: "video", label: "video" }] },
    { key: "align", label: "Hiza", default: "center", options: [{ value: "center", label: "orta" }, { value: "start", label: "baş" }] },
    { key: "backdrop", label: "Arka plan katmanları", default: true, visibleWhen: (v) => v.variant !== "video" },
    { key: "reveal", label: "Giriş hareketi", default: "scale", options: [{ value: "scale", label: "büyüme" }, { value: "up", label: "aşağıdan" }, { value: "blur", label: "netleşme" }, { value: "flip", label: "dönüş" }, { value: "none", label: "yok" }] },
  ],
});
