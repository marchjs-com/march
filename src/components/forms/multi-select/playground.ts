import { definePlayground } from "../../meta.ts";

export default definePlayground<{ readonly: boolean; remove: string }>({
  options: [
    { key: "remove", label: "Etiketi kaldır düğmesi", default: "x", options: [{ value: "x", label: "×" }, { value: "icon", label: "çöp kutusu ikonu" }, { value: "off", label: "yok (Backspace ile)" }] },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
