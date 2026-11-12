import { definePlayground } from "../../meta.ts";

export default definePlayground<{ locale: string; disabled: boolean }>({
  options: [
    { key: "locale", label: "Dil", default: "", options: [{ value: "", label: "uygulama" }, { value: "tr-TR", label: "tr-TR" }, { value: "en-US", label: "en-US" }, { value: "ja-JP", label: "ja-JP" }] },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
