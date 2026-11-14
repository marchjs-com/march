import { definePlayground } from "../../meta.ts";

export default definePlayground<{ wording: string; gate: boolean; buttons: string; customize: boolean }>({
  options: [
    { key: "wording", label: "Metin", default: "short", options: [{ value: "short", label: "kısa" }, { value: "long", label: "ayrıntılı" }] },
    { key: "gate", label: "Üçüncü taraf yer tutucu", default: true },
    { key: "buttons", label: "Düğme metinleri", default: "default", options: [{ value: "default", label: "hazır metinler" }, { value: "own", label: "kendi metinlerim" }] },
    { key: "customize", label: "Özelleştir düğmesi", default: true },
  ],
});
