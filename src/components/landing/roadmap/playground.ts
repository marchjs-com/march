import { definePlayground } from "../../meta.ts";

interface Values { badges: boolean; scroll: boolean }

export default definePlayground<Values>({
  options: [
    { key: "scroll", label: "Kaydırdıkça dolsun", default: true },
    { key: "badges", label: "Durum rozetleri", default: true },
  ],
});
