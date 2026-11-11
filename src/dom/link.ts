// Late binding of the router's <Link>: components that may render a link (Button href) use it when the router is part of
// the app and fall back to a plain <a> otherwise, so a Button alone does not pull the router into the bundle.
type LinkComponent = (props: Record<string, unknown>) => unknown;
let impl: LinkComponent | null = null;
/** Called by hadi-march/router when it is loaded. */
export function provideLink(c: LinkComponent): void { impl = c; }
/** The router's Link, or null when the app has no router. */
export const routerLink = (): LinkComponent | null => impl;
