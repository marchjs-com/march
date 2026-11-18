// march/ai: the three request formats (headers, body, the key never in the URL), streaming, token usage, errors in the
// user's terms, model lists, key hints; fetch is a stand-in.
import { test } from "node:test";
import assert from "node:assert/strict";

const { chat, listModels, AiError, keyLooksLike, maskKey, PROVIDERS, aiKeys } = await import("./index.ts");
const { createVault, _resetVaults } = await import("../vault/index.ts");

const sse = (events) => new Response(events.map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
let last;
const serve = (res) => { globalThis.fetch = async (url, init) => { last = { url, init, body: init.body ? JSON.parse(init.body) : null }; return typeof res === "function" ? res() : res; }; };

test("anthropic: browser header, system, stream, usage", async () => {
  serve(sse([
    { type: "message_start", message: { model: "claude-sonnet-5-5", usage: { input_tokens: 2, cache_read_input_tokens: 10 } } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "Mer" } },
    { type: "content_block_delta", delta: { type: "text_delta", text: "haba" } },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } },
  ]));
  const parts = [];
  const r = await chat({ provider: "anthropic", key: "sk-ant-X", model: "claude-sonnet-5-5", system: "sys", messages: [{ role: "user", content: "hi" }], onText: (d) => parts.push(d) });
  assert.deepEqual(r, { text: "Merhaba", usage: { input: 12, output: 3, cached: 10 }, model: "claude-sonnet-5-5", stop: "end_turn" });
  assert.deepEqual(parts, ["Mer", "haba"]);
  assert.equal(last.url, "https://api.anthropic.com/v1/messages");
  assert.equal(last.init.headers["x-api-key"], "sk-ant-X");
  assert.equal(last.init.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(last.init.credentials, "omit");
  assert.deepEqual(last.body.system, [{ type: "text", text: "sys", cache_control: { type: "ephemeral" } }], "the system text is marked for the prompt cache");
});

test("openai-compatible: system message, bearer, usage chunk, [DONE]", async () => {
  serve(sse([{ choices: [{ delta: { content: "A" } }] }, { choices: [{ delta: { content: "B" }, finish_reason: "stop" }] }, { choices: [], usage: { prompt_tokens: 5, completion_tokens: 2 } }, "[DONE]"]));
  const r = await chat({ provider: "deepseek", key: "sk-1", model: "deepseek-chat", system: "s", messages: [{ role: "user", content: "x" }] });
  assert.equal(r.text, "AB");
  assert.deepEqual(r.usage, { input: 5, output: 2 });
  assert.equal(last.url, "https://api.deepseek.com/v1/chat/completions");
  assert.equal(last.init.headers.authorization, "Bearer sk-1");
  assert.deepEqual(last.body.messages[0], { role: "system", content: "s" });
  assert.ok(last.body.stream_options.include_usage);
});

test("gemini: key in a header (not the URL), model role, usage", async () => {
  serve(sse([{ candidates: [{ content: { parts: [{ text: "Hi" }] } }] }, { candidates: [{ content: { parts: [{ text: "!" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 1 } }]));
  const r = await chat({ provider: "gemini", key: "AIzaK", model: "gemini-x", messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] });
  assert.equal(r.text, "Hi!");
  assert.deepEqual(r.usage, { input: 4, output: 1 });
  assert.ok(!last.url.includes("AIzaK"), "the key is not in the URL");
  assert.equal(last.init.headers["x-goog-api-key"], "AIzaK");
  assert.equal(last.body.contents[1].role, "model");
});

test("errors: auth, rate, network, abort, no key", async () => {
  serve(new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 401 }));
  await assert.rejects(chat({ provider: "anthropic", key: "k", model: "m", messages: [] }), (e) => e instanceof AiError && e.code === "auth" && /invalid/.test(e.message));
  serve(new Response("{}", { status: 429 }));
  await assert.rejects(chat({ provider: "openai", key: "k", model: "m", messages: [] }), (e) => e.code === "rate");
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  await assert.rejects(chat({ provider: "groq", key: "k", model: "m", messages: [] }), (e) => e.code === "network" && /connect-src/.test(e.message));
  globalThis.fetch = async () => { const e = new Error("x"); e.name = "AbortError"; throw e; };
  await assert.rejects(chat({ provider: "groq", key: "k", model: "m", messages: [] }), (e) => e.code === "abort");
  await assert.rejects(chat({ provider: "groq", key: "", model: "m", messages: [] }), (e) => e.code === "auth");
});

test("models: chat models only; key hints and masks", async () => {
  serve(new Response(JSON.stringify({ data: [{ id: "gpt-a" }, { id: "text-embedding-3" }, { id: "gpt-b-tts" }, { id: "o9" }] })));
  assert.deepEqual(await listModels("openai", "k"), ["o9", "gpt-a"]);
  serve(new Response(JSON.stringify({ models: [{ name: "models/gemini-z", supportedGenerationMethods: ["generateContent"] }, { name: "models/embedding-1", supportedGenerationMethods: ["embedContent"] }] })));
  assert.deepEqual(await listModels("gemini", "k"), ["gemini-z"]);
  assert.equal(keyLooksLike("sk-ant-abc"), "anthropic");
  assert.equal(keyLooksLike("sk-or-v1-x"), "openrouter");
  assert.equal(keyLooksLike("sk-plain"), null);
  assert.equal(maskKey("sk-ant-api03-abcdefghijkl1234"), "sk-ant-…1234");
  assert.equal(PROVIDERS.length, 18);
});

test("aiKeys: several keys per provider, the active one is used; the old one-key layout is moved over", async () => {
  _resetVaults();
  const v = createVault({ name: "ai-t", memory: true, iterations: 1000, autoLock: 0 });
  await v.create("a long passphrase");
  await v.set("ai:key:openai", "sk-old");
  const k = aiKeys(v);
  assert.deepEqual((await k.list()).map((x) => [x.provider, x.key]), [["openai", "sk-old"]], "the old layout is moved over");
  const a = await k.add("anthropic", " sk-ant-1 ", "work");
  const b = await k.add("anthropic", "sk-ant-2", "personal");
  assert.equal(await k.get("anthropic"), "sk-ant-1", "the first key is active");
  assert.deepEqual((await k.list("anthropic")).map((x) => x.label), ["work", "personal"]);
  assert.deepEqual((await k.list()).map((x) => x.provider), ["anthropic", "anthropic", "openai"], "in the providers' order");
  await k.activate(b.id);
  assert.equal(await k.get("anthropic"), "sk-ant-2");
  await k.remove(b.id);
  assert.equal(await k.get("anthropic"), "sk-ant-1", "the next key takes over");
  await k.rename(a.id, "main");
  assert.equal((await k.list("anthropic"))[0].label, "main");
  assert.deepEqual(await k.configured(), ["anthropic", "openai"]);
  assert.equal((await k.settings()).provider, "anthropic");
  await k.remove(a.id);
  assert.deepEqual(await k.configured(), ["openai"]);
  assert.equal((await k.settings()).provider, "openai", "the default moves to a provider that still has a key");
});

test("local providers: no key needed, none sent", async () => {
  serve(sse([{ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }, "[DONE]"]));
  const r = await chat({ provider: "ollama", key: "", model: "llama3", messages: [{ role: "user", content: "x" }] });
  assert.equal(r.text, "ok");
  assert.equal(last.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(last.init.headers.authorization, undefined);
  serve(new Response("{}", { status: 404 }));
  assert.deepEqual(await listModels("perplexity", "k"), ["sonar", "sonar-pro", "sonar-reasoning-pro"], "no model list: the known ones");
  serve(new Response(JSON.stringify([{ id: "meta-llama/x" }])));
  assert.deepEqual(await listModels("together", "k"), ["meta-llama/x"], "a bare array of models");
});

test("meta: OpenAI-compatible at api.meta.ai, bearer key", async () => {
  serve(sse([{ choices: [{ delta: { content: "Hi" }, finish_reason: "stop" }] }, "[DONE]"]));
  const r = await chat({ provider: "meta", key: "mk-1", model: "muse-spark", messages: [{ role: "user", content: "x" }] });
  assert.equal(r.text, "Hi");
  assert.equal(last.url, "https://api.meta.ai/v1/chat/completions");
  assert.equal(last.init.headers.authorization, "Bearer mk-1");
});
