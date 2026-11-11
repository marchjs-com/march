// Access control helpers. The app tells March who is signed in; UI asks `can("perm")`.
// The server is always the real authority — these helpers only decide what to SHOW (unauthorized buttons disappear).
//
//   setAccess({ user: { id, name }, roles: ["admin"], perms: ["users.edit"], methods: ["password"] })
//   can("users.edit")   hasRole("admin")   role()   <Can perm="users.edit" fallback={…}>…</Can>
//   <Gate method="phone" fallback={(why) => <p>Sign in with phone</p>}>…</Gate>   (sign-in method gate)
import { signal } from "../core/reactive.ts";

/** Augment to type permission, role and method names:
 *  `declare module "hadi-march/data" { interface AccessRegister { perms: "users.edit" | "users.view"; roles: "admin" } }` */
export interface AccessRegister {}
type Reg<K extends string> = AccessRegister extends Record<K, infer V extends string> ? V : string;
/** Permission name (`string` unless narrowed through `AccessRegister`). "*" grants all. */
export type Perm = Reg<"perms"> | "*";
export type RoleName = Reg<"roles">;
export type Method = Reg<"methods">;

export interface AccessUser { id?: unknown; name?: unknown; [key: string]: unknown }
export interface AccessState {
  readonly user: AccessUser | null;
  readonly roles: readonly string[];
  readonly perms: readonly string[];
  readonly methods: readonly string[];
  readonly meta: Readonly<Record<string, unknown>>;
}
export interface AccessInput {
  user?: AccessUser | null;
  roles?: Iterable<RoleName> | null;
  perms?: Iterable<Perm> | null;
  methods?: Iterable<Method> | null;
  meta?: Record<string, unknown>;
}
/** A permission requirement: one name, any of several, or a predicate over the access state. */
export type PermCheck = Perm | readonly Perm[] | ((access: AccessState) => unknown) | null | undefined | "";
export type Denial = "auth" | "method" | "role" | "perm";
export interface Requirement {
  perm?: PermCheck;
  role?: RoleName | readonly RoleName[] | null | undefined;
  method?: Method | readonly Method[] | null | undefined;
  auth?: boolean | null | undefined;
}

const EMPTY: AccessState = Object.freeze({ user: null, roles: [], perms: [], methods: [], meta: {} });
const state = signal<AccessState>(EMPTY, { name: "access" });

/** Replace the access state (call after sign-in / sign-out / token refresh). */
export function setAccess(v: AccessInput | null | undefined): void {
  state.set(v ? Object.freeze({ ...EMPTY, ...v, roles: [...(v.roles ?? [])], perms: [...(v.perms ?? [])], methods: [...(v.methods ?? [])] }) : EMPTY);
}
/** Reactive access object. */
export const access = (): AccessState => state();
export const signedIn = (): boolean => !!state().user;
/** First (primary) role or null. */
export const role = (): string | null => state().roles[0] ?? null;
export const hasRole = (r: RoleName | readonly RoleName[]): boolean => ([] as string[]).concat(r).some((x) => state().roles.includes(x));
export const hasMethod = (m: Method | readonly Method[]): boolean => ([] as string[]).concat(m).some((x) => state().methods.includes(x));

/**
 * Permission check (reactive). `perm`: string, array (any of), or predicate `(access) => boolean`. "*" grants all.
 * Empty/undefined perm → true.
 */
export function can(perm?: PermCheck): boolean {
  if (perm == null || perm === "" || (Array.isArray(perm) && !perm.length)) return true;
  const a = state();
  if (typeof perm === "function") return !!perm(a);
  return a.perms.includes("*") || ([] as string[]).concat(perm).some((p) => a.perms.includes(p));
}

/** Why a requirement fails: null (allowed) | "auth" | "method" | "role" | "perm". */
export function denied(req: Requirement = {}): Denial | null {
  const a = state();
  if (req.auth !== false && (req.method || req.role || req.perm || req.auth) && !a.user) return "auth";
  if (req.method && !hasMethod(req.method)) return "method";
  if (req.role && !hasRole(req.role)) return "role";
  if (req.perm && !can(req.perm)) return "perm";
  return null;
}

const val = (v: unknown): unknown => (typeof v === "function" && !v.length ? (v as () => unknown)() : v);
export interface CanProps { perm?: PermCheck; role?: Requirement["role"]; method?: Requirement["method"]; fallback?: unknown; children?: unknown }
/** Render children only when allowed. Props: perm, role, method, fallback. */
export function Can(props: CanProps): () => unknown {
  return () => (denied({ perm: props.perm, role: props.role, method: props.method }) ? val(props.fallback) ?? null : props.children);
}
export interface GateProps extends CanProps {
  auth?: boolean;
  /** Content, or `(reason, requirement) => content`. */
  fallback?: unknown;
}
/**
 * Like <Can>, but meant for whole screens: `fallback(reason, requirement)` explains what is missing
 * (e.g. "this screen needs phone sign-in"). Props: perm, role, method, auth.
 */
export function Gate(props: GateProps): () => unknown {
  return () => {
    const req: Requirement = { perm: props.perm, role: props.role, method: props.method, auth: props.auth };
    const why = denied(req);
    if (!why) return props.children;
    return typeof props.fallback === "function" ? (props.fallback as (why: Denial, req: Requirement) => unknown)(why, req) : props.fallback ?? null;
  };
}
