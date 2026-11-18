// march/ai — the user's own AI: chat with Claude, ChatGPT, Gemini, DeepSeek, Kimi, Mistral, Groq, OpenRouter or Meta (Muse) straight
// from the browser with the user's API key (the user's account pays; nothing goes through a server of the app). The
// keys live in a march/vault; a request carries the key in a header (never in the URL), streams the answer and reports
// the tokens it used.
//
//   import { chat, PROVIDERS, aiKeys } from "march/ai";
//   const keys = aiKeys(vault);                        // vault: an unlocked march/vault
//   await keys.set("anthropic", "sk-ant-…");
//   const r = await chat({ provider: "anthropic", key: await keys.get("anthropic"), model: "claude-sonnet-5-5",
//     messages: [{ role: "user", content: "Hi" }], onText: (d) => out.append(d) });
//   r.text; r.usage;                                   // { input, output } tokens
//
// The page's Content-Security-Policy must allow the providers' origins in connect-src (PROVIDERS[i].origin).
import type { Vault } from "../vault/index.ts";

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
}
const notChat = /embed|tts|whisper|audio|image|dall-e|realtime|transcribe|moderation|search|rerank|guard|ocr|vision-preview|computer-use/i;
/** The providers march/ai talks to: Claude, ChatGPT, Gemini, DeepSeek, Kimi, Mistral, Groq, OpenRouter, Meta (Muse). */
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
];
/** A provider by id ("anthropic", "openai"…); throws for an unknown one. */
export const provider = (id: string): AiProvider => {
  const p = PROVIDERS.find((x) => x.id === id);
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
  try { res = await fetch(url, { ...init, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" }); }
  catch (e) {
    if ((e as Error)?.name === "AbortError") throw new AiError("abort", "Durduruldu");
    throw new AiError("network", `${p.name}: bağlanılamadı (ağ ya da sayfanın izinleri: connect-src ${p.origin})`);
  }
  if (!res.ok) await fail(res, p);
  return res;
};
const headers = (p: AiProvider, key: string): Record<string, string> =>
  p.kind === "anthropic" ? { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "content-type": "application/json" }
  : p.kind === "gemini" ? { "x-goog-api-key": key, "content-type": "application/json" }
  : { authorization: `Bearer ${key}`, "content-type": "application/json", ...(p.id === "openrouter" ? { "x-title": "MarchIDE" } : {}) };

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
  if (!r.key) throw new AiError("auth", `${p.name}: API anahtarı yok`);
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
  const res = await send(p.kind === "gemini" ? `${p.base}/models?pageSize=200` : `${p.base}/models${p.kind === "anthropic" ? "?limit=100" : ""}`, { headers: headers(p, key), ...(signal ? { signal } : {}) }, p);
  const j = await res.json() as J;
  let ids: string[] = p.kind === "gemini"
    ? (j.models ?? []).filter((m: J) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m: J) => String(m.name).replace(/^models\//, ""))
    : (j.data ?? []).map((m: J) => String(m.id));
  if (p.chatModel) ids = ids.filter(p.chatModel);
  // the provider's order (newest first for Anthropic); the others: by name, newest-looking first
  return p.kind === "anthropic" ? ids : ids.sort((a, b) => b.localeCompare(a, "en", { numeric: true }));
}

/** A key that looks like another provider's (a hint before saving): the provider it looks like, or null. */
export function keyLooksLike(key: string): string | null {
  const k = key.trim();
  for (const id of ["anthropic", "openrouter", "groq", "gemini"]) if (k.startsWith(provider(id).keyPrefix!)) return id;
  return null;
}
/** A key shown safely: its start and its last four characters. */
export const maskKey = (key: string): string => (key.length <= 12 ? "•".repeat(key.length) : `${key.slice(0, Math.min(7, key.indexOf("-", 3) + 1 || 4))}…${key.slice(-4)}`);

export interface AiSettings { provider?: string; models: Record<string, string>; consent: Record<string, boolean> }
export interface AiKeys {
  get(id: string): Promise<string | undefined>;
  set(id: string, key: string): Promise<void>;
  remove(id: string): Promise<void>;
  /** The providers that have a key. */
  configured(): Promise<string[]>;
  settings(): Promise<AiSettings>;
  saveSettings(s: Partial<AiSettings>): Promise<AiSettings>;
}
/** The AI keys kept in a vault ("ai:key:<provider>"), and the choices (default provider, model per provider, consent). */
export function aiKeys(vault: Vault): AiKeys {
  const self: AiKeys = {
    get: (id) => vault.get<string>(`ai:key:${id}`),
    set: (id, key) => vault.set(`ai:key:${id}`, key.trim()),
    remove: (id) => vault.remove(`ai:key:${id}`),
    configured: async () => (await vault.names("ai:key:")).map((n) => n.slice(7)),
    settings: async () => ({ models: {}, consent: {}, ...(await vault.get<AiSettings>("ai:settings")) }),
    async saveSettings(s) { const next = { ...(await self.settings()), ...s }; await vault.set("ai:settings", next); return next; },
  };
  return self;
}
