import { definePlayground } from "../../meta.ts";

export default definePlayground<{ max: number; readonly: boolean; sortable: boolean; trash: boolean }>({
  options: [
    { key: "max", label: "En fazla", default: 5, options: [3, 5, 10] },
    { key: "sortable", label: "Sıralama düğmeleri", default: true },
    { key: "trash", label: "Kaldır düğmesi: çöp kutusu ikonu", default: false },
    { key: "readonly", label: "Salt okunur", default: false },
  ],
});
