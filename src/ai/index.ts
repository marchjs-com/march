// march/ai — the user's own AI: chat with Claude, ChatGPT, Gemini, Grok, DeepSeek, Qwen, GLM, Kimi, Mistral, Meta (Muse),
// Groq, Cerebras, Together, Fireworks, OpenRouter, Perplexity, or a model on the user's own computer (Ollama, LM Studio)
// straight from the browser with the user's API key (the user's account pays; nothing goes through a server of the app).
// The keys live in a march/vault (several per provider, one active); a request carries the key in a header (never in
// the URL), streams the answer and reports the tokens it used.
//
//   import { chat, PROVIDERS, aiKeys } from "march/ai";
//   const keys = aiKeys(vault);                        // vault: an unlocked march/vault
//   await keys.add("anthropic", "sk-ant-…", "work");    // more keys per provider; the active one is used
//   const r = await chat({ provider: "anthropic", key: await keys.get("anthropic"), model: "claude-sonnet-5-5",
//     messages: [{ role: "user", content: "Hi" }], onText: (d) => out.append(d) });
//   r.text; r.usage;                                   // { input, output } tokens
//
// The page's Content-Security-Policy must allow the providers' origins in connect-src (PROVIDERS[i].origin).
import type { Vault } from "../vault/index.ts";
import { trackLoad } from "../dom/loads.ts";

export type AiKind = "anthropic" | "openai" | "gemini";
export interface AiProvider {
  id: string;
  name: string;
  /** The request format: Anthropic Messages, OpenAI chat completions (most), Gemini. */
  kind: AiKind;
  /** The API's base URL. */
  base: string;
  /** The origin a CSP's connect-src needs. */
  origin: string;
  /** Where the user makes a key. */
  keyUrl: string;
  /** How the provider's keys start (a hint when one is pasted for the wrong provider). */
  keyPrefix?: string;
  /** Models to offer before the provider's list is read (listModels reads the real one). */
  models: string[];
  /** Keeps the provider's model list to chat models. */
  chatModel?: (id: string) => boolean;
  /** Runs on the user's computer: no key needed (one is sent when given), the server must allow this page's origin. */
  local?: boolean;
  /** A note for the user (where the key comes from, what to set up). */
  hint?: string;
}
const notChat = /embed|tts|whisper|audio|image|dall-e|realtime|transcribe|moderation|search|rerank|guard|ocr|vision-preview|computer-use/i;
/** The providers march/ai talks to: the clouds' own APIs, the hosts of open models, and the user's own computer. */
export const PROVIDERS: AiProvider[] = [
  { id: "anthropic", name: "Claude (Anthropic)", kind: "anthropic", base: "https://api.anthropic.com/v1", origin: "https://api.anthropic.com", keyUrl: "https://console.anthropic.com/settings/keys", keyPrefix: "sk-ant-", models: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"] },
  { id: "openai", name: "ChatGPT (OpenAI)", kind: "openai", base: "https://api.openai.com/v1", origin: "https://api.openai.com", keyUrl: "https://platform.openai.com/api-keys", keyPrefix: "sk-", models: [], chatModel: (m) => /^(gpt|o\d|chatgpt)/.test(m) && !notChat.test(m) },
  { id: "gemini", name: "Gemini (Google)", kind: "gemini", base: "https://generativelanguage.googleapis.com/v1beta", origin: "https://generativelanguage.googleapis.com", keyUrl: "https://aistudio.google.com/apikey", keyPrefix: "AIza", models: [], chatModel: (m) => /^gemini/.test(m) && !notChat.test(m) },
  { id: "deepseek", name: "DeepSeek", kind: "openai", base: "https://api.deepseek.com/v1", origin: "https://api.deepseek.com", keyUrl: "https://platform.deepseek.com/api_keys", keyPrefix: "sk-", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "moonshot", name: "Kimi (Moonshot)", kind: "openai", base: "https://api.moonshot.ai/v1", origin: "https://api.moonshot.ai", keyUrl: "https://platform.moonshot.ai/console/api-keys", keyPrefix: "sk-", models: [], chatModel: (m) => !notChat.test(m) },
  { id: "mistral", name: "Mistral", kind: "openai", base: "https://api.mistral.ai/v1", origin: "https://api.mistral.ai", keyUrl: "https://console.mistral.ai/api-keys", models: [], chatModel: (m) => !notChat.test(m) },
  { id: "groq", name: "Groq", kind: "openai", base: "https://api.groq.com/openai/v1", origin: "https://api.groq.com", keyUrl: "https://console.groq.com/keys", keyPrefix: "gsk_", models: [], chatModel: (m) => !notChat.test(m) },
  { id: "openrouter", name: "OpenRouter", kind: "openai", base: "https://openrouter.ai/api/v1", origin: "https://openrouter.ai", keyUrl: "https://openrouter.ai/settings/keys", keyPrefix: "sk-or-", models: [], chatModel: (m) => !notChat.test(m) },
  // Meta Model API (Muse Spark…): OpenAI-compatible; in public preview, the account and its region decide access
  { id: "meta", name: "Meta (Muse)", kind: "openai", base: "https://api.meta.ai/v1", origin: "https://api.meta.ai", keyUrl: "https://dev.meta.ai", models: [], chatModel: (m) => !notChat.test(m) },
  { id: "xai", name: "Grok (xAI)", kind: "openai", base: "https://api.x.ai/v1", origin: "https://api.x.ai", keyUrl: "https://console.x.ai", keyPrefix: "xai-", models: [], chatModel: (m) => /grok/.test(m) && !notChat.test(m) },
  { id: "qwen", name: "Qwen (Alibaba Cloud)", kind: "openai", base: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", origin: "https://dashscope-intl.aliyuncs.com", keyUrl: "https://modelstudio.console.alibabacloud.com/", keyPrefix: "sk-", models: ["qwen-max", "qwen-plus", "qwen-turbo"], chatModel: (m) => /qwen/i.test(m) && !notChat.test(m) },
  { id: "zai", name: "GLM (Z.ai)", kind: "openai", base: "https://api.z.ai/api/paas/v4", origin: "https://api.z.ai", keyUrl: "https://z.ai/manage-apikey/apikey-list", models: ["glm-4.6", "glm-4.5-air"], chatModel: (m) => /glm/i.test(m) && !notChat.test(m) },
  { id: "together", name: "Together AI", kind: "openai", base: "https://api.together.xyz/v1", origin: "https://api.together.xyz", keyUrl: "https://api.together.ai/settings/api-keys", models: [], chatModel: (m) => !notChat.test(m) },
  { id: "fireworks", name: "Fireworks", kind: "openai", base: "https://api.fireworks.ai/inference/v1", origin: "https://api.fireworks.ai", keyUrl: "https://fireworks.ai/account/api-keys", keyPrefix: "fw_", models: [], chatModel: (m) => !notChat.test(m) },
  { id: "cerebras", name: "Cerebras", kind: "openai", base: "https://api.cerebras.ai/v1", origin: "https://api.cerebras.ai", keyUrl: "https://cloud.cerebras.ai", keyPrefix: "csk-", models: [], chatModel: (m) => !notChat.test(m) },
  { id: "perplexity", name: "Perplexity (Sonar)", kind: "openai", base: "https://api.perplexity.ai", origin: "https://api.perplexity.ai", keyUrl: "https://www.perplexity.ai/account/api/keys", keyPrefix: "pplx-", models: ["sonar", "sonar-pro", "sonar-reasoning-pro"] },
  // a model on the user's own computer: no key, nothing leaves the machine; the server must allow this page's origin
  { id: "ollama", name: "Ollama (local)", kind: "openai", base: "http://localhost:11434/v1", origin: "http://localhost:11434", keyUrl: "https://ollama.com/download", models: [], local: true,
    hint: "Ollama must allow this page: start it with OLLAMA_ORIGINS set to this site's address (or *)." },
  { id: "lmstudio", name: "LM Studio (local)", kind: "openai", base: "http://localhost:1234/v1", origin: "http://localhost:1234", keyUrl: "https://lmstudio.ai", models: [], local: true,
    hint: "In LM Studio: Developer › start the server and turn on CORS." },
];
/** A provider the user adds: a name, the API's base URL and the format it speaks (most speak OpenAI's). */
export interface CustomProvider { id: string; name: string; kind: AiKind; base: string }
const custom = new Map<string, AiProvider>();
/** An https URL, or an http one on this computer (localhost): where a key may go. Null when it is not one. */
export function endpointOf(base: string): { base: string; origin: string; local: boolean } | null {
  let u: URL;
  try { u = new URL(base.trim()); } catch { return null; }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return null;
  if (u.username || u.password || u.search || u.hash) return null;
  return { base: u.href.replace(/\/+$/, ""), origin: u.origin, local };
}
/** The provider a custom entry describes. */
export function customProvider(c: CustomProvider): AiProvider {
  const e = endpointOf(c.base);
  if (!e) throw new AiError("bad", `march/ai: "${c.base}" is not an https address (or http on localhost)`);
  return { id: c.id, name: c.name, kind: c.kind, base: e.base, origin: e.origin, keyUrl: "", models: [], local: e.local, chatModel: (m) => !notChat.test(m) };
}
/** Makes a custom provider known (aiKeys does it for the ones in its vault); `null` forgets it. */
export function registerProvider(id: string, c: CustomProvider | null): void { if (c) custom.set(id, customProvider(c)); else custom.delete(id); }
/** The built-in providers and the custom ones known now. */
export const allProviders = (): AiProvider[] => [...PROVIDERS, ...custom.values()];
/** A provider by id ("anthropic", "openai", a custom one…); throws for an unknown one. */
export const provider = (id: string): AiProvider => {
  const p = PROVIDERS.find((x) => x.id === id) ?? custom.get(id);
  if (!p) throw new AiError("bad", `march/ai: no provider "${id}"`);
  return p;
};

export interface ChatMessage { role: "user" | "assistant"; content: string }
/** Tokens: `input` all that was read (with the cached part), `cached` the part read from the provider's cache (cheaper). */
export interface Usage { input: number; output: number; cached?: number }
export interface ChatRequest {
  provider: string;
  key: string;
  model: string;
  system?: string;
  messages: ChatMessage[];
  /** The longest answer in tokens. Default 4096. */
  maxTokens?: number;
  temperature?: number;
  /** Mark the system text for the provider's prompt cache (Anthropic: cache_control; the others cache a repeated
   *  prefix by themselves). Default true: a long, unchanging system text then costs about a tenth after the first send. */
  cache?: boolean;
  /** Stops the request (a Stop button). */
  signal?: AbortSignal;
  /** Each piece of the answer as it arrives, and the answer so far. */
  onText?: (delta: string, text: string) => void;
}
export interface ChatResult { text: string; usage: Usage; model: string; stop?: string }
/** Why a request failed, in the user's terms: the key ("auth"), the limit ("rate"), the balance ("quota"), the network, the request ("bad"), the provider ("server"), stopped ("abort"). */
export class AiError extends Error {
  /** Why it failed (the kinds above). */
  code: "auth" | "rate" | "quota" | "network" | "bad" | "server" | "abort";
  /** The HTTP status (0 when no answer came). */
  status: number;
  constructor(code: AiError["code"], message: string, status = 0) { super(message); this.name = "AiError"; this.code = code; this.status = status; }
}

const fail = async (res: Response, p: AiProvider): Promise<never> => {
  let detail = "";
  try { const j = await res.json() as { error?: { message?: string } | string; message?: string }; detail = typeof j.error === "string" ? j.error : j.error?.message ?? j.message ?? ""; } catch { /* not JSON */ }
  const s = res.status;
  const code = s === 401 || s === 403 ? "auth" : s === 429 ? "rate" : s === 402 ? "quota" : s >= 500 ? "server" : "bad";
  // never put the key in a message: the provider's own text is kept short
  throw new AiError(code, `${p.name}: ${detail.slice(0, 300) || `HTTP ${s}`}`, s);
};
const send = async (url: string, init: RequestInit, p: AiProvider): Promise<Response> => {
  let res: Response;
  // announced to the global load listener (onLoad) until the response arrives (a stream reads on after it)
  try { res = await trackLoad(fetch(url, { ...init, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" }), { kind: "ai", key: p.name }); }
  catch (e) {
    if ((e as Error)?.name === "AbortError") throw new AiError("abort", "Durduruldu");
    throw new AiError("network", p.local ? `${p.name}: bağlanılamadı (çalışıyor mu, bu sayfaya izin veriyor mu?)` : `${p.name}: bağlanılamadı (ağ ya da sayfanın izinleri: connect-src ${p.origin})`);
  }
  if (!res.ok) await fail(res, p);
  return res;
};
const headers = (p: AiProvider, key: string): Record<string, string> =>
  p.kind === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "content-type": "application/json" }
  : p.kind === "gemini" ? { "x-goog-api-key": key, "content-type": "application/json" }
  : { ...(key ? { authorization: `Bearer ${key}` } : {}), "content-type": "application/json", ...(p.id === "openrouter" ? { "x-title": "MarchIDE" } : {}) };

/** The data lines of a server-sent event stream (one parsed JSON per event; "[DONE]" ends it). */
export async function* sseEvents(res: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += value;
    let i: number;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + (buf[i] === "\r" ? 4 : 2));
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (!data) continue;
      if (data === "[DONE]") return;
      try { yield JSON.parse(data) as Record<string, unknown>; } catch { /* a comment or a keep-alive */ }
    }
    if (done) return;
  }
}

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Sends a chat and streams the answer (onText); resolves with the whole answer and the tokens used. */
export async function chat(r: ChatRequest): Promise<ChatResult> {
  const p = provider(r.provider);
  if (!r.key && !p.local) throw new AiError("auth", `${p.name}: API anahtarı yok`);
  const max = r.maxTokens ?? 4096, usage: Usage = { input: 0, output: 0 };
  let text = "", stop: string | undefined, model = r.model;
  const add = (d: string): void => { if (!d) return; text += d; r.onText?.(d, text); };
  const init = (body: unknown): RequestInit => ({ method: "POST", headers: headers(p, r.key), body: JSON.stringify(body), ...(r.signal ? { signal: r.signal } : {}) });
  try {
    if (p.kind === "anthropic") {
      const res = await send(`${p.base}/messages`, init({ model: r.model, max_tokens: max, stream: true, ...(r.system ? { system: r.cache === false ? r.system : [{ type: "text", text: r.system, cache_control: { type: "ephemeral" } }] } : {}), ...(r.temperature !== undefined ? { temperature: r.temperature } : {}), messages: r.messages }), p);
      for await (const e of sseEvents(res) as AsyncGenerator<J>) {
        if (e.type === "message_start") {
          const u = e.message?.usage ?? {}, cached = u.cache_read_input_tokens ?? 0;
          usage.input = (u.input_tokens ?? 0) + cached + (u.cache_creation_input_tokens ?? 0);
          if (cached) usage.cached = cached;
          model = e.message?.model ?? model;
        }
        else if (e.type === "content_block_delta" && e.delta?.type === "text_delta") add(e.delta.text);
        else if (e.type === "message_delta") { usage.output = e.usage?.output_tokens ?? usage.output; stop = e.delta?.stop_reason ?? stop; }
        else if (e.type === "error") throw new AiError("server", `${p.name}: ${e.error?.message ?? "hata"}`);
      }
    } else if (p.kind === "gemini") {
      const contents = r.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
      const res = await send(`${p.base}/models/${encodeURIComponent(r.model)}:streamGenerateContent?alt=sse`, init({
        contents, ...(r.system ? { systemInstruction: { parts: [{ text: r.system }] } } : {}),
        generationConfig: { maxOutputTokens: max, ...(r.temperature !== undefined ? { temperature: r.temperature } : {}) },
      }), p);
      for await (const e of sseEvents(res) as AsyncGenerator<J>) {
        const c = e.candidates?.[0];
        for (const part of c?.content?.parts ?? []) if (!part.thought) add(part.text ?? "");
        if (c?.finishReason) stop = c.finishReason;
        if (e.usageMetadata) {
          usage.input = e.usageMetadata.promptTokenCount ?? usage.input; usage.output = (e.usageMetadata.candidatesTokenCount ?? 0) + (e.usageMetadata.thoughtsTokenCount ?? 0);
          if (e.usageMetadata.cachedContentTokenCount) usage.cached = e.usageMetadata.cachedContentTokenCount;
        }
        if (e.modelVersion) model = e.modelVersion;
      }
    } else {
      const messages = [...(r.system ? [{ role: "system", content: r.system }] : []), ...r.messages];
      const usageOpt = ["openai", "deepseek", "groq", "openrouter"].includes(p.id) ? { stream_options: { include_usage: true } } : {};
      const res = await send(`${p.base}/chat/completions`, init({ model: r.model, messages, stream: true, ...usageOpt, ...(p.id === "openai" ? { max_completion_tokens: max } : { max_tokens: max }), ...(r.temperature !== undefined ? { temperature: r.temperature } : {}) }), p);
      for await (const e of sseEvents(res) as AsyncGenerator<J>) {
        if (e.error) throw new AiError("server", `${p.name}: ${e.error.message ?? "hata"}`);
        const c = e.choices?.[0];
        add(c?.delta?.content ?? "");
        if (c?.finish_reason) stop = c.finish_reason;
        const u = e.usage ?? c?.usage;
        if (u) {
          usage.input = u.prompt_tokens ?? usage.input; usage.output = u.completion_tokens ?? usage.output;
          const cached = u.prompt_tokens_details?.cached_tokens ?? u.prompt_cache_hit_tokens;
          if (cached) usage.cached = cached;
        }
        if (e.model) model = e.model;
      }
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new AiError("abort", "Durduruldu");
    throw e;
  }
  return { text, usage, model, ...(stop ? { stop } : {}) };
}

/** The provider's chat models for this key (also a check that the key works: it throws "auth" when it does not). */
export async function listModels(id: string, key: string, signal?: AbortSignal): Promise<string[]> {
  const p = provider(id);
  let res: Response;
  try { res = await send(p.kind === "gemini" ? `${p.base}/models?pageSize=200` : `${p.base}/models${p.kind === "anthropic" ? "?limit=100" : ""}`, { headers: headers(p, key), ...(signal ? { signal } : {}) }, p); }
  catch (e) {
    // a provider without a model list (it answers 404): the known models (the key was not refused)
    if (e instanceof AiError && e.status === 404 && p.models.length) return [...p.models];
    throw e;
  }
  const j = await res.json() as J;
  let ids: string[] = p.kind === "gemini"
    ? (j.models ?? []).filter((m: J) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m: J) => String(m.name).replace(/^models\//, ""))
    : (Array.isArray(j) ? j : j.data ?? []).map((m: J) => String(m.id));
  if (p.chatModel) ids = ids.filter(p.chatModel);
  // the provider's order (newest first for Anthropic); the others: by name, newest-looking first
  return p.kind === "anthropic" ? ids : ids.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
}

/** A key that looks like another provider's (a hint before saving): the provider it looks like, or null. */
export function keyLooksLike(key: string): string | null {
  const k = key.trim();
  for (const id of ["anthropic", "openrouter", "groq", "gemini", "xai", "perplexity", "fireworks", "cerebras"]) if (k.startsWith(provider(id).keyPrefix!)) return id;
  return null;
}
/**
 * A key shown safely: its kind (the provider's prefix, "sk-ant-", at most a quarter of it) and, for a long key, its
 * last four characters; a short key shows next to nothing.
 */
export function maskKey(key: string): string {
  const known = PROVIDERS.map((p) => p.keyPrefix ?? "").filter((x) => x && key.startsWith(x)).sort((a, b) => b.length - a.length)[0];
  const n = key.length, cut = key.slice(2).search(/[-_]/), prefix = known ? known.length : cut >= 0 ? cut + 3 : 0;
  const head = Math.min(prefix || 3, 7, Math.floor(n / 4)), tail = n >= 24 ? 4 : 0;
  return `${key.slice(0, head)}${"•".repeat(4)}${tail ? key.slice(-tail) : ""}`;
}

export interface AiSettings {
  provider?: string;
  models: Record<string, string>;
  consent: Record<string, boolean>;
  /** The key used for each provider (its id; the first key when not set). */
  active: Record<string, string>;
  /** The providers the user added (an endpoint and its format). */
  custom?: CustomProvider[];
}
/** A saved key: its provider, the user's own name for it, the key, when it was added. */
export interface AiKey { id: string; provider: string; label: string; key: string; added: number }
export interface AiKeys {
  /** The keys, in the providers' order (then oldest first); `provider` keeps that provider's. */
  list(provider?: string): Promise<AiKey[]>;
  /** Saves a key for a provider (a name of the user's: "work", "personal"…); the provider's first key becomes active. */
  add(provider: string, key: string, label?: string): Promise<AiKey>;
  rename(id: string, label: string): Promise<void>;
  /** Removes a key; when it was the active one, the provider's next key is. */
  remove(id: string): Promise<void>;
  /** Makes a key the one its provider uses. */
  activate(id: string): Promise<void>;
  /** The key a provider uses now (its active one), or undefined. */
  get(provider: string): Promise<string | undefined>;
  /** The providers that have a key. */
  configured(): Promise<string[]>;
  settings(): Promise<AiSettings>;
  saveSettings(s: Partial<AiSettings>): Promise<AiSettings>;
  /** Adds a provider of the user's own (its base URL must be https, or http on localhost); returns it. */
  addProvider(c: Omit<CustomProvider, "id">): Promise<CustomProvider>;
  /** Removes a provider the user added, with its keys. */
  removeProvider(id: string): Promise<void>;
}
const order = (p: string): number => { const all = allProviders(), i = all.findIndex((x) => x.id === p); return i < 0 ? all.length : i; };
const rid = (): string => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
/**
 * The AI keys kept in a vault ("ai:key:<provider>:<id>"), and the choices (default provider, model and active key per
 * provider, consent). A key saved by the first version ("ai:key:<provider>", one per provider) is moved over when read.
 */
export function aiKeys(vault: Vault): AiKeys {
  type Stored = { key: string; label: string; added: number };
  const migrate = async (): Promise<void> => {
    for (const n of await vault.names("ai:key:")) {
      const rest = n.slice(7);
      if (rest.includes(":")) continue;
      const key = await vault.get<string>(n);
      if (typeof key === "string" && key) await vault.set(`ai:key:${rest}:${rid()}`, { key, label: "", added: Date.now() } satisfies Stored);
      await vault.remove(n);
    }
  };
  let migrated: Promise<void> | null = null;
  const ready = (): Promise<void> => (migrated ??= migrate().catch((e) => { migrated = null; throw e; }));
  const self: AiKeys = {
    async list(p) {
      await ready();
      const out: AiKey[] = [];
      for (const n of await vault.names(p ? `ai:key:${p}:` : "ai:key:")) {
        const [, , prov, id] = n.split(":");
        const v = await vault.get<Stored>(n);
        if (prov && id && v) out.push({ id: `${prov}:${id}`, provider: prov, label: v.label ?? "", key: v.key, added: v.added ?? 0 });
      }
      return out.sort((a, b) => order(a.provider) - order(b.provider) || a.added - b.added);
    },
    async add(p, key, label = "") {
      await self.settings(); provider(p);
      await ready();
      const id = `${p}:${rid()}`, k: AiKey = { id, provider: p, label: label.trim(), key: key.trim(), added: Date.now() };
      await vault.set(`ai:key:${id}`, { key: k.key, label: k.label, added: k.added } satisfies Stored);
      const s = await self.settings();
      if (!s.active[p]) await self.saveSettings({ active: { ...s.active, [p]: id }, ...(s.provider ? {} : { provider: p }) });
      return k;
    },
    async rename(id, label) { const v = await vault.get<Stored>(`ai:key:${id}`); if (v) await vault.set(`ai:key:${id}`, { ...v, label: label.trim() }); },
    async remove(id) {
      await vault.remove(`ai:key:${id}`);
      const p = id.split(":")[0]!, s = await self.settings();
      if (s.active[p] === id || s.provider === p) {
        const next = (await self.list(p))[0], active = { ...s.active };
        if (next) active[p] = next.id; else delete active[p];
        const def = s.provider === p && !next ? (await self.configured())[0] : s.provider;
        await vault.set("ai:settings", { ...s, active, provider: def });
      }
    },
    async activate(id) { const s = await self.settings(); await self.saveSettings({ active: { ...s.active, [id.split(":")[0]!]: id } }); },
    async get(p) {
      const list = await self.list(p), s = await self.settings();
      return (list.find((k) => k.id === s.active[p]) ?? list[0])?.key;
    },
    configured: async () => [...new Set((await self.list()).map((k) => k.provider))],
    async settings() {
      const s = { models: {}, consent: {}, active: {}, ...(await vault.get<Partial<AiSettings>>("ai:settings")) } as AiSettings;
      // the user's own providers are known from here on (chat, models, the panels)
      for (const c of s.custom ?? []) { try { registerProvider(c.id, c); } catch { /* an address no longer allowed: left out */ } }
      return s;
    },
    async saveSettings(s) { const next = { ...(await self.settings()), ...s }; await vault.set("ai:settings", next); return next; },
    async addProvider(c) {
      const name = c.name.trim(), e = endpointOf(c.base);
      if (!name) throw new AiError("bad", "march/ai: the provider needs a name");
      if (!e) throw new AiError("bad", `march/ai: "${c.base}" is not an https address (or http on localhost)`);
      const s = await self.settings(), entry: CustomProvider = { id: `c-${rid()}`, name, kind: c.kind, base: e.base };
      registerProvider(entry.id, entry);
      await self.saveSettings({ custom: [...(s.custom ?? []), entry] });
      return entry;
    },
    async removeProvider(id) {
      for (const k of await self.list(id)) await vault.remove(`ai:key:${k.id}`);
      const s = await self.settings(), active = { ...s.active }, models = { ...s.models };
      delete active[id]; delete models[id];
      const rest = (s.custom ?? []).filter((c) => c.id !== id);
      await vault.set("ai:settings", { ...s, active, models, custom: rest, provider: s.provider === id ? (await self.configured()).find((p) => p !== id) : s.provider });
      registerProvider(id, null);
    },
  };
  return self;
}
