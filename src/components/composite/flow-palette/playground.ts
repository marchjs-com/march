// type-only import: the spec is plain data (its page imports it without the shared component chunk)
import type { PlaygroundSpec } from "../../meta.ts";

interface Values { search: boolean; set: string }

const spec: PlaygroundSpec<Values> = {
  options: [
    { key: "set", label: "Türler", default: "all", options: [{ value: "all", label: "hepsi" }, { value: "actions", label: "yalnız eylemler" }, { value: "logic", label: "yalnız mantık" }] },
    { key: "search", label: "Arama kutusu", default: true },
  ],
};
export default spec;
