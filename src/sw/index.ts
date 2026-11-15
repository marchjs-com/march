// march/sw — opt-in offline cache. Turn on with `sw: true` in march.config.js (the build writes sw.js), then:
//   import { registerServiceWorker } from "march/sw"
//   registerServiceWorker({ onUpdate: () => toast("A new version is ready", { action: { label: "Reload", onClick: applyUpdate } }) })
// Chunks are cached the first time they arrive (cache-first; hashed names never change), the page is network-first
// with an offline fallback, old versions are deleted when a new one activates. CSP: needs only worker-src/script-src 'self'.
import { signal } from "../core/reactive.ts";

export interface ServiceWorkerOptions {
  /** URL of the worker, relative to the page (default "sw.js" next to index.html). */
  url?: string;
  /** Called when a new version is installed and waiting; call applyUpdate() to switch. */
  onUpdate?: (reg: ServiceWorkerRegistration) => void;
  /** Called once the worker controls the page (first visit: after activation). */
  onReady?: (reg: ServiceWorkerRegistration) => void;
}

/** "unsupported" | "installing" | "ready" | "update" (a new version waits) | "blocked" (CSP Trusted Types) | "error". */
export const swState = signal<"off" | "unsupported" | "installing" | "ready" | "update" | "blocked" | "error">("off");
let current: ServiceWorkerRegistration | null = null;

/** Register the worker (no-op where unsupported, e.g. file:// or old browsers). Resolves the registration or null. */
export async function registerServiceWorker(o: ServiceWorkerOptions = {}): Promise<ServiceWorkerRegistration | null> {
  const nav = globalThis.navigator;
  if (!nav?.serviceWorker || !/^https?:$/.test(globalThis.location?.protocol ?? "")) { swState.set("unsupported"); return null; }
  try {
    swState.set("installing");
    const reg = await nav.serviceWorker.register(scriptUrl(o.url ?? "sw.js") as string);
    current = reg;
    const waiting = (): void => { swState.set("update"); o.onUpdate?.(reg); };
    if (reg.waiting && nav.serviceWorker.controller) waiting();
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed" && nav.serviceWorker.controller) waiting(); });
    });
    void nav.serviceWorker.ready.then((r) => { if (swState.peek() !== "update") swState.set("ready"); o.onReady?.(r); });
    let reloaded = false;
    nav.serviceWorker.addEventListener("controllerchange", () => { if (reloading && !reloaded) { reloaded = true; globalThis.location.reload(); } });
    return reg;
  } catch (e) {
    // a strict CSP with Trusted Types and no "march-sw" policy allowed blocks register(): report it, do not throw
    swState.set(e instanceof TypeError && /trusted|policy/i.test(String((e as Error).message)) ? "blocked" : "error");
    return null;
  }
}

/**
 * register() is a Trusted Types sink. Under `require-trusted-types-for 'script'` the URL must come from a policy:
 * March creates "march-sw" (same-origin .js URLs only) — the CSP must list it: `trusted-types march-sw`.
 */
let policy: { createScriptURL(u: string): unknown } | null = null;
function scriptUrl(url: string): unknown {
  const tt = (globalThis as typeof globalThis & { trustedTypes?: { createPolicy(n: string, r: { createScriptURL(u: string): string }): { createScriptURL(u: string): unknown } } }).trustedTypes;
  if (!tt) return url;
  policy ??= tt.createPolicy("march-sw", {
    createScriptURL: (u: string) => {
      const abs = new URL(u, globalThis.location.href);
      if (abs.origin !== globalThis.location.origin || !abs.pathname.endsWith(".js")) throw new TypeError("march-sw: same-origin .js only");
      return abs.href;
    },
  });
  return policy.createScriptURL(url);
}

let reloading = false;
/** Activate the waiting version and reload the page once it takes over. */
export function applyUpdate(): void {
  const w = current?.waiting;
  if (!w) return;
  reloading = true;
  w.postMessage("march:skip-waiting");
}

/** Remove the worker and its caches (settings › "clear offline data"). */
export async function unregisterServiceWorker(): Promise<void> {
  await current?.unregister();
  current = null;
  const c = globalThis.caches;
  if (c) for (const k of await c.keys()) if (k.startsWith("march-")) await c.delete(k);
  swState.set("off");
}
