// Frame monitor: fps, dropped frames and long tasks (PerformanceObserver "longtask"), measured on the shared clock.
// For dev panels and performance tests: `const m = frameMonitor(); … m.drops(); m.stop()`.
import { signal } from "../../core/reactive.ts";
import { onFrame } from "./clock.ts";

export interface FrameMonitor {
  /** Frames per second over the last half second (reactive). */
  fps(): number;
  /** Frames dropped since start/reset: a frame that took longer than 1.5 × the expected interval counts its missing frames. */
  drops(): number;
  /** Long tasks (> 50 ms) since start/reset and the longest one in ms (reactive). */
  longTasks(): number;
  longest(): number;
  /** Frames seen since start/reset. */
  frames(): number;
  reset(): void;
  stop(): void;
}

export function frameMonitor({ interval = 1000 / 60 }: { interval?: number } = {}): FrameMonitor {
  const fps = signal(0), drops = signal(0), longTasks = signal(0), longest = signal(0);
  let frames = 0, windowStart = -1, windowFrames = 0, last = -1, dropped = 0;
  const perf = (): number => globalThis.performance?.now?.() ?? Date.now();
  const off = onFrame(() => {
    const t = perf();
    if (last >= 0) {
      const d = t - last;
      if (d > interval * 1.5 && d < 1000) dropped += Math.round(d / interval) - 1;
    }
    last = t; frames++; windowFrames++;
    if (windowStart < 0) windowStart = t;
    if (t - windowStart >= 500) {
      fps.set(Math.round((windowFrames * 1000) / (t - windowStart)));
      drops.set(dropped);
      windowStart = t; windowFrames = 0;
    }
  }, { phase: "read", essential: true });
  let po: PerformanceObserver | null = null;
  try {
    if (typeof PerformanceObserver === "function" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) { longTasks.set(longTasks.peek() + 1); if (e.duration > longest.peek()) longest.set(Math.round(e.duration)); }
      });
      po.observe({ type: "longtask", buffered: false });
    }
  } catch { po = null; }
  return {
    fps: () => fps(), drops: () => { drops(); return dropped; }, longTasks: () => longTasks(), longest: () => longest(), frames: () => frames,
    reset() { dropped = 0; frames = 0; last = -1; drops.set(0); longTasks.set(0); longest.set(0); },
    stop() { off(); po?.disconnect(); },
  };
}
