import { definePlayground } from "../../meta.ts";

export default definePlayground<{ disabled: boolean }>({
  options: [{ key: "disabled", label: "Devre dışı", default: false }],
});
