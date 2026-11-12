import { definePlayground } from "../../meta.ts";

interface Values { nav: boolean; top: boolean }

export default definePlayground<Values>({
  options: [
    { key: "nav", label: "Kenar çubuğu", default: true },
    { key: "top", label: "Üst duyuru", default: true },
  ],
});
