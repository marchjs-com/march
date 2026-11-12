import { definePlayground } from "../../meta.ts";

export default definePlayground<{ start: string }>({
  options: [{ key: "start", label: "Başlangıç rengi", default: "#f2801f", options: [{ value: "#f2801f", label: "Heyecan" }, { value: "#1d9ad6", label: "Aktivite" }, { value: "#78be3a", label: "Dostluk" }, { value: "#a3338c", label: "İletişim" }] }],
});
