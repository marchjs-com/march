import { definePlayground } from "../../meta.ts";

interface Values { combo: string }

export default definePlayground<Values>({
  options: [
    { key: "combo", label: "Kısayol", default: "mod+k", options: [{ value: "mod+k", label: "mod+k" }, { value: "shift+enter", label: "shift+enter" }, { value: "mod+shift+z", label: "mod+shift+z" }, { value: "alt+arrowleft", label: "alt+←" }, { value: "", label: "metin (Esc)" }] },
  ],
});
