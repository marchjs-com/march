// JSX types for March (.tsx). Component props are checked against the component's parameter type; `$` variables
// are ordinary TypeScript variables to the checker (`let $n = 0` is a number), so their types flow naturally.
// The TypeScript-compatible subset of March JSX: on:/class:/use:/bind:/transition: namespaced attributes (TS 5.1+).
// Not valid TSX syntax (use the alternatives): `on:click|prevent` → `on:click={prevent(fn)}`; `{x | date}` →
// `{applyPipe("date", x)}`; `<Row {user} />` → `<Row user={user} />`. `march check` type-checks the full syntax.
import type { ExtensionProps, ComponentExtensions } from "../src/dom/extend.ts";
export {};

type UiExports = typeof import("../src/ui/index.ts");
type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
/** The props ComponentExtensions adds to the March component C (keyed by its export name). */
type ComponentExtra<C> = UnionToIntersection<{ [K in keyof ComponentExtensions]: K extends keyof UiExports ? (C extends UiExports[K] ? ComponentExtensions[K] : unknown) : unknown }[keyof ComponentExtensions]>;

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
  /** Common prop: the colour token of the element and everything in it ("brand-blue", "success", "cat-3"…). */
  "m:color"?: Reactive<string | null | undefined>;
  /** Common prop: the subtree drawn in another colour theme ("night"…; its stylesheet loads on first use). */
  "m:theme"?: Reactive<string | null | undefined>;
  /** Common prop: writing direction of the subtree. */
  "m:dir"?: Reactive<"ltr" | "rtl" | "auto" | null | undefined>;
  /** Common prop: language of the subtree ("tr", "ar"…). */
  "m:lang"?: Reactive<string | null | undefined>;
  /** Common prop: a hint on hover and keyboard focus (no wrapper element). */
  "m:tip"?: Reactive<string | null | undefined>;
  /** Common prop: fades and rises in once in view (true), after a delay (ms) or as described. */
  "m:reveal"?: boolean | number | { delay?: number; duration?: number; frames?: Keyframe[] };
  /** Common prop: false hides it; `{ allow: false, else: "disable" }` shows it disabled. */
  "m:can"?: Reactive<boolean | null | undefined | { allow: boolean | null | undefined; else?: "hide" | "disable" }>;
  /** Common prop: a stable handle for tests (data-testid). */
  "m:test"?: Reactive<string | null | undefined>;
  /** Common prop: props for the components drawn inside, by component: `m:parts={{ Avatar: { size: "lg" } }}`. */
  "m:parts"?: unknown;
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
    // props extensions add (ExtensionProps: every component; ComponentExtensions: one March component, by name)
    interface IntrinsicAttributes extends ExtensionProps {
      key?: unknown;
      /** This instance takes no extension (false) or only the named ones. */
      "m:extend"?: false | readonly string[];
      [key: `bind:${string}`]: unknown;
      [key: `use:${string}`]: unknown;
      [key: `transition:${string}`]: unknown;
      /** Common prop: the element and everything inside it cannot be selected (`={false}`: selectable again inside a blocked subtree). */
      "m:no-select"?: Reactive<boolean | null | undefined>;
      /** Common prop: the colour token of the element and everything in it ("brand-blue", "success", "cat-3"…). */
      "m:color"?: Reactive<string | null | undefined>;
      /** Common prop: the subtree drawn in another colour theme ("night"…; its stylesheet loads on first use). */
      "m:theme"?: Reactive<string | null | undefined>;
      /** Common prop: writing direction of the subtree. */
      "m:dir"?: Reactive<"ltr" | "rtl" | "auto" | null | undefined>;
      /** Common prop: language of the subtree ("tr", "ar"…). */
      "m:lang"?: Reactive<string | null | undefined>;
      /** Common prop: a hint on hover and keyboard focus (no wrapper element). */
      "m:tip"?: Reactive<string | null | undefined>;
      /** Common prop: fades and rises in once in view (true), after a delay (ms) or as described. */
      "m:reveal"?: boolean | number | { delay?: number; duration?: number; frames?: Keyframe[] };
      /** Common prop: false hides it; `{ allow: false, else: "disable" }` shows it disabled. */
      "m:can"?: Reactive<boolean | null | undefined | { allow: boolean | null | undefined; else?: "hide" | "disable" }>;
      /** Common prop: a stable handle for tests (data-testid). */
      "m:test"?: Reactive<string | null | undefined>;
      /** Common prop: props for the components drawn inside, by component: `m:parts={{ Avatar: { size: "lg" } }}`. */
      "m:parts"?: unknown;
      /** Common props (work on every element and component; add one with registerMProp). */
      [key: `m:${string}`]: unknown;
    }
    type LibraryManagedAttributes<C, P> = [keyof ComponentExtensions] extends [never] ? P : P & ComponentExtra<C>;
    type IntrinsicElements = { [K in keyof HTMLElementTagNameMap]: MarchDomAttributes } & { [K in keyof SVGElementTagNameMap]: MarchDomAttributes };
  }
}
