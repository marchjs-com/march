import { definePlayground } from "../../meta.ts";

export default definePlayground<{ presets: boolean }>({
  options: [{ key: "presets", label: "Hazır aralıklar", default: true }],
});
