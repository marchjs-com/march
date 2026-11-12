import { definePlayground } from "../../meta.ts";

interface Values { iconOnly: boolean }

export default definePlayground<Values>({
  options: [
    { key: "iconOnly", label: "Yalnız ikon", default: false },
  ],
});
