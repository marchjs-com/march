// Registers the painting, retouching, toning and fill tools (brush engine based) with the tool registry.

import { registerTool } from "./tool.ts";
import { brushTool, colorReplacementTool, mixerBrushTool, pencilTool } from "./brush-tools.ts";
import { backgroundEraserTool, eraserTool, magicEraserTool } from "./eraser.ts";
import { artHistoryBrushTool, historyBrushTool } from "./history-brush.ts";
import { cloneStampTool, patternStampTool } from "./stamp.ts";
import { contentAwareMoveTool, healingBrushTool, patchTool, redEyeTool, spotHealingTool } from "./heal.ts";
import { blurTool, sharpenTool, smudgeTool } from "./focus.ts";
import { burnTool, dodgeTool, spongeTool } from "./tone.ts";
import { gradientTool, paintBucketTool } from "./fill.ts";
import type { PaintTool } from "./paint-common.ts";

/** Every paint tool, in toolbar order. */
export const PAINT_TOOLS: PaintTool[] = [
  spotHealingTool, healingBrushTool, patchTool, contentAwareMoveTool, redEyeTool,
  brushTool, pencilTool, colorReplacementTool, mixerBrushTool,
  cloneStampTool, patternStampTool,
  historyBrushTool, artHistoryBrushTool,
  eraserTool, backgroundEraserTool, magicEraserTool,
  gradientTool, paintBucketTool,
  blurTool, sharpenTool, smudgeTool,
  dodgeTool, burnTool, spongeTool,
];

/** Register the paint tools; returns a function that removes them again. */
export function installPaintTools(): () => void {
  return registerTool(...PAINT_TOOLS);
}
