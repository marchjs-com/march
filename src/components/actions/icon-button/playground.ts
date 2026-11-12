import { definePlayground } from "../../meta.ts";

interface Values { size: string; danger: boolean }

export default definePlayground<Values>({
  options: [
    { key: "size", label: "Boyut", default: "md", options: ["sm", "md"] },
    { key: "danger", label: "Tehlike tonu", default: false },
  ],
});
