import { definePlayground } from "../../meta.ts";

export default definePlayground<{ variant: string; size: string; indeterminate: boolean; grid: boolean }>({
  options: [
    { key: "variant", label: "Görünüm", default: "classic", options: ["classic", "soft", "chip", "card", "toggle"], visibleWhen: (v) => !v.grid },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "indeterminate", label: "Kısmi (indeterminate)", default: false, visibleWhen: (v) => !v.grid && (v.variant === "classic" || v.variant === "soft") },
    { key: "grid", label: "Etiketsiz liste seçimi (Shift ile aralık)", default: false },
  ],
});
