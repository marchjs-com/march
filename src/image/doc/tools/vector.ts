// Register the vector, type and shape tools and the renderers of text, shape and smart object layers.

import { installShapeRenderer } from "../shapes/render.ts";
import { installSmartRenderer } from "../smart/smart.ts";
import { installTextRenderer } from "../text/render.ts";
import { addAnchorTool, convertAnchorTool, curvaturePenTool, deleteAnchorTool, directSelectTool, freeformPenTool, pathSelectTool, penTool } from "./pen.ts";
import { shapeTools } from "./shape.ts";
import { registerTool, type Tool } from "./tool.ts";
import { typeTools } from "./type.ts";

export const vectorTools: Tool[] = [
  ...typeTools,
  penTool, freeformPenTool, curvaturePenTool, addAnchorTool, deleteAnchorTool, convertAnchorTool,
  pathSelectTool, directSelectTool,
  ...shapeTools,
];

/** Install the text / shape / smart object renderers (idempotent). */
export function installVectorRenderers(): () => void {
  const offs = [installTextRenderer(), installShapeRenderer(), installSmartRenderer()];
  return () => { for (const f of offs) f(); };
}

/** Register the type, pen, path selection and shape tools (and the renderers they need). Returns a remover. */
export function installVectorTools(): () => void {
  const r = installVectorRenderers();
  const t = registerTool(...vectorTools);
  return () => { t(); r(); };
}
