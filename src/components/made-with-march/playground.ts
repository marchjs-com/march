import { definePlayground } from "../meta.ts";

interface Values { variant: string }

export default definePlayground<Values>({
  options: [
    { key: "variant", label: "Görünüm", default: "text", options: [{ value: "text", label: "metin" }, { value: "badge", label: "rozet" }, { value: "small", label: "küçük" }] },
  ],
});
