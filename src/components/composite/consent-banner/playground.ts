import { definePlayground } from "../../meta.ts";

export default definePlayground<{ wording: string; gate: boolean }>({
  options: [
    { key: "wording", label: "Metin", default: "short", options: [{ value: "short", label: "kısa" }, { value: "long", label: "ayrıntılı" }] },
    { key: "gate", label: "Üçüncü taraf yer tutucu", default: true },
  ],
});
