import { definePlayground } from "../../meta.ts";

interface Values { text: boolean; overlay: boolean }

export default definePlayground<Values>({
  options: [
    { key: "text", label: "Görünür metin", default: true },
    { key: "overlay", label: "İçeriğin üstünde (perde)", default: true },
  ],
});
