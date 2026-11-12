// Open state of the command palette, shared by the shell (palette.ts) and the lazily loaded view (palette-view.ts).
import { signal } from "../../../core/reactive.ts";

export const isOpen = signal(false, { name: "palette.open" });
