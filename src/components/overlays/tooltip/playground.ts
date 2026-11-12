import { definePlayground } from "../../meta.ts";

interface Values { target: string }

export default definePlayground<Values>({
  options: [
    { key: "target", label: "Neye ipucu", default: "button", options: [{ value: "button", label: "metinli düğme" }, { value: "icon", label: "ikon düğmesi" }] },
  ],
});
