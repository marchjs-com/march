import { definePlayground } from "../../meta.ts";

interface Values { private: boolean; size: string; block: boolean }

export default definePlayground<Values>({
  options: [
    { key: "private", label: "Gizli hesap (istek)", default: false },
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md"] },
    { key: "block", label: "Tam genişlik", default: false },
  ],
});
