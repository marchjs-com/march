import { definePlayground } from "../../meta.ts";

export default definePlayground<{ numbers: boolean; readonly: boolean }>({
  options: [
    { key: "numbers", label: "Sayıları sayı olarak sakla", default: true },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
