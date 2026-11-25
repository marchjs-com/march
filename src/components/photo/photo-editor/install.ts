// Installs the core's tool sets and render hooks into an editor, and wires the shared services tools ask for
// (brush presets, patterns, filters from march/image, the airbrush clock).
import { untrack } from "../../../core/reactive.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { onCleanup } from "../../../core/reactive.ts";
import { installPaintTools, installVectorTools, installStyles, BUILTIN_BRUSHES, builtinPatterns, getTool } from "../../../image/doc/index.ts";
import { installSelectTools } from "../../../image/doc/tools/select-tools.ts";
import type { Editor } from "./editor.ts";

let installed = false;

/** Register the built-in tools once (they are global like the op registry) and connect this editor's services. */
export function installTools(ed: Editor): void {
  if (!installed) {
    installed = true;
    installSelectTools();
    installPaintTools();
    installVectorTools();
    installStyles();
  }
  ed.shared.brushPresets ??= BUILTIN_BRUSHES;
  ed.shared.patterns ??= builtinPatterns();
  // airbrush build-up while the pointer rests: the tool's tick on the motion clock
  const stop = onFrame((_t, dt) => {
    const tl = getTool(untrack(ed.tool)) as (ReturnType<typeof getTool> & { tick?: (ctx: unknown, dt: number) => void }) | undefined;
    if (!tl?.tick) return;
    const ctx = ed.toolContext();
    if (ctx) tl.tick(ctx, dt);
  });
  onCleanup(stop);
}
