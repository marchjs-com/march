import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PropertyGrid",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Inspector: grouped, searchable property rows edited with the form controls of their type; changes are undo steps (Undo) and unsaved ones are tracked (DirtyState); per-row reset, revert, save.",
  composedOf: ["Disclosure", "SearchBox", "PanelHeader", "UndoRedo", "IconButton", "Button", "Badge", "StatusDot", "Tooltip", "SectionLabel", "Empty", "TextInput", "NumberInput", "Slider", "Toggle", "Select", "Segmented", "ColorInput", "Textarea"],
  behaviors: ["Undo manager", "DirtyState manager", "fold search"],
  hubs: [],
  showcase: "/ide",
});
