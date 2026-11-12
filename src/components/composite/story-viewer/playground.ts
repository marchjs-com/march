import { definePlayground } from "../../meta.ts";

interface Values { duration: number; reply: boolean; like: boolean; start: string }

export default definePlayground<Values>({
  options: [
    { key: "start", label: "Başlangıç", default: "u1", options: [{ value: "u1", label: "ilk kişi" }, { value: "u3", label: "üçüncü kişi" }] },
    { key: "duration", label: "Hikâye süresi", default: 5000, options: [{ value: 3000, label: "3 sn" }, { value: 5000, label: "5 sn" }, { value: 8000, label: "8 sn" }] },
    { key: "reply", label: "Yanıt alanı", default: true },
    { key: "like", label: "Beğeni", default: true },
  ],
});
