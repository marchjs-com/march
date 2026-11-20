// memoryHistory(): an address of the router's own, for a router that is not the page's — a preview (MarchIDE uses it),
// a test, a widget inside another app. The page's address, title, scroll and back button stay untouched; links and
// navigate() work as usual and back() walks this list.
//   createRouter({ routes, history: memoryHistory("/start") })
// Its own module: an app that never uses it does not carry it.

/** The address a memory router keeps: the page's location and history as far as the router uses them. */
export interface MemoryHistory {
  readonly location: { pathname: string; search: string; hash: string; href: string };
  readonly state: unknown;
  pushState(state: unknown, unused: string, url?: string): void;
  replaceState(state: unknown, unused: string, url?: string): void;
  back(): void;
  /** @internal Set by the router: called after back(), as popstate is. */
  onPop?: (() => void) | undefined;
}

/** An address list of its own, starting at `start` (default "/"). */
export function memoryHistory(start = "/"): MemoryHistory {
  // the router writes a route here as "#/path" (as in hash mode: nothing of the page's address is involved)
  const list: { url: string; state: unknown }[] = [{ url: `#${start}`, state: null }];
  let at = 0;
  const put = (replace: boolean, state: unknown, url?: string): void => {
    const e = { url: url || list[at]!.url, state };
    if (replace) list[at] = e; else { list.splice(++at, Infinity, e); }
  };
  const h: MemoryHistory = {
    get location() { const u = new URL(list[at]!.url, "http://memory"); return { pathname: u.pathname, search: u.search, hash: u.hash, href: u.href }; },
    get state() { return list[at]!.state; },
    pushState: (state, _, url) => put(false, state, url),
    replaceState: (state, _, url) => put(true, state, url),
    // as the browser's back: the previous entry, then the router shows it (popstate)
    back: () => { if (at > 0) { at--; queueMicrotask(() => h.onPop?.()); } },
  };
  return h;
}
