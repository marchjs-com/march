// march/router — the router (router.ts) and the helpers pages call (extras.ts). This file only re-exports: March's
// build imports each name straight from its module, so an app's start-up chunk carries only what start-up uses.
export * from "./router.ts";
export { queryParam, route, navigating, navigationSignal, beforeLeave, outletRoute, transitionOutlet, onRouteChange, prefetchLinks } from "./extras.ts";
