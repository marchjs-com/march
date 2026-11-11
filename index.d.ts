// Type definitions for HADI March (editor completion). Runtime is plain JavaScript.
declare module "hadi-march" {
  export interface Signal<T> {
    (): T;
    set(v: T): T;
    update(fn: (v: T) => T): T;
    peek(): T;
    readonly signal: true;
  }
  export interface Accessor<T> { (): T; peek(): T }
  export type MaybeAccessor<T> = T | (() => T);
  export type Child = Node | string | number | boolean | null | undefined | Child[] | (() => Child);
  export type Component<P = {}> = (props: P & { children?: any }) => Child | Promise<Child>;

  export function signal<T>(value: T, opts?: { equals?: false | ((a: T, b: T) => boolean); name?: string }): Signal<T>;
  export function computed<T>(fn: (prev?: T) => T, opts?: { equals?: false | ((a: T, b: T) => boolean) }): Accessor<T>;
  export function effect(fn: () => void): () => void;
  export function batch<T>(fn: () => T): T;
  export function untrack<T>(fn: () => T): T;
  export function onCleanup(fn: () => void): () => void;
  export function createRoot<T>(fn: (dispose: () => void) => T): T;
  export function getOwner(): unknown;
  export function runWithOwner<T>(owner: unknown, fn: () => T): T;
  export function catchError<T>(fn: () => T, handler: (e: unknown) => void): T | undefined;
  export interface Context<T> { id: symbol; defaultValue: T; Provider: Component<{ value: T }> }
  export function context<T>(defaultValue?: T): Context<T>;
  export function provide<T>(ctx: Context<T>, value: T): void;
  export function useContext<T>(ctx: Context<T>): T;
  export function reactive<T extends Function>(fn: T): T;
  export function isReactive(v: unknown): boolean;
  export function read<T>(v: MaybeAccessor<T>): T;

  export function store<T extends object>(initial: T): T;
  export function patch<T extends object>(target: T, partial: Partial<T> | Record<string, any>): T;
  export function unwrap<T>(s: T): T;

  export function h(type: string | Component<any>, props?: Record<string, any> | null, ...children: Child[]): any;
  export const Fragment: Component;
  export function insert(parent: Node, value: Child, before?: Node | null): void;
  export function render(fn: () => Child, container: Element): () => void;
  export function safeUrl(url: string, tag?: string): string;

  export const If: Component<{ when: any; else?: () => Child; fallback?: () => Child }>;
  export const Else: Component;
  export const For: Component<{ each: MaybeAccessor<readonly any[]>; key?: string | ((item: any) => any); fallback?: Child }>;
  export const Switch: Component<{ fallback?: Child }>;
  export const Match: Component<{ when: any }>;
  export const Try: Component<{ fallback?: Child | ((error: any, reset: () => void) => Child); loading?: Child | (() => Child); log?: boolean }>;
  export const Await: Component<{ for: MaybeAccessor<Promise<any> | any>; loading?: Child; catch?: (e: any) => Child }>;
  export const Portal: Component<{ mount?: Element }>;
  export const Dynamic: Component<{ component: MaybeAccessor<string | Component<any>>; [k: string]: any }>;
  export function define(tag: string, comp: Component<any>, opts?: { props?: string[]; shadow?: boolean }): CustomElementConstructor;

  export function pipe(name: string, fn: (value: any, ...args: any[]) => any): void;
  export function applyPipe(name: string, value: any, ...args: any[]): any;
  export function toDate(v: unknown): Date | null;
  export function t(strings: TemplateStringsArray | string, ...values: any[]): string;
  export const locale: Signal<string>;
  export function setLocale(loc: string): void;
  export function setFallbackLocale(loc: string): void;
  export function messages(loc: string, dict: Record<string, string>): void;
  export function missing(): Record<string, string[]>;
  export function sx(obj: Record<string, any>): string;
  export const DEV: { enabled: boolean; warn: (...a: any[]) => void };
  export const version: string;
}

declare module "hadi-march/router" {
  import type { Component, Accessor } from "hadi-march";
  export interface RouteMatch { route: any; params: Record<string, string>; path: string; meta: Record<string, any> }
  export function createRouter(opts: { routes: Record<string, (() => Promise<any>) | { component?: Component<any>; load?: () => Promise<any>; meta?: any; title?: string }> | any[]; mode?: "history" | "hash"; base?: string; guard?: (to: any) => boolean | string | Promise<boolean | string>; notFound?: any; scroll?: boolean; title?: (to: any) => string | null }): { navigate: typeof navigate; dispose(): void };
  export function navigate(to: string, opts?: { replace?: boolean; state?: any }): Promise<void>;
  export function back(): void;
  export function path(): string;
  export function params(): Record<string, string>;
  export const query: Accessor<Record<string, string | string[]>>;
  export function setQuery(values: Record<string, any>, opts?: { replace?: boolean }): Promise<void>;
  export function route(): RouteMatch | null;
  export function navigating(): boolean;
  export function onRouteChange(fn: (m: RouteMatch | null) => void): void;
  export const Router: Component<{ loading?: any; fallback?: any; notFound?: any; forbidden?: any }>;
  export const Link: Component<{ href: string; exact?: boolean; replace?: boolean; [k: string]: any }>;
}

declare module "hadi-march/data" {
  import type { Component } from "hadi-march";
  export interface Query<T> { (): T | undefined; loading(): boolean; error(): any; refreshing(): boolean; refetch(): Promise<void>; mutate(v: T | ((prev: T | undefined) => T)): void; state(): "loading" | "error" | "ready" }
  export function query<T>(fn: ((ctx: { signal: AbortSignal }) => Promise<T>) | string, opts?: { key?: any; initial?: T; retry?: number; staleTime?: number; refetchOnFocus?: boolean; poll?: number; keep?: boolean; enabled?: () => boolean; onError?: (e: any) => void }): Query<T>;
  export function resource<T>(fn: (ctx: { signal: AbortSignal }) => Promise<T>, opts?: object): Query<T>;
  export interface Mutation<V, R> { (vars: V): Promise<R>; pending(): boolean; error(): any; result(): R | undefined }
  export function mutation<V = any, R = any>(fn: (vars: V) => Promise<R>, opts?: { invalidates?: any[]; optimistic?: (vars: V) => void | (() => void); onSuccess?: (r: R, v: V) => any; onError?: (e: any, v: V) => any }): Mutation<V, R>;
  export function invalidate(prefix: any): void;
  export function configure(o: { retry?: number; retryDelay?: number; staleTime?: number; refetchOnFocus?: boolean; isRetryable?: (e: any) => boolean; onError?: (e: any) => void }): void;
  export function fetchJson(url: string, opts?: { method?: string; body?: any; headers?: Record<string, string>; signal?: AbortSignal }): Promise<any>;
  export function clearCache(): void;
  export interface AccessState { user: any; roles: string[]; perms: string[]; methods: string[]; meta: any }
  export function setAccess(v: Partial<AccessState> | null): void;
  export function access(): AccessState;
  export function can(perm?: string | string[] | ((a: AccessState) => boolean)): boolean;
  export function role(): string | null;
  export function hasRole(r: string | string[]): boolean;
  export function hasMethod(m: string | string[]): boolean;
  export function signedIn(): boolean;
  export function denied(req?: { perm?: any; role?: any; method?: any; auth?: boolean }): null | "auth" | "method" | "role" | "perm";
  export const Can: Component<{ perm?: any; role?: any; method?: any; fallback?: any }>;
  export const Gate: Component<{ perm?: any; role?: any; method?: any; auth?: boolean; fallback?: any }>;
}

declare module "hadi-march/schema" {
  export type FieldType = "text" | "textarea" | "password" | "email" | "url" | "phone" | "number" | "int" | "money" | "percent" | "bool" | "date" | "datetime" | "time" | "pick" | "multi" | "list" | "json" | "color" | "file" | "hidden";
  export interface FieldSpec { type?: FieldType | string; label?: string; required?: boolean; min?: number; max?: number; minLength?: number; maxLength?: number; pattern?: RegExp; options?: any[] | (() => any[]); default?: any; help?: string; placeholder?: string; readonly?: boolean; hidden?: boolean; column?: false | object; format?: any; currency?: string; validate?: (v: any, values: any) => string | null; when?: (values: any) => boolean; [k: string]: any }
  export interface Schema { fields: (FieldSpec & { name: string; label: string; type: string })[]; field(name: string): any; names(): string[]; defaults(): Record<string, any>; parse(values: object): Record<string, any>; validateField(name: string, value: any, values?: object): string | null; validate(values: object): { ok: boolean; errors: Record<string, string>; values: Record<string, any> }; columns(over?: object): any[]; pick(...n: string[]): Schema; omit(...n: string[]): Schema; extend(more: Record<string, FieldSpec | FieldType>): Schema; isActive(name: string, values: object): boolean }
  export function schema(spec: Record<string, FieldSpec | FieldType>, opts?: { validate?: (values: any) => Record<string, string> | null }): Schema;
  export function fieldType(name: string, def: { coerce?: (v: any) => any; check?: (v: any, f: any) => string | null; empty?: any }): void;
  export function options(f: FieldSpec): { value: any; label: string; hint?: string }[];
}

declare module "hadi-march/testing" {
  export function installDom(opts?: { url?: string }): { document: Document; window: Window; cleanup(): void };
  export function serialize(n: Node): string;
  export function mockFetch(routes: Record<string, any>): { calls: any[]; restore(): void };
  export interface Screen { container: Element; flush(n?: number): Promise<void>; wait(pred: (() => boolean) | number, o?: { timeout?: number }): Promise<void>; text(): string; sees(text: string): boolean; find(text: string): Element | null; get(sel: string): Element | null; all(sel: string): Element[]; click(t: string | Element): Promise<Element>; type(t: string | Element, v: any): Promise<Element>; press(key: string, target?: Element): Promise<void>; submit(sel?: string): Promise<void>; confirm(): Promise<void>; cancel(): Promise<void>; fetchCalls(): any[]; dispose(): void }
  export function renderTest(fn: () => any, opts?: { mock?: Record<string, any>; container?: Element }): Screen;
}

declare module "hadi-march/ui" { const x: any; export = x; }
declare module "hadi-march/table" { const x: any; export = x; }
declare module "hadi-march/charts" { const x: any; export = x; }
declare module "hadi-march/esbuild" { export function march(opts?: { components?: string | string[]; i18nOut?: string; dev?: boolean; filter?: RegExp; onKeys?: (keys: string[]) => void }): any; }
