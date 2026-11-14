import { definePlayground } from "../../meta.ts";

interface Values { open: boolean; mode: string; tags: boolean; gap: number; motion: string; ring: boolean; color: string }

export default definePlayground<Values>({
  stage: "center",
  options: [
    { key: "open", label: "Parçalarına ayır", default: true },
    { key: "mode", label: "Ne ayrılır", default: "parts", options: [{ value: "parts", label: "kartın parçaları" }, { value: "layers", label: "düğmenin katmanları" }] },
    { key: "tags", label: "Ad etiketleri", default: true },
    { key: "ring", label: "Odak halkası katmanı", default: true, visibleWhen: (v) => v.mode === "layers" },
    { key: "gap", label: "Plakalar arası", default: 26, min: 12, max: 48, step: 2, unit: " px" },
    { key: "motion", label: "Hareket", default: "smooth", options: [{ value: "smooth", label: "yumuşak" }, { value: "spring", label: "yaylı" }, { value: "none", label: "yok" }] },
    { key: "color", label: "Renk", default: "", options: [{ value: "", label: "vurgu" }, { value: "brand-blue", label: "mavi" }, { value: "brand-purple", label: "mor" }] },
  ],
});
