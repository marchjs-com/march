import { definePlayground } from "../../meta.ts";

export default definePlayground<{ firstDay: string; window: boolean }>({
  options: [
    { key: "firstDay", label: "Hafta başı", default: "locale", options: [{ value: "locale", label: "dilden" }, { value: "1", label: "Pazartesi" }, { value: "0", label: "Pazar" }, { value: "6", label: "Cumartesi" }] },
    { key: "window", label: "Yalnız yakın günler (min / max)", default: false },
  ],
});
