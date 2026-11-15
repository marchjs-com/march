// DeviceManager: what this device can do — touch points, memory, cores, pixel ratio, network type, battery, storage
// and a feature list (share, vibrate, WebGL, WebGPU, Bluetooth…). For layout signals (breakpoints, pointer, dark) use
// ViewportManager; this one answers "should the app do the heavy thing here?".
//
//   import { device } from "march/managers/device";
//   const d = device();
//   d.network().effectiveType   d.lowEnd()   d.supports("share")   d.battery()?.level   await d.storage()
//
// Events: device:network (NetworkInfo), device:battery ({ level, charging }).
import { signal, type Signal } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";

/** navigator.connection, normalized. Fields are null where the browser does not tell. */
export interface NetworkInfo {
  /** "wifi", "cellular", "ethernet"… or "unknown". */
  type: string;
  /** "slow-2g" | "2g" | "3g" | "4g" | "unknown". */
  effectiveType: string;
  /** Mbit/s estimate. */
  downlink: number | null;
  /** Round-trip estimate in ms. */
  rtt: number | null;
  saveData: boolean;
}
export interface BatteryInfo { level: number; charging: boolean }
export interface StorageInfo { usage: number; quota: number; persisted: boolean | null }

export type DeviceFeature =
  | "serviceWorker" | "webgl" | "webgl2" | "webgpu" | "share" | "clipboard" | "vibrate" | "notifications" | "geolocation"
  | "bluetooth" | "usb" | "serial" | "hid" | "nfc" | "wakeLock" | "broadcastChannel" | "indexedDB" | "webAuthn"
  | "paymentRequest" | "speechSynthesis" | "mediaDevices" | "offscreenCanvas" | "viewTransitions" | "battery";

export interface DeviceConfig {
  /** lowEnd() is true at or below this much memory (GB). Default 2. */
  lowMemory: number;
  /** lowEnd() is true at or below this many cores. Default 2. */
  lowCores: number;
}

export interface Device {
  /** Touch is possible (maxTouchPoints > 0), whatever the primary pointer is. */
  touch(): boolean;
  touchPoints(): number;
  /** Approximate RAM in GB (navigator.deviceMemory; null where unknown). */
  memory(): number | null;
  cores(): number | null;
  /** devicePixelRatio (reactive: zoom and moving to another screen change it). */
  pixelRatio(): number;
  /** A phone or tablet (userAgentData.mobile, else the user agent). */
  mobile(): boolean;
  platform(): string;
  /** Connection type and quality (reactive). */
  network(): NetworkInfo;
  /** A slow connection or Save-Data: skip autoplay, large images, prefetch. */
  slowNetwork(): boolean;
  /** Little memory or few cores: fewer effects, smaller pages. */
  lowEnd(): boolean;
  /** Battery level 0..1 and charging (reactive; null until known or where unsupported). Starts on first read. */
  battery(): BatteryInfo | null;
  /** Storage used and available for this origin. */
  storage(): Promise<StorageInfo | null>;
  supports(feature: DeviceFeature): boolean;
  /** Every feature with its support. */
  features(): Record<DeviceFeature, boolean>;
  /** Vibrate (where supported and allowed). Returns whether it ran. */
  vibrate(pattern: number | number[]): boolean;
  dispose(): void;
}

const DEFAULTS: DeviceConfig = { lowMemory: 2, lowCores: 2 };

type Conn = EventTarget & { type?: string; effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
type Nav = Navigator & { connection?: Conn; deviceMemory?: number; userAgentData?: { mobile?: boolean; platform?: string }; getBattery?: () => Promise<EventTarget & { level: number; charging: boolean }> };
type Mql = { matches: boolean; addEventListener?(t: string, f: () => void): void; removeEventListener?(t: string, f: () => void): void };

const FEATURES: DeviceFeature[] = ["serviceWorker", "webgl", "webgl2", "webgpu", "share", "clipboard", "vibrate", "notifications", "geolocation",
  "bluetooth", "usb", "serial", "hid", "nfc", "wakeLock", "broadcastChannel", "indexedDB", "webAuthn", "paymentRequest", "speechSynthesis",
  "mediaDevices", "offscreenCanvas", "viewTransitions", "battery"];

function create(cfg: DeviceConfig): Device {
  const g = globalThis as typeof globalThis & Record<string, unknown> & { matchMedia?: (q: string) => Mql };
  const nav = g.navigator as Nav | undefined;
  const offs: (() => void)[] = [];

  const readNet = (): NetworkInfo => {
    const c = nav?.connection;
    return { type: c?.type ?? "unknown", effectiveType: c?.effectiveType ?? "unknown", downlink: c?.downlink ?? null, rtt: c?.rtt ?? null, saveData: !!c?.saveData };
  };
  const net = signal(readNet(), { name: "device.network", equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) });
  const conn = nav?.connection;
  if (conn?.addEventListener) {
    const fn = (): void => { const v = readNet(); if (JSON.stringify(v) === JSON.stringify(net.peek())) return; net.set(v); emit("device", "network", v); };
    conn.addEventListener("change", fn);
    offs.push(() => conn.removeEventListener("change", fn));
  }

  const dpr = signal(typeof g.devicePixelRatio === "number" ? g.devicePixelRatio : 1, { name: "device.pixelRatio" });
  // a resolution query matches only the current ratio: re-arm it on every change
  const watchDpr = (): void => {
    const mql = g.matchMedia?.(`(resolution: ${dpr.peek()}dppx)`);
    if (!mql?.addEventListener) return;
    const fn = (): void => { mql.removeEventListener?.("change", fn); dpr.set(typeof g.devicePixelRatio === "number" ? g.devicePixelRatio : 1); watchDpr(); };
    mql.addEventListener("change", fn);
    offs.push(() => mql.removeEventListener?.("change", fn));
  };
  watchDpr();

  let battery: Signal<BatteryInfo | null> | null = null;
  const readBattery = (): BatteryInfo | null => {
    if (battery) return battery();
    const s = (battery = signal<BatteryInfo | null>(null, { name: "device.battery" }));
    nav?.getBattery?.().then((b) => {
      const up = (): void => { const v = { level: b.level, charging: b.charging }; s.set(v); emit("device", "battery", v); };
      up();
      b.addEventListener("levelchange", up);
      b.addEventListener("chargingchange", up);
      offs.push(() => { b.removeEventListener("levelchange", up); b.removeEventListener("chargingchange", up); });
    }, () => {});
    return s();
  };

  const cache = new Map<DeviceFeature, boolean>();
  const gl = (kind: string): boolean => {
    try { const c = g.document?.createElement("canvas"); return !!c?.getContext?.(kind); } catch { return false; }
  };
  const test = (f: DeviceFeature): boolean => {
    const n = (nav ?? {}) as unknown as Record<string, unknown>;
    switch (f) {
      case "webgl": return gl("webgl");
      case "webgl2": return gl("webgl2");
      case "webgpu": return "gpu" in n;
      case "share": return typeof n["share"] === "function";
      case "clipboard": return !!n["clipboard"];
      case "vibrate": return typeof n["vibrate"] === "function";
      case "notifications": return "Notification" in g;
      case "geolocation": return "geolocation" in n;
      case "bluetooth": case "usb": case "serial": case "hid": case "wakeLock": case "serviceWorker": case "mediaDevices": return f in n;
      case "nfc": return "NDEFReader" in g;
      case "broadcastChannel": return "BroadcastChannel" in g;
      case "indexedDB": return "indexedDB" in g;
      case "webAuthn": return "PublicKeyCredential" in g;
      case "paymentRequest": return "PaymentRequest" in g;
      case "speechSynthesis": return "speechSynthesis" in g;
      case "offscreenCanvas": return "OffscreenCanvas" in g;
      case "viewTransitions": return typeof (g.document as unknown as Record<string, unknown> | undefined)?.["startViewTransition"] === "function";
      case "battery": return typeof n["getBattery"] === "function";
    }
  };
  const supports = (f: DeviceFeature): boolean => { let v = cache.get(f); if (v === undefined) cache.set(f, (v = test(f))); return v; };

  const memory = (): number | null => (typeof nav?.deviceMemory === "number" ? nav.deviceMemory : null);
  const cores = (): number | null => (typeof nav?.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null);
  const ua = nav?.userAgent ?? "";

  return {
    touch: () => (nav?.maxTouchPoints ?? 0) > 0,
    touchPoints: () => nav?.maxTouchPoints ?? 0,
    memory,
    cores,
    pixelRatio: dpr,
    mobile: () => nav?.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(ua),
    platform: () => nav?.userAgentData?.platform || nav?.platform || "unknown",
    network: net,
    slowNetwork: () => { const n = net(); return n.saveData || /(^|-)2g$/.test(n.effectiveType) || (n.rtt !== null && n.rtt > 600); },
    lowEnd: () => { const m = memory(), c = cores(); return (m !== null && m <= cfg.lowMemory) || (c !== null && c <= cfg.lowCores); },
    battery: readBattery,
    async storage() {
      const s = (nav as Nav & { storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }>; persisted?: () => Promise<boolean> } })?.storage;
      if (!s?.estimate) return null;
      const e = await s.estimate();
      const persisted = s.persisted ? await s.persisted().catch(() => null) : null;
      return { usage: e.usage ?? 0, quota: e.quota ?? 0, persisted };
    },
    supports,
    features: () => Object.fromEntries(FEATURES.map((f) => [f, supports(f)])) as Record<DeviceFeature, boolean>,
    vibrate: (p) => { try { return typeof nav?.vibrate === "function" && nav.vibrate(p); } catch { return false; } },
    dispose() { for (const off of offs.splice(0)) off(); cache.clear(); },
  };
}

const manager = defineManager<Device, DeviceConfig>("device", create, DEFAULTS);
/** The device manager (created on first call). */
export const device = (): Device => manager.get();
/** Set the device manager's options (merged into the current config). */
export const configureDevice = (config: Partial<DeviceConfig>): void => manager.configure(config);
/** Stop the device manager and remove its listeners; the next call starts it again. */
export const disposeDevice = (): void => manager.dispose();
/** The device manager (get, configure, dispose). */
export const deviceManager = manager;
