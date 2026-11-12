import { definePlayground } from "../../meta.ts";

export default definePlayground<{ seconds: boolean; disabled: boolean }>({
  options: [
    { key: "seconds", label: "Saniye", default: false },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
