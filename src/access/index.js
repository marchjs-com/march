// Access control helpers. The app tells March who is signed in; UI asks `can("perm")`.
// The server is always the real authority — these helpers only decide what to SHOW (unauthorized buttons disappear).
//
//   setAccess({ user: { id, name }, roles: ["admin"], perms: ["users.edit"], methods: ["password"] })
//   can("users.edit")   hasRole("admin")   role()   <Can perm="users.edit" fallback={…}>…</Can>
//   <Gate method="phone" fallback={(why) => <p>Sign in with phone</p>}>…</Gate>   (sign-in method gate)
import { signal } from "../core/reactive.ts";

const EMPTY = Object.freeze({ user: null, roles: [], perms: [], methods: [], meta: {} });
const state = signal(EMPTY, { name: "access" });

/** Replace the access state (call after sign-in / sign-out / token refresh). */
export function setAccess(v) {
  state.set(v ? Object.freeze({ ...EMPTY, ...v, roles: [...(v.roles ?? [])], perms: [...(v.perms ?? [])], methods: [...(v.methods ?? [])] }) : EMPTY);
}
/** Reactive access object. */
export const access = () => state();
export const signedIn = () => !!state().user;
/** First (primary) role or null. */
export const role = () => state().roles[0] ?? null;
export const hasRole = (r) => [].concat(r).some((x) => state().roles.includes(x));
export const hasMethod = (m) => [].concat(m).some((x) => state().methods.includes(x));

/**
 * Permission check (reactive). `perm`: string, array (any of), or predicate `(access) => boolean`. "*" grants all.
 * Empty/undefined perm → true.
 */
export function can(perm) {
  if (perm == null || perm === "" || (Array.isArray(perm) && !perm.length)) return true;
  const a = state();
  if (typeof perm === "function") return !!perm(a);
  return a.perms.includes("*") || [].concat(perm).some((p) => a.perms.includes(p));
}

/** Why a requirement fails: null (allowed) | "auth" | "method" | "role" | "perm". */
export function denied(req = {}) {
  const a = state();
  if (req.auth !== false && (req.method || req.role || req.perm || req.auth) && !a.user) return "auth";
  if (req.method && !hasMethod(req.method)) return "method";
  if (req.role && !hasRole(req.role)) return "role";
  if (req.perm && !can(req.perm)) return "perm";
  return null;
}

const val = (v) => (typeof v === "function" && !v.length ? v() : v);
/** Render children only when allowed. Props: perm, role, method, fallback. */
export function Can(props) {
  return () => (denied({ perm: props.perm, role: props.role, method: props.method }) ? val(props.fallback) ?? null : props.children);
}
/**
 * Like <Can>, but meant for whole screens: `fallback(reason, requirement)` explains what is missing
 * (e.g. "this screen needs phone sign-in"). Props: perm, role, method, auth.
 */
export function Gate(props) {
  return () => {
    const req = { perm: props.perm, role: props.role, method: props.method, auth: props.auth };
    const why = denied(req);
    if (!why) return props.children;
    return typeof props.fallback === "function" ? props.fallback(why, req) : props.fallback ?? null;
  };
}
