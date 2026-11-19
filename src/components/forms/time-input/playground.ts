import { definePlayground } from "../../meta.ts";

// every option writes a real prop of TimeInput: "Saniye" is step={1} (the field then shows and keeps seconds)
export default definePlayground<{ seconds: boolean; min: string; max: string; disabled: boolean }>({
  options: [
    { key: "seconds", label: "Saniye", default: false, prop: "step", toCode: { true: "{1}", false: null } },
    { key: "min", label: "En erken (min)", default: "", kind: "text" },
    { key: "max", label: "En geç (max)", default: "", kind: "text" },
    { key: "disabled", label: "Devre dışı", default: false },
  ],
});
