// march/vault — secrets (API keys, tokens, notes) kept encrypted with the user's passphrase. The passphrase is asked
// once per browser session; the keys made from it live only in memory (never written, not readable as bytes) and are
// gone when the browser closes, the vault locks, or the user is away for a while. On disk (IndexedDB) everything is
// ciphertext: the values and their names.
//
//   import { createVault } from "march/vault";
//   const vault = createVault();                     // "march" vault; vault.state(): "loading" | "new" | "locked" | "unlocked"
//   await vault.create("a long passphrase");         // the first time
//   await vault.unlock("a long passphrase");         // later: true / false (wrong; tries are slowed down)
//   await vault.set("ai:anthropic", { key: "sk-ant-…" });
//   const k = await vault.get("ai:anthropic");
//   const live = vault.value("ai:anthropic");        // a component reads live(): undefined while locked
//
// The crypto (WebCrypto only): PBKDF2-SHA-256 (600 000 rounds, a random salt) turns the passphrase into a wrapping key;
// it wraps (AES-KW-like AES-GCM) a random AES-GCM-256 data key and an HMAC-SHA-256 name key. Each record is AES-GCM with
// a fresh 96-bit IV and its id as additional data (a record cannot be moved under another name); its id is the HMAC of
// its name (the names are not on disk). Keys are imported non-extractable. Wrong passphrases are counted on disk and
// slowed down (2^n seconds after the third, up to 5 minutes).
import { signal, onCleanup, getOwner, reactive, type Accessor } from "../core/reactive.ts";
import { openDb, type Db } from "../db/index.ts";

export type VaultState = "loading" | "new" | "locked" | "unlocked";
export interface VaultOptions {
  /** The vault's name (one database per name). Default "march". */
  name?: string;
  /** Locks after this many ms without use (vault calls, keys, pointer). Default 15 minutes; 0: never. */
  autoLock?: number;
  /** PBKDF2 rounds for a new vault (an existing one keeps its own). Default 600 000. */
  iterations?: number;
  /** The shortest passphrase create() / changePassphrase() take. Default 10. */
  minLength?: number;
  /** A tab that opens while another tab of this browser has the vault open gets its keys (no second ask). Default true. */
  shareTabs?: boolean;
  /** Keep the encrypted data in memory only (tests). */
  memory?: boolean;
  /**
   * Keep the passphrase's length (in characters) beside the vault, so an unlock form can try it the moment that many
   * characters are typed (no button). It tells someone who copies the disk only how long it is. Default true.
   */
  rememberLength?: boolean;
}
/** What may be shown before the vault is open: the passphrase's length (when kept) and the user's hint. */
export interface VaultInfo { length?: number; hint?: string }
/** A passphrase's length as the vault counts it (characters, after NFC normalization). */
export const passLength = (passphrase: string): number => [...passphrase.normalize("NFC")].length;
/** Why a call failed: "locked" (unlock first), "exists" (create on an existing vault), "short" (passphrase), "wait" (too many wrong tries: `retryIn` ms). */
export class VaultError extends Error {
  /** Why it failed (the kinds above, and "missing": no vault yet, "wrong": the current passphrase is wrong, "hint": the hint gives the passphrase away). */
  code: "locked" | "exists" | "missing" | "short" | "wait" | "wrong" | "hint";
  /** With "wait": ms until the next try is allowed. */
  retryIn: number;
  constructor(code: VaultError["code"], message: string, retryIn = 0) { super(message); this.name = "VaultError"; this.code = code; this.retryIn = retryIn; }
}
export interface Vault {
  readonly name: string;
  state: Accessor<VaultState>;
  /** Ms until the next unlock try is allowed (0: now); live. */
  waitMs: Accessor<number>;
  /** The passphrase's length (when kept) and its hint; live. */
  info: Accessor<VaultInfo>;
  /** Makes a new vault with this passphrase (and a hint, stored as written: never the passphrase itself) and opens it. */
  create(passphrase: string, o?: { hint?: string }): Promise<void>;
  /** Opens the vault: false when the passphrase is wrong (throws "wait" while tries are slowed down). */
  unlock(passphrase: string): Promise<boolean>;
  /** Forgets the keys (here and in the other tabs). */
  lock(): void;
  set(name: string, value: unknown): Promise<void>;
  get<T = unknown>(name: string): Promise<T | undefined>;
  has(name: string): Promise<boolean>;
  remove(name: string): Promise<void>;
  /** The names (decrypted), sorted; `prefix` keeps those that start with it. */
  names(prefix?: string): Promise<string[]>;
  /** A value kept current for a component: undefined while locked or missing. */
  value<T = unknown>(name: string): Accessor<T | undefined>;
  /** Changes the passphrase (the data stays; only its key is wrapped again). */
  changePassphrase(current: string, next: string, o?: { hint?: string }): Promise<void>;
  /** Deletes the vault and everything in it (a forgotten passphrase: there is no other way back). */
  reset(): Promise<void>;
  /** Counts as use (holds off the auto-lock). */
  touch(): void;
}

interface Meta { v: 1; salt: Uint8Array; iterations: number; wrapIv: Uint8Array; dek: ArrayBuffer; macIv: Uint8Array; mac: ArrayBuffer; fails: number; until: number; len?: number; hint?: string }
interface Item { id: string; iv: Uint8Array; data: ArrayBuffer }
interface Keys { dek: CryptoKey; mac: CryptoKey }

const subtle = (): SubtleCrypto => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error("march/vault: WebCrypto is missing (it needs https or localhost)");
  return s;
};
const rand = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = (b: ArrayBuffer): string => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const AES = { name: "AES-GCM", length: 256 } as const, HMAC = { name: "HMAC", hash: "SHA-256", length: 256 } as const;

async function wrappingKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", enc.encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, AES, false, ["wrapKey", "unwrapKey"]);
}
const unwrap = (kek: CryptoKey, m: Meta, extractable = false): Promise<Keys> => Promise.all([
  subtle().unwrapKey("raw", m.dek, kek, { name: "AES-GCM", iv: m.wrapIv as BufferSource }, AES, extractable, ["encrypt", "decrypt"]),
  subtle().unwrapKey("raw", m.mac, kek, { name: "AES-GCM", iv: m.macIv as BufferSource }, HMAC, extractable, ["sign"]),
]).then(([dek, mac]) => ({ dek, mac }));
async function wrapInto(kek: CryptoKey, keys: Keys, m: Omit<Meta, "dek" | "mac" | "wrapIv" | "macIv">): Promise<Meta> {
  const wrapIv = rand(12), macIv = rand(12);
  const [dek, mac] = await Promise.all([
    subtle().wrapKey("raw", keys.dek, kek, { name: "AES-GCM", iv: wrapIv as BufferSource }),
    subtle().wrapKey("raw", keys.mac, kek, { name: "AES-GCM", iv: macIv as BufferSource }),
  ]);
  return { ...m, wrapIv, macIv, dek, mac };
}
/** How long the next try waits after `fails` wrong ones: none for three, then 2^(n-3) s, at most 5 minutes. */
export const unlockDelay = (fails: number): number => (fails < 3 ? 0 : Math.min(300_000, 1000 * 2 ** (fails - 3)));

const vaults = new Map<string, Vault>();
/** The vault of this name (one per name and page: calls with the same name get the same vault). */
export function createVault(opts: VaultOptions = {}): Vault {
  const name = opts.name ?? "march";
  const known = vaults.get(name);
  if (known) return known;
  const db: Db = openDb(`march-vault:${name}`, { version: 1, ...(opts.memory ? { memory: true } : {}), stores: { meta: {}, items: { key: "id" } } });
  const meta = db.store<Meta>("meta"), items = db.store<Item>("items");
  const state = signal<VaultState>("loading"), waitMs = signal(0), changed = signal(0), info = signal<VaultInfo>({});
  const infoOf = (m: Meta | undefined): VaultInfo => (m ? { ...(m.len ? { length: m.len } : {}), ...(m.hint ? { hint: m.hint } : {}) } : {});
  /** The length and hint kept with a passphrase (checked: a hint must not give the passphrase away). */
  const extra = (passphrase: string, hint?: string): { len?: number; hint?: string } => {
    const h = hint?.trim() ?? "", p = passphrase.normalize("NFC").toLocaleLowerCase();
    if (h && (h.normalize("NFC").toLocaleLowerCase().includes(p) || (p.length >= 4 && h.toLocaleLowerCase().includes(p.slice(0, Math.ceil(p.length * 0.6))))))
      throw new VaultError("hint", "march/vault: the hint gives the passphrase away");
    return { ...(opts.rememberLength !== false ? { len: passLength(passphrase) } : {}), ...(h ? { hint: h.slice(0, 200) } : {}) };
  };
  let keys: Keys | null = null, idle: ReturnType<typeof setTimeout> | undefined, waitTimer: ReturnType<typeof setTimeout> | undefined;
  const autoLock = opts.autoLock ?? 15 * 60_000, minLength = opts.minLength ?? 10;

  // the other tabs: "lock" locks all; a new tab asks ("keys?") and an open one answers with its (non-extractable) keys
  const BC = (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
  const ch = opts.shareTabs !== false && !opts.memory && BC ? new BC(`march-vault:${name}`) : null;
  (ch as { unref?: () => void } | null)?.unref?.();
  const ready = (async () => {
    const m = await meta.get("meta");
    info.set(infoOf(m));
    state.set(m ? "locked" : "new");
    if (m) showWait(m);
    if (m && ch) ch.postMessage({ t: "keys?" });
  })();
  if (ch) ch.onmessage = (e: MessageEvent<{ t: string; keys?: Keys }>) => {
    const d = e.data;
    if (d.t === "lock") forget();
    else if (d.t === "keys?" && keys) ch.postMessage({ t: "keys", keys });
    else if (d.t === "keys" && !keys && d.keys && state.peek() === "locked") { keys = d.keys; state.set("unlocked"); arm(); changed.set(changed.peek() + 1); }
    else if (d.t === "changed") changed.set(changed.peek() + 1);
    else if (d.t === "reset") { forget(); info.set({}); state.set("new"); }
    else if (d.t === "info") void meta.get("meta").then((m) => info.set(infoOf(m)));
  };

  const forget = (): void => { keys = null; clearTimeout(idle); if (state.peek() === "unlocked") state.set("locked"); changed.set(changed.peek() + 1); };
  const arm = (): void => { clearTimeout(idle); if (autoLock > 0 && keys) idle = setTimeout(() => self.lock(), autoLock); };
  function showWait(m: Meta): void {
    const left = Math.max(0, m.until - Date.now());
    waitMs.set(left);
    clearTimeout(waitTimer);
    if (left) waitTimer = setTimeout(() => showWait(m), Math.min(left, 1000));
  }
  // using the page counts as use
  const doc = (globalThis as { document?: Document }).document;
  if (doc && autoLock > 0) for (const ev of ["pointerdown", "keydown"]) doc.addEventListener(ev, () => { if (keys) arm(); }, { passive: true, capture: true });

  const need = (): Keys => { if (!keys) throw new VaultError("locked", "march/vault: locked (unlock first)"); arm(); return keys; };
  const idOf = async (k: Keys, n: string): Promise<string> => b64u(await subtle().sign("HMAC", k.mac, enc.encode(`march-vault:${n}`)));
  const open = async (k: Keys, it: Item): Promise<{ n: string; v: unknown }> =>
    JSON.parse(dec.decode(await subtle().decrypt({ name: "AES-GCM", iv: it.iv as BufferSource, additionalData: enc.encode(it.id) }, k.dek, it.data)));
  const tell = (): void => { changed.set(changed.peek() + 1); ch?.postMessage({ t: "changed" }); };

  const self: Vault = {
    name, state, waitMs, info,
    async create(passphrase, o) {
      await ready;
      if (await meta.get("meta")) throw new VaultError("exists", "march/vault: the vault exists (unlock it, or reset)");
      if (passphrase.length < minLength) throw new VaultError("short", `march/vault: the passphrase needs ${minLength}+ characters`);
      const iterations = opts.iterations ?? 600_000, salt = rand(16), more = extra(passphrase, o?.hint);
      const fresh: Keys = {
        dek: await subtle().generateKey(AES, true, ["encrypt", "decrypt"]) as CryptoKey,
        mac: await subtle().generateKey(HMAC, true, ["sign"]) as CryptoKey,
      };
      const kek = await wrappingKey(passphrase, salt, iterations), m = await wrapInto(kek, fresh, { v: 1, salt, iterations, fails: 0, until: 0, ...more });
      await meta.put(m, "meta");
      info.set(infoOf(m));
      // the keys kept in memory are the non-extractable copies
      keys = await unwrap(kek, m);
      state.set("unlocked"); arm(); tell();
    },
    async unlock(passphrase) {
      await ready;
      const m = await meta.get("meta");
      if (!m) throw new VaultError("missing", "march/vault: no vault yet (create it)");
      if (keys) { arm(); return true; }
      const left = m.until - Date.now();
      if (left > 0) throw new VaultError("wait", `march/vault: too many wrong tries; wait ${Math.ceil(left / 1000)} s`, left);
      try {
        keys = await unwrap(await wrappingKey(passphrase, m.salt, m.iterations), m);
      } catch {
        const fails = m.fails + 1, next = { ...m, fails, until: Date.now() + unlockDelay(fails) };
        await meta.put(next, "meta");
        showWait(next);
        return false;
      }
      if (m.fails) await meta.put({ ...m, fails: 0, until: 0 }, "meta");
      waitMs.set(0);
      state.set("unlocked"); arm(); changed.set(changed.peek() + 1);
      return true;
    },
    lock() { forget(); ch?.postMessage({ t: "lock" }); },
    async set(n, value) {
      const k = need(), id = await idOf(k, n), iv = rand(12);
      const data = await subtle().encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: enc.encode(id) }, k.dek, enc.encode(JSON.stringify({ n, v: value })));
      await items.put({ id, iv, data });
      tell();
    },
    async get<T>(n: string) {
      const k = need(), it = await items.get(await idOf(k, n));
      return it ? (await open(k, it)).v as T : undefined;
    },
    async has(n) { const k = need(); return !!(await items.get(await idOf(k, n))); },
    async remove(n) { const k = need(); await items.delete(await idOf(k, n)); tell(); },
    async names(prefix = "") {
      const k = need(), all = await items.find();
      const out: string[] = [];
      for (const it of all) { try { const { n } = await open(k, it); if (n.startsWith(prefix)) out.push(n); } catch { /* not ours: skipped */ } }
      return out.sort();
    },
    value<T>(n: string) {
      const v = signal<T | undefined>(undefined);
      let seq = 0;
      const read = async (): Promise<void> => {
        const s = ++seq;
        const next = keys ? await self.get<T>(n).catch(() => undefined) : undefined;
        if (s === seq) v.set(next);
      };
      // re-read when anything changes (a write, a lock, an unlock, another tab)
      let last = -1;
      const acc = reactive(() => { const c = changed(); if (c !== last) { last = c; void read(); } return v(); }) as Accessor<T | undefined>;
      (acc as { peek?: () => T | undefined }).peek = () => v.peek();
      if (getOwner()) onCleanup(() => { seq++; });
      return acc;
    },
    async changePassphrase(current, next, o) {
      await ready;
      if (next.length < minLength) throw new VaultError("short", `march/vault: the passphrase needs ${minLength}+ characters`);
      const more = extra(next, o?.hint);
      const m = await meta.get("meta");
      if (!m) throw new VaultError("missing", "march/vault: no vault yet");
      let raw: Keys;
      try { raw = await unwrap(await wrappingKey(current, m.salt, m.iterations), m, true); }
      catch { throw new VaultError("wrong", "march/vault: the current passphrase is wrong"); }
      const salt = rand(16), iterations = Math.max(m.iterations, opts.iterations ?? 600_000);
      const m2 = await wrapInto(await wrappingKey(next, salt, iterations), raw, { v: 1, salt, iterations, fails: 0, until: 0, ...more });
      await meta.put(m2, "meta");
      info.set(infoOf(m2)); ch?.postMessage({ t: "info" });
      arm();
    },
    async reset() {
      await ready;
      forget();
      await items.clear(); await meta.clear();
      info.set({}); state.set("new"); waitMs.set(0);
      ch?.postMessage({ t: "reset" });
      tell();
    },
    touch() { if (keys) arm(); },
  };
  // what is on disk, for tests and audits (ciphertext only)
  (self as unknown as { _dump(): Promise<unknown> })._dump = async () => ({ meta: await meta.get("meta"), items: await items.find() });
  vaults.set(name, self);
  return self;
}
/** Tests: forget the vaults made so far (the next createVault makes a new one). */
export function _resetVaults(): void { vaults.clear(); }
