import { definePlayground } from "../../meta.ts";

export default definePlayground<{ disabled: boolean }>({
  code: { props: { "bind:value": "{$city}", options: "{CITIES}", placeholder: '"Seç…"' }, root: "select" },
  options: [{ key: "disabled", label: "Devre dışı", default: false }],
});
