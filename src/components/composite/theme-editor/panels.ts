// The ThemeEditor tabs after Colors, as one chunk loaded when one of them is first opened: typography and shape
// (forms.ts), motion (motion.ts) and export (export.ts), with their Turkish texts.
import { messages } from "../../../core/i18n.ts";
import tr from "./tr.panels.ts";

messages("tr", tr);

export { TypePanel, ShapePanel } from "./forms.ts";
export { StylePanel } from "./style.ts";
export { MotionPanel } from "./motion.ts";
export { ExportPanel } from "./export.ts";
