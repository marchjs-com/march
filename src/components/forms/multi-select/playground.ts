import { definePlayground } from "../../meta.ts";

export default definePlayground<{ readonly: boolean }>({
  options: [{ key: "readonly", label: "Salt okunur", default: false }],
});
