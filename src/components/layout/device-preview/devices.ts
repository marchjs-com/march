// The device catalog of DevicePreview and DevicePicker: phones, tablets and desktop screens with their real CSS pixel
// sizes, pixel ratio, camera and corner radius; and your own devices (saved in this browser).
//   deviceById("pixel-8")  ·  addDevice({ name: "Kiosk", width: 1080, height: 1920, kind: "screen" })  ·  allDevices()
import { signal } from "../../../core/reactive.ts";
import { load, save as store } from "../../../core/util.ts";

export type DeviceKind = "phone" | "tablet" | "desktop" | "screen";
export interface DeviceSpec {
  /** Its id (a catalog key, or "my-…" for your own devices). */
  id?: string;
  name: string;
  /** CSS pixel size of the screen in portrait (a desktop: its usual landscape size). */
  width: number;
  height: number;
  /** Device pixel ratio (default 1 for a desktop, 3 for a phone, 2 for a tablet). */
  dpr?: number;
  /** Corner radius of the screen (px). */
  radius?: number;
  kind?: DeviceKind;
  /** "island" (pill), "punch" (camera hole), "notch" or none. */
  camera?: "island" | "punch" | "notch" | "none";
  /** A touch screen (default: phones and tablets). */
  touch?: boolean;
  /** A device you made (DevicePicker shows a remove button on it). */
  own?: boolean;
}

const P = (name: string, width: number, height: number, dpr: number, radius: number, camera: NonNullable<DeviceSpec["camera"]>): DeviceSpec => ({ name, width, height, dpr, radius, kind: "phone", camera });
const T = (name: string, width: number, height: number, dpr: number, radius: number): DeviceSpec => ({ name, width, height, dpr, radius, kind: "tablet", camera: "none" });
const D = (name: string, width: number, height: number, dpr = 1): DeviceSpec => ({ name, width, height, dpr, radius: 10, kind: "desktop", camera: "none", touch: false });

/** Devices by id (screen sizes in CSS pixels). */
export const DEVICES: Record<string, DeviceSpec> = {
  "iphone-se": P("iPhone SE", 375, 667, 2, 0, "none"),
  "iphone-13-mini": P("iPhone 13 mini", 375, 812, 3, 44, "notch"),
  "iphone-14": P("iPhone 14", 390, 844, 3, 47, "notch"),
  "iphone-15": P("iPhone 15", 393, 852, 3, 55, "island"),
  "iphone-15-pro-max": P("iPhone 15 Pro Max", 430, 932, 3, 55, "island"),
  "iphone-16-pro": P("iPhone 16 Pro", 402, 874, 3, 55, "island"),
  "iphone-16-pro-max": P("iPhone 16 Pro Max", 440, 956, 3, 55, "island"),
  "pixel-7": P("Pixel 7", 412, 915, 2.625, 40, "punch"),
  "pixel-8": P("Pixel 8", 412, 915, 2.625, 42, "punch"),
  "pixel-9-pro": P("Pixel 9 Pro", 410, 914, 3, 44, "punch"),
  "galaxy-s24": P("Galaxy S24", 384, 832, 3, 38, "punch"),
  "galaxy-s24-ultra": P("Galaxy S24 Ultra", 384, 824, 3.75, 18, "punch"),
  "galaxy-a54": P("Galaxy A54", 412, 914, 2.625, 34, "punch"),
  "galaxy-z-flip-5": P("Galaxy Z Flip 5", 360, 880, 3, 30, "punch"),
  "galaxy-z-fold-5": P("Galaxy Z Fold 5", 344, 882, 3, 24, "punch"),
  "galaxy-z-fold-5-open": { ...P("Galaxy Z Fold 5 (açık)", 690, 829, 2.5, 20, "punch") },
  "xiaomi-14": P("Xiaomi 14", 393, 873, 3, 40, "punch"),
  "oneplus-12": P("OnePlus 12", 412, 919, 3.5, 40, "punch"),
  "nothing-phone-2": P("Nothing Phone (2)", 412, 919, 2.625, 40, "punch"),
  "ipad-mini": T("iPad mini", 744, 1133, 2, 21),
  "ipad": T("iPad", 820, 1180, 2, 22),
  "ipad-pro-11": T("iPad Pro 11", 834, 1194, 2, 18),
  "ipad-pro": T("iPad Pro 12.9", 1024, 1366, 2, 22),
  "galaxy-tab-s9": T("Galaxy Tab S9", 800, 1280, 2, 16),
  "pixel-tablet": T("Pixel Tablet", 800, 1280, 2, 20),
  "surface-pro-9": T("Surface Pro 9", 912, 1368, 2, 8),
  "laptop-1280": D("Dizüstü HD", 1280, 800),
  "laptop-1366": D("Dizüstü 1366", 1366, 768),
  "macbook-air": D("MacBook Air 13", 1470, 956, 2),
  "macbook-pro-16": D("MacBook Pro 16", 1728, 1117, 2),
  "desktop-1920": D("Full HD", 1920, 1080),
  "desktop-2560": D("QHD 1440p", 2560, 1440),
  "imac-24": D("iMac 24", 2240, 1260, 2),
  "desktop-4k": D("4K UHD", 3840, 2160),
  "kiosk": { name: "Dikey kiosk", width: 1080, height: 1920, dpr: 1, radius: 0, kind: "screen", camera: "none", touch: true },
};
for (const [id, d] of Object.entries(DEVICES)) d.id = id;

const KEY = "march:devices";
const read = (): DeviceSpec[] => { const v = load<unknown>(KEY, []); return Array.isArray(v) ? v as DeviceSpec[] : []; };
/** Your own devices (saved in this browser's storage). */
export const customDevices = signal<DeviceSpec[]>(read());
const save = (list: DeviceSpec[]): void => { customDevices.set(list); store(KEY, list); };

/** Save a device of your own; returns its id ("my-<name>"). */
export function addDevice(d: DeviceSpec): string {
  const base = `my-${d.name.toLowerCase().replace(/[^a-z0-9ğüşıöç]+/g, "-").replace(/^-|-$/g, "") || "cihaz"}`;
  let id = base, n = 2;
  while (customDevices.peek().some((x) => x.id === id) || DEVICES[id]) id = `${base}-${n++}`;
  save([...customDevices.peek(), { ...d, id, own: true, width: Math.max(120, Math.round(d.width)), height: Math.max(120, Math.round(d.height)) }]);
  return id;
}
/** Remove one of your devices. */
export function removeDevice(id: string): void { save(customDevices.peek().filter((x) => x.id !== id)); }
/** Every device: the catalog, then yours. */
export const allDevices = (): DeviceSpec[] => [...Object.values(DEVICES), ...customDevices()];
/** A device by id (catalog or yours). */
export const deviceById = (id: string | null | undefined): DeviceSpec | undefined => (id ? DEVICES[id] ?? customDevices().find((x) => x.id === id) : undefined);
/** Is it a touch screen? */
export const isTouch = (d: DeviceSpec): boolean => d.touch ?? (d.kind === "phone" || d.kind === "tablet" || d.kind == null);
/** Its pixel ratio. */
export const dprOf = (d: DeviceSpec): number => d.dpr ?? (d.kind === "desktop" || d.kind === "screen" ? 1 : d.kind === "tablet" ? 2 : 3);
