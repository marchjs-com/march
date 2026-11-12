import { definePlayground } from "../../meta.ts";

interface Values { size: string; footer: boolean; dismissable: boolean; long: boolean }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "md", kind: "segmented", options: ["sm", "md", "lg", "full"] },
    { key: "footer", label: "Alt çubuk (düğmeler)", default: true },
    { key: "dismissable", label: "Escape ve perde kapatır", default: true },
    { key: "long", label: "Uzun içerik (kaydırma)", default: false },
  ],
});
