// march/image/psd — read and write PSD / PSB files (Adobe's published layered file format) to and from the March
// image document: layers, groups, masks, vector masks, blend modes, styles, text, fill / shape / adjustment layers,
// smart objects, 8 / 16 / 32-bit, grayscale and CMYK input. Imports only march/image/doc.

export { readPsd, iccName, quadMatrix, type PsdReadOptions, type PsdLayerData } from "./read.ts";
export { writePsd, type PsdWriteOptions } from "./write.ts";
export { readDescriptor, writeDescriptor, readVersioned, writeVersioned, plain as plainDescriptor, type Descriptor, type DItem, type RefItem } from "./descriptor.ts";
export { parseEngineData, writeEngineData, type EValue, type EName } from "./engine-data.ts";
export { ADJUSTMENTS as PSD_ADJUSTMENTS, BLEND_KEYS as PSD_BLEND_KEYS, BLEND_ENUMS as PSD_BLEND_ENUMS, type AdjustCodec } from "./maps.ts";
export { styleFrom as styleFromDescriptor, styleToDesc as styleToDescriptor } from "./fx.ts";
export { Reader as PsdReader, Writer as PsdWriter, packBits, unpackBits } from "./binary.ts";

/** True when the bytes start a PSD / PSB file. */
export const isPsd = (u: Uint8Array): boolean => u.length > 26 && u[0] === 0x38 && u[1] === 0x42 && u[2] === 0x50 && u[3] === 0x53;
