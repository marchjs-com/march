import { definePlayground } from "../../meta.ts";

export default definePlayground<{ variant: string; size: string }>({
  options: [
    { key: "variant", label: "Görünüm", default: "classic", options: ["classic", "soft", "chip", "card", "segmented"] },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md", "lg"] },
  ],
});
