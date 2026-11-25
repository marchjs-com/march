// march/image: the image-editing engine. Non-destructive (the source stays; an edit is a list of ops), linear-light
// maths, colour ops fused into one 3D LUT, WebGL2 display with a Canvas 2D fallback, CSS-filter previews, sliced work
// for big images, loading (files, drops, pastes, URLs, camera; EXIF upright) and export (PNG / JPEG / WebP / AVIF,
// predicted size, size target, srcset). Each op is its own module and CDN entry: march/image/ops/<name>.
//   import { imageDoc, loadRaster, render } from "march/image";
//   import { exposure } from "march/image/ops/exposure";
//   const doc = imageDoc(); doc.add(exposure(0.5)); const out = render(await loadRaster(file), doc.ops());
export * from "./raster.ts";
export * from "./op.ts";
export * from "./lut.ts";
export * from "./pipeline.ts";
export * from "./doc.ts";
export * from "./io.ts";
export * from "./export.ts";
export * from "./analysis.ts";
export { glView, type GLView } from "./gl.ts";
export { gaussian, gaussPlane, lumaPlane, lightPlane, localContrast } from "./blur.ts";
export { linToOklab, oklabToLin, withLch, hexToLin, curveTable, readTable, toneByLightness, perChannelEncoded, hueDist } from "./color.ts";
