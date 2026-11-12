import { definePlayground } from "../../meta.ts";

export default definePlayground<{ source: string; disabled: boolean }>({
  options: [
    { key: "source", label: "Kaynak", default: "static", options: [{ value: "static", label: "sabit liste" }, { value: "async", label: "eşzamansız arama" }] },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
