// LocationManager: the user's position as a signal. Nothing is asked until locate() or watch() runs — call them from a
// click. Permission state and consent go through PermissionManager (a category set there blocks the request).
//
//   import { locator } from "march/managers/location";
//   const loc = locator();
//   button.onclick = () => loc.locate();           loc.position()?.lat   loc.status()   loc.error()
//   const stop = loc.watch();                       loc.distanceTo({ lat: 41.01, lng: 28.97 })   // metres
//
// Events: location:position ({ lat, lng, accuracy }), location:error ({ status, message }), location:watch / location:stop.
import { signal } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";
import { permissions } from "../permission/index.ts";

export interface GeoPoint { lat: number; lng: number }
export interface Position extends GeoPoint {
  /** Metres (radius of 68% confidence). */
  accuracy: number;
  altitude: number | null;
  /** Degrees from north, while moving. */
  heading: number | null;
  /** m/s, while moving. */
  speed: number | null;
  /** When the position was measured (ms since epoch). */
  at: number;
}
export type LocationStatus = "idle" | "locating" | "watching" | "denied" | "blocked" | "unavailable" | "timeout" | "unsupported";

export interface LocationConfig {
  /** GPS where available (slower, more battery). Default false. */
  highAccuracy: boolean;
  /** ms to wait for a fix. Default 15 000. */
  timeout: number;
  /** Accept a cached position this old (ms). Default 60 000. */
  maxAge: number;
}

export interface Locator {
  /** Last known position (reactive). */
  position(): Position | null;
  status(): LocationStatus;
  /** Last error message (reactive). */
  error(): string | null;
  /** Watching for changes now. */
  watching(): boolean;
  /** One position. Rejects with the status as message on denial, timeout or no fix. */
  locate(opts?: Partial<LocationConfig>): Promise<Position>;
  /** Follow the position; returns stop(). */
  watch(opts?: Partial<LocationConfig>): () => void;
  stop(): void;
  /** Great-circle distance in metres from the current position (or `from`). NaN without a position. */
  distanceTo(to: GeoPoint, from?: GeoPoint): number;
  dispose(): void;
}

const DEFAULTS: LocationConfig = { highAccuracy: false, timeout: 15_000, maxAge: 60_000 };

/** Haversine distance in metres. */
export function distance(a: GeoPoint, b: GeoPoint): number {
  const r = Math.PI / 180, R = 6_371_008.8;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const STATUS_BY_CODE: Record<number, LocationStatus> = { 1: "denied", 2: "unavailable", 3: "timeout" };

function create(cfg: LocationConfig): Locator {
  const geo = (globalThis.navigator as Navigator | undefined)?.geolocation;
  const pos = signal<Position | null>(null, { name: "location.position" });
  const status = signal<LocationStatus>(geo ? "idle" : "unsupported", { name: "location.status" });
  const err = signal<string | null>(null, { name: "location.error" });
  let watchId: number | null = null;

  const opts = (o?: Partial<LocationConfig>): PositionOptions => {
    const c = { ...cfg, ...o };
    return { enableHighAccuracy: c.highAccuracy, timeout: c.timeout, maximumAge: c.maxAge };
  };
  const ok = (p: GeolocationPosition): Position => {
    const c = p.coords;
    const v: Position = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, altitude: c.altitude ?? null, heading: Number.isFinite(c.heading) ? c.heading : null, speed: Number.isFinite(c.speed) ? c.speed : null, at: p.timestamp || Date.now() };
    pos.set(v);
    err.set(null);
    emit("location", "position", { lat: v.lat, lng: v.lng, accuracy: v.accuracy });
    return v;
  };
  const fail = (s: LocationStatus, message: string): void => {
    status.set(s);
    err.set(message);
    emit("location", "error", { status: s, message });
  };
  const blocked = (): boolean => {
    if (permissions().consented("geolocation")) return false;
    fail("blocked", "consent");
    return true;
  };

  const stop = (): void => {
    if (watchId === null) return;
    geo?.clearWatch(watchId);
    watchId = null;
    if (status.peek() === "watching") status.set("idle");
    emit("location", "stop");
  };

  return {
    position: pos,
    status,
    error: err,
    watching: () => status() === "watching",
    async locate(o) {
      if (!geo) { fail("unsupported", "unsupported"); throw new Error("unsupported"); }
      if (blocked()) throw new Error("blocked");
      if (watchId === null) status.set("locating");
      return new Promise<Position>((res, rej) => geo.getCurrentPosition((p) => {
        if (watchId === null) status.set("idle");
        res(ok(p));
        void permissions().refresh("geolocation");
      }, (e) => {
        const s = STATUS_BY_CODE[e.code] ?? "unavailable";
        fail(s, e.message || s);
        void permissions().refresh("geolocation");
        rej(new Error(s));
      }, opts(o)));
    },
    watch(o) {
      if (!geo) { fail("unsupported", "unsupported"); return stop; }
      if (watchId !== null) return stop;
      if (!permissions().consented("geolocation")) { fail("blocked", "consent"); return stop; }
      status.set("watching");
      emit("location", "watch");
      watchId = geo.watchPosition((p) => { ok(p); if (watchId !== null) status.set("watching"); }, (e) => {
        const s = STATUS_BY_CODE[e.code] ?? "unavailable";
        if (s === "denied") { geo.clearWatch(watchId!); watchId = null; }
        fail(s, e.message || s);
      }, opts(o));
      return stop;
    },
    stop,
    distanceTo(to, from) { const a = from ?? pos.peek(); return a ? distance(a, to) : NaN; },
    dispose: stop,
  };
}

const manager = defineManager<Locator, LocationConfig>("location", create, DEFAULTS);
/** The location manager (created on first call; asks nothing until locate() / watch()). */
export const locator = (): Locator => manager.get();
/** Set the location manager's options (merged into the current config). */
export const configureLocation = (config: Partial<LocationConfig>): void => manager.configure(config);
/** Stop the location manager and remove its listeners; the next call starts it again. */
export const disposeLocation = (): void => manager.dispose();
/** The location manager (get, configure, dispose). */
export const locationManager = manager;
