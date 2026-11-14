import { definePlayground } from "../../meta.ts";

interface Values { actions: string; size: string; icons: string; danger: boolean; disabled: boolean }

export default definePlayground<Values>({
  options: [
    { key: "actions", label: "Araçlar", default: "all", options: [{ value: "all", label: "yukarı, aşağı, sil" }, { value: "move", label: "yalnız taşıma" }, { value: "remove", label: "yalnız sil" }] },
    { key: "size", label: "Boyut", default: "sm", options: ["xs", "sm", "md"] },
    { key: "icons", label: "İkonlar", default: "default", options: [{ value: "default", label: "varsayılan" }, { value: "own", label: "kendi ikonlarım" }] },
    { key: "danger", label: "Sil kırmızı", default: false, visibleWhen: (v) => v.actions !== "move" },
    { key: "disabled", label: "Hepsi kapalı", default: false },
  ],
});
