// type-only import: the spec is plain data (its page imports it without the shared component chunk)
import type { PlaygroundSpec } from "../../meta.ts";

interface Values { danger: boolean; shortcuts: boolean }

const spec: PlaygroundSpec<Values> = {
  options: [
    { key: "shortcuts", label: "Kısayolları göster", default: true },
    { key: "danger", label: "Sil öğesi (tehlikeli)", default: true },
  ],
};
export default spec;
