import { definePlayground } from "../../meta.ts";

interface Values { filter: boolean; groupsCollapsed: boolean; collapsible: boolean }

export default definePlayground<Values>({
  options: [
    { key: "filter", label: "Süzme kutusu", default: true },
    { key: "groupsCollapsed", label: "Gruplar kapalı başlar", default: false },
    { key: "collapsible", label: "İkon rayına daraltma", default: true },
  ],
});
