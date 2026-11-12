import { definePlayground } from "../../meta.ts";

export default definePlayground<{ variant: string; brand: boolean; inline: boolean }>({
  options: [
    { key: "variant", label: "Görünüm", default: "chip", options: ["classic", "soft", "chip", "card", "toggle"] },
    { key: "brand", label: "HADİ renkleri", default: false },
    { key: "inline", label: "Yan yana", default: true, visibleWhen: (v) => v.variant === "classic" || v.variant === "soft" },
  ],
});
