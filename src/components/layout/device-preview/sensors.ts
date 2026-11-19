// Device events for DevicePreview: what a real phone feels and tells the page, played on demand. Shake (devicemotion),
// tilt (deviceorientation), turn (orientationchange, screen.orientation), offline / online, the battery
// (navigator.getBattery), going to the background (visibilitychange) and the pixel ratio. The values the page reads
// (navigator.onLine, document.visibilityState, devicePixelRatio, screen.orientation.type…) follow the device for the
// code in the scope only (a CallScope; no scope: everything in that window).
//   const s = deviceSensors(window, { scope, dpr: () => 3 }); s.shake(); s.online.set(false); s.dispose()
import { signal, effect, untrack, createRoot, type Signal } from "../../../core/reactive.ts";
import { overrideGetter, type CallScope } from "../../../ui/call-scope.ts";

export interface Tilt { alpha: number; beta: number; gamma: number }
export interface Battery { level: number; charging: boolean }
export interface DeviceSensors {
  /** Online (false: navigator.onLine is false and "offline" fired). */
  online: Signal<boolean>;
  /** The battery (navigator.getBattery() answers with it; levelchange / chargingchange fire). */
  battery: Signal<Battery>;
  /** In the background (document.hidden; visibilitychange fires). */
  hidden: Signal<boolean>;
  /** How the device is held (deviceorientation fires on every change): degrees. */
  tilt: Signal<Tilt>;
  /** Shake it: devicemotion events for `ms` (default 900). */
  shake(ms?: number): void;
  /** Turned (portrait / landscape): orientationchange, screen.orientation's change, resize. */
  orient(landscape: boolean): void;
  /** Undo every override. */
  dispose(): void;
}
export interface SensorOptions {
  /** Whose calls see the device's values (default: every call in that window). */
  scope?: CallScope | null | undefined;
  /** The device's pixel ratio. */
  dpr?: () => number;
  /** Landscape now. */
  landscape?: () => boolean;
  /** Called with each event fired (its name and a short detail): a log, a ticker. */
  onEvent?: (name: string, detail?: string) => void;
  /** Signals to keep the state in (a page loaded again in a frame keeps the device's state). */
  state?: Partial<Pick<DeviceSensors, "online" | "battery" | "hidden" | "tilt">>;
}

/** Device events and values for the code shown in `win` (see the module comment). */
export function deviceSensors(win: Window & typeof globalThis, o: SensorOptions = {}): DeviceSensors {
  return createRoot((disposeRoot) => sensorsIn(win, o, disposeRoot));
}
function sensorsIn(win: Window & typeof globalThis, o: SensorOptions, disposeRoot: () => void): DeviceSensors {
  // the window's own constructors (a frame's), or this realm's where it has none (a test DOM)
  const W = win as unknown as { Event?: typeof Event; EventTarget?: typeof EventTarget };
  const Ev = W.Event ?? Event, ET = W.EventTarget ?? EventTarget;
  const online = o.state?.online ?? signal(true), battery = o.state?.battery ?? signal<Battery>({ level: 0.82, charging: false }), hidden = o.state?.hidden ?? signal(false);
  const tilt = o.state?.tilt ?? signal<Tilt>({ alpha: 0, beta: 0, gamma: 0 });
  const land = (): boolean => o.landscape?.() ?? false;
  const say = (n: string, d?: string): void => o.onEvent?.(n, d);
  const fire = (target: EventTarget | null | undefined, e: Event): void => { target?.dispatchEvent(e); };
  const scope = o.scope;
  // the battery manager the code gets
  const bm = new ET() as EventTarget & Record<string, unknown>;
  for (const [k, f] of [["level", () => battery().level], ["charging", () => battery().charging], ["chargingTime", () => (battery().charging ? Math.round((1 - battery().level) * 5400) : Infinity)], ["dischargingTime", () => (battery().charging ? Infinity : Math.round(battery().level * 36000))]] as const)
    Object.defineProperty(bm, k, { get: f, enumerable: true });
  const undo: (() => void)[] = [
    overrideGetter(win.navigator, "onLine", () => online(), scope),
    overrideGetter(win.navigator, "getBattery", () => () => Promise.resolve(bm), scope),
    overrideGetter(win.document, "visibilityState", () => (hidden() ? "hidden" : "visible"), scope),
    overrideGetter(win.document, "hidden", () => hidden(), scope),
    overrideGetter(win, "orientation", () => (land() ? 90 : 0), scope),
  ];
  if (o.dpr) undo.push(overrideGetter(win, "devicePixelRatio", o.dpr, scope));
  const so = win.screen?.orientation;
  if (so) undo.push(overrideGetter(so, "type", () => (land() ? "landscape-primary" : "portrait-primary"), scope), overrideGetter(so, "angle", () => (land() ? 90 : 0), scope));
  // a change fires its event (not the first value)
  const onChange = <T>(s: () => T, f: (v: T) => void): void => { let first = true; effect(() => { const v = s(); if (first) { first = false; return; } untrack(() => f(v)); }); };
  onChange(online, (v) => { fire(win, new Ev(v ? "online" : "offline")); say(v ? "online" : "offline"); });
  onChange(hidden, (v) => { fire(win.document, new Ev("visibilitychange")); fire(win, new Ev(v ? "pagehide" : "pageshow")); say("visibilitychange", v ? "hidden" : "visible"); });
  let lastB = untrack(battery);
  onChange(battery, (b) => {
    if (b.level !== lastB.level) { fire(bm, new Ev("levelchange")); say("levelchange", `${Math.round(b.level * 100)}%`); }
    if (b.charging !== lastB.charging) { fire(bm, new Ev("chargingchange")); say("chargingchange", b.charging ? "şarjda" : "pilde"); }
    lastB = b;
  });
  const orientationEvent = (t: Tilt): Event => {
    const C = (win as unknown as { DeviceOrientationEvent?: typeof DeviceOrientationEvent }).DeviceOrientationEvent;
    return C ? new C("deviceorientation", { ...t, absolute: false }) : Object.assign(new Ev("deviceorientation"), t, { absolute: false });
  };
  onChange(tilt, (t) => { fire(win, orientationEvent(t)); say("deviceorientation", `β ${Math.round(t.beta)}° γ ${Math.round(t.gamma)}°`); });

  let shaking: ReturnType<typeof setTimeout> | undefined;
  const motion = (x: number, y: number, z: number, i: number): Event => {
    const init = { acceleration: { x, y, z }, accelerationIncludingGravity: { x, y: y + 9.81, z }, rotationRate: { alpha: x * 8, beta: y * 8, gamma: z * 4 }, interval: i };
    const C = (win as unknown as { DeviceMotionEvent?: typeof DeviceMotionEvent }).DeviceMotionEvent;
    return C ? new C("devicemotion", init) : Object.assign(new Ev("devicemotion"), init);
  };
  return {
    online, battery, hidden, tilt,
    shake(ms = 900) {
      clearTimeout(shaking);
      const t0 = Date.now(), step = 16;
      say("devicemotion", "salla");
      const tick = (): void => {
        const t = (Date.now() - t0) / ms;
        if (t >= 1) { fire(win, motion(0, 0, 0, step)); return; }
        const a = 22 * Math.sin(t * Math.PI * 14) * (1 - t);
        fire(win, motion(a, a * 0.35, a * 0.15, step));
        shaking = setTimeout(tick, step);
      };
      tick();
    },
    orient(l) {
      fire(win, new Ev("orientationchange"));
      if (so) fire(so, new Ev("change"));
      fire(win, new Ev("resize"));
      say("orientationchange", l ? "yatay" : "dikey");
    },
    dispose() { clearTimeout(shaking); disposeRoot(); for (const u of undo.reverse()) u(); },
  };
}
