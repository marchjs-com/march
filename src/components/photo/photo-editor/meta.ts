import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PhotoEditor",
  status: "experimental",
  category: "photo",
  entry: "march/photo-editor",
  since: "0.4.0",
  summary: "A complete photo editor on march/image/doc: layers with 27 blend modes, masks and styles, selections, 60+ tools with a pressure brush engine, transforms, type, adjustment layers from march/image, menus, dockable panels, history, PSD and export; shortcuts, touch, collaboration and plugins.",
  composedOf: ["MenuBar", "TabList", "DockLayout", "StatusBar", "Window", "IconButton", "Button", "Segmented", "NumberInput", "Slider", "Select", "Toggle", "ColorInput", "TextInput", "Swatch", "ListRow", "Kbd", "Popover", "Menu", "ContextMenu", "Empty", "Spinner", "Dialog", "CommandPalette"],
  behaviors: ["drag", "roving focus", "motion engine", "CommandManager", "PresenceManager", "positioning"],
  hubs: [],
});
