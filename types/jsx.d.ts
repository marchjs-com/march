// JSX types for March (.tsx). Component props are checked against the component's parameter type; `$` variables
// are ordinary TypeScript variables to the checker (`let $n = 0` is a number), so their types flow naturally.
// The TypeScript-compatible subset of March JSX: on:/class:/use:/bind:/transition: namespaced attributes (TS 5.1+).
// Not valid TSX syntax (use the alternatives): `on:click|prevent` → `on:click={prevent(fn)}`; `{x | date}` →
// `{applyPipe("date", x)}`; `<Row {user} />` → `<Row user={user} />`. `march check` type-checks the full syntax.
export {};

type Reactive<T> = T | (() => T);
type ClassValue = string | false | null | undefined | readonly ClassValue[] | Record<string, unknown>;

interface MarchDomAttributes {
  class?: Reactive<ClassValue>;
  className?: Reactive<ClassValue>;
  sx?: Record<string, unknown> | string;
  style?: Reactive<Record<string, string | number | null | undefined>>;
  ref?: ((el: Element) => void) | { set(el: Element): unknown };
  children?: unknown;
  id?: Reactive<string>;
  title?: Reactive<string>;
  hidden?: Reactive<boolean>;
  role?: string;
  tabindex?: Reactive<string | number>;
  [key: `on:${string}`]: ((e: Event & { currentTarget: Element }) => unknown) | undefined;
  [key: `on${Capitalize<string>}`]: unknown;
  [key: `class:${string}`]: unknown;
  [key: `use:${string}`]: unknown;
  [key: `bind:${string}`]: unknown;
  [key: `transition:${string}`]: unknown;
  /** ViewportManager flag: shown while it holds (`={false}`: while it does not). */
  [key: `when:${string}`]: Reactive<boolean> | undefined;
  /** ConsentManager category: shown while granted (`={false}`: while refused). */
  [key: `consent:${string}`]: Reactive<boolean> | undefined;
  /** CommandManager id: click runs it; disabled / hidden / aria-busy follow it. Value: true or the arguments. */
  [key: `command:${string}`]: unknown;
  /** Common prop: the element and everything inside it cannot be selected (`={false}`: selectable again inside a blocked subtree). */
  "m:no-select"?: Reactive<boolean | null | undefined>;
  /** Common props (work on every element and component; add one with registerMProp). */
  [key: `m:${string}`]: unknown;
  [key: `data-${string}`]: unknown;
  [key: `aria-${string}`]: unknown;
  [attr: string]: unknown;
}

declare global {
  namespace JSX {
    type Element = unknown;
    interface ElementChildrenAttribute { children: unknown }
    // directives are accepted on components too (bind:x gives the component x + setX; use:/class:/on: as on elements)
    interface IntrinsicAttributes {
      key?: unknown;
      [key: `bind:${string}`]: unknown;
      [key: `use:${string}`]: unknown;
      [key: `transition:${string}`]: unknown;
      /** Common prop: the component's root and everything inside it cannot be selected. */
      "m:no-select"?: Reactive<boolean | null | undefined>;
      /** Common props (work on every element and component; add one with registerMProp). */
      [key: `m:${string}`]: unknown;
    }
    type IntrinsicElements = { [K in keyof HTMLElementTagNameMap]: MarchDomAttributes } & { [K in keyof SVGElementTagNameMap]: MarchDomAttributes };
  }
}
