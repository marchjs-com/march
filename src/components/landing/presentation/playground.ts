import { definePlayground } from "../../meta.ts";

interface Values { transition: string; presenter: boolean }

export default definePlayground<Values>({
  options: [
    { key: "transition", label: "Geçiş", default: "slide", options: [{ value: "slide", label: "kaydır" }, { value: "fade", label: "sol" }, { value: "zoom", label: "yakınlaş" }, { value: "none", label: "yok" }] },
    { key: "presenter", label: "Konuşmacı görünümü", default: false },
  ],
});
