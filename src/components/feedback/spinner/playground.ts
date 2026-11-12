import { definePlayground } from "../../meta.ts";

interface Values { size: string; colors: string }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "lg", kind: "segmented", options: ["sm", "md", "lg"] },
    { key: "colors", label: "Renkler", default: "brand", kind: "cards", options: [{ value: "brand", label: "dört marka rengi" }, { value: "pair", label: "iki renk" }, { value: "single", label: "tek renk" }] },
  ],
});
