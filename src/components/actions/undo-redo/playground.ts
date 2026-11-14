import { definePlayground } from "../../meta.ts";

interface Values { actions: string; size: string; icons: string; steps: boolean; shortcuts: boolean; disabled: boolean }

export default definePlayground<Values>({
  options: [
    { key: "actions", label: "Düğmeler", default: "both", options: [{ value: "both", label: "geri al + yinele" }, { value: "undo", label: "yalnız geri al" }] },
    { key: "size", label: "Boyut", default: "md", options: ["xs", "sm", "md", "lg"] },
    { key: "icons", label: "İkonlar", default: "default", options: [{ value: "default", label: "varsayılan" }, { value: "own", label: "kendi ikonlarım" }] },
    { key: "steps", label: "İpucunda adım adı", default: true },
    { key: "shortcuts", label: "İpucunda kısayol", default: true },
    { key: "disabled", label: "Kapalı", default: false },
  ],
});
