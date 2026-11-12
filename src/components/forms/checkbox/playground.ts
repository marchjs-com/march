import { definePlayground } from "../../meta.ts";

export default definePlayground<{ variant: string; size: string; indeterminate: boolean }>({
  options: [
    { key: "variant", label: "Görünüm", default: "classic", options: ["classic", "soft", "chip", "card", "toggle"] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
    { key: "indeterminate", label: "Kısmi (indeterminate)", default: false, visibleWhen: (v) => v.variant === "classic" || v.variant === "soft" },
  ],
});
