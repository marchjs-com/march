// Late binding of the router's <Link>: components that may render a link (Button href) use it when the router is part of
// the app and fall back to a plain <a> otherwise, so a Button alone does not pull the router into the bundle.
type LinkComponent = (props: Record<string, unknown>) => unknown;
let impl: LinkComponent | null = null;
/** Called by march/router when it is loaded. */
export function provideLink(c: LinkComponent): void { impl = c; }
/** The router's Link, or null when the app has no router. */
export const routerLink = (): LinkComponent | null => impl;

// The same late binding for the URL query (Tabs `query`): with no router in the app, a component keeps its state locally.
type QueryApi = { query(): Record<string, string | string[]>; setQuery(values: Record<string, unknown>): Promise<void> };
let queryImpl: QueryApi | null = null;
/** Called by march/router when it is loaded. */
export function provideQuery(api: QueryApi): void { queryImpl = api; }
/** The router's query and setQuery, or null when the app has no router. */
export const routerQuery = (): QueryApi | null => queryImpl;
