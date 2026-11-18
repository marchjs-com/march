// The panels of the vault and AI plugins: "AI keys" (make / open the vault, a key per provider: paste, check, model,
// default, remove) and "AI" (a chat about the open file: explain, fix, write tests; answers stream in, code blocks
// apply to the file; the tokens used are shown, a Stop button ends a request). Everything goes from this browser to
// the provider with the user's own key.
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { If, Else } from "../../../dom/flow.ts";
import { For } from "../../../dom/for.ts";
import { t, locale } from "../../../core/i18n.ts";
import { glyph } from "../../../ui/util.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { PasswordInput } from "../../forms/password-input/index.ts";
import { Textarea } from "../../forms/textarea/index.ts";
import { Select } from "../../forms/select/index.ts";
import { Alert } from "../../feedback/alert/index.ts";
import { StatusDot } from "../../feedback/status-dot/index.ts";
import { CodeView } from "../../typography/code-view/index.ts";
import { lock } from "../../../icons/glyphs/lock.ts";
import { key as keyIcon } from "../../../icons/glyphs/key.ts";
import { trash } from "../../../icons/glyphs/trash.ts";
import { externalLink } from "../../../icons/glyphs/externalLink.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";
import { send } from "../../../icons/glyphs/send.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { shieldCheck } from "../../../icons/glyphs/shieldCheck.ts";
import { refresh } from "../../../icons/glyphs/refresh.ts";
import { VaultError, type Vault } from "../../../vault/index.ts";
import { PROVIDERS, AiError, chat, listModels, keyLooksLike, maskKey, provider as providerOf, type AiKeys, type AiProvider, type AiSettings, type ChatMessage, type Usage } from "../../../ai/index.ts";

/** How strong a passphrase looks: 0 (weak) … 4 (strong), by length and kinds of characters. */
export function passStrength(p: string): number {
  if (p.length < 10) return 0;
  const kinds = [/[a-zçğıöşü]/, /[A-ZÇĞİÖŞÜ]/, /\d/, /[^\wçğıöşüÇĞİÖŞÜ]/].filter((r) => r.test(p)).length;
  return Math.min(4, (p.length >= 16 ? 2 : 1) + (kinds >= 3 ? 2 : kinds >= 2 ? 1 : 0));
}
const STRENGTH = ["Too short", "Weak", "Fair", "Good", "Strong"];
/** A failure in the user's words. */
export function errText(e: unknown): string {
  if (e instanceof VaultError) {
    const s = Math.ceil(e.retryIn / 1000);
    return e.code === "wait" ? t`Too many wrong tries; wait ${s} s.` : e.code === "short" ? t("Choose a longer passphrase: 10+ characters, letters and digits (a short sentence is best).")
      : e.code === "wrong" ? t("The current passphrase is wrong.") : e.code === "locked" ? t("The vault is locked.") : e.code === "exists" ? t("The vault already exists.") : t("There is no vault yet.");
  }
  if (e instanceof AiError) {
    const why = e.code === "auth" ? t("the key was refused (check it, or make a new one)") : e.code === "rate" ? t("the rate limit was hit; try again in a moment")
      : e.code === "quota" ? t("the account's balance or quota is used up") : "";
    return why ? `${why} — ${e.message}` : e.message;
  }
  return String((e as Error)?.message ?? e);
}

// ------------------------------------------------------------------------------------------------- the vault gate
/** Make or open the vault: shown while it is not open. */
function VaultGate(props: { vault: Vault; intro?: unknown }) {
  const pass = signal(""), again = signal(""), busy = signal(false), error = signal(""), confirmReset = signal(false);
  const strength = computed(() => passStrength(pass()));
  const create = async (): Promise<void> => {
    error.set("");
    if (strength() < 2) { error.set(t("Choose a longer passphrase: 10+ characters, letters and digits (a short sentence is best).")); return; }
    if (pass() !== again()) { error.set(t("The passphrases do not match.")); return; }
    busy.set(true);
    try { await props.vault.create(pass()); pass.set(""); again.set(""); } catch (e) { error.set(errText(e)); } finally { busy.set(false); }
  };
  const unlock = async (): Promise<void> => {
    if (!pass()) return;
    error.set(""); busy.set(true);
    try { if (!(await props.vault.unlock(pass()))) error.set(t("Wrong passphrase.")); else pass.set(""); }
    catch (e) { error.set(errText(e)); } finally { busy.set(false); }
  };
  const enter = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); fn(); } };
  const wait = computed(() => Math.ceil(props.vault.waitMs() / 1000));
  return (
    <div class="m-vault-gate">
      <div class="m-vault-mark" aria-hidden="true">{glyph(lock)}</div>
      <If when={() => props.vault.state() === "new"}>
        <h3 class="m-vault-title">{t("Your keys, in your vault")}</h3>
        <ul class="m-vault-points">
          <li>{t("Encrypted with your passphrase (AES-256, PBKDF2 600 000 rounds); only ciphertext is stored, in this browser.")}</li>
          <li>{t("Asked once per browser session; locked after 15 minutes without use and when the browser closes.")}</li>
          <li>{t("Requests go from this browser straight to the provider; usage is billed to your own API account.")}</li>
          <li class="is-warn">{t("There is no recovery: a forgotten passphrase means making a new vault.")}</li>
        </ul>
        <label class="m-vault-field" onKeyDown={enter(() => void create())}><span>{t("Passphrase")}</span>
          <PasswordInput value={pass} autocomplete="new-password" placeholder={t("e.g. a short sentence only you know")} />
        </label>
        <div class="m-vault-meter" data-level={() => strength()} aria-live="polite"><i /><i /><i /><i /><span>{() => (pass() ? t(STRENGTH[strength()]!) : "")}</span></div>
        <label class="m-vault-field" onKeyDown={enter(() => void create())}><span>{t("Again")}</span>
          <PasswordInput value={again} autocomplete="new-password" />
        </label>
        <Button variant="primary" icon={shieldCheck} loading={() => busy()} onClick={() => void create()}>{t("Create the vault")}</Button>
        <Else>
          <h3 class="m-vault-title">{t("The vault is locked")}</h3>
          <p class="m-vault-note">{props.intro ?? t("Enter your passphrase to use your AI keys.")}</p>
          <label class="m-vault-field" onKeyDown={enter(() => void unlock())}><span>{t("Passphrase")}</span>
            <PasswordInput value={pass} autocomplete="current-password" />
          </label>
          <Button variant="primary" icon={keyIcon} loading={() => busy()} disabled={() => wait() > 0 || !pass()} onClick={() => void unlock()}>
            {() => (wait() > 0 ? t`Wait ${wait()} s` : t("Unlock"))}
          </Button>
          <If when={() => !confirmReset()}>
            <button type="button" class="m-vault-link" onClick={() => confirmReset.set(true)}>{t("Forgot the passphrase?")}</button>
            <Else>
              <Alert tone="danger" title={t("Delete the vault?")} body={t("Every key in it is deleted; there is no way back. Then you make a new vault.")}
                action={[<Button size="sm" variant="danger" icon={trash} onClick={() => { void props.vault.reset(); confirmReset.set(false); }}>{t("Delete everything")}</Button>, <Button size="sm" variant="ghost" onClick={() => confirmReset.set(false)}>{t("Cancel")}</Button>]} />
            </Else>
          </If>
        </Else>
      </If>
      <If when={() => error()}><p class="m-vault-error" role="alert">{() => error()}</p></If>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- the keys panel
interface Row { has: boolean; masked: string; models: string[]; state: "none" | "ok" | "error" | "checking"; msg: string }
/** The AI keys panel: the vault gate, then a row per provider. */
export function AiKeysPanel(props: { vault: Vault; keys: AiKeys; onChange?: () => void }) {
  const rows = signal<Record<string, Row>>({}), settings = signal<AiSettings>({ models: {}, consent: {} });
  const draft = signal<Record<string, string>>({}), changing = signal(false);
  const oldPass = signal(""), newPass = signal(""), passMsg = signal("");
  const row = (id: string): Row => rows()[id] ?? { has: false, masked: "", models: providerOf(id).models, state: "none", msg: "" };
  const patch = (id: string, r: Partial<Row>): void => void rows.set({ ...untrack(rows), [id]: { ...row(id), ...untrack(rows)[id], ...r } });
  const load = async (): Promise<void> => {
    if (props.vault.state() !== "unlocked") return;
    const [have, s] = await Promise.all([props.keys.configured(), props.keys.settings()]);
    settings.set(s);
    for (const p of PROVIDERS) {
      const k = have.includes(p.id) ? await props.keys.get(p.id) : undefined;
      const cur = untrack(rows)[p.id];
      patch(p.id, { has: !!k, masked: k ? maskKey(k) : "", models: cur?.models.length ? cur.models : p.models, ...(k ? {} : { state: "none", msg: "" }) });
    }
  };
  effect(() => { if (props.vault.state() === "unlocked") void load(); });
  const changed = (): void => { props.onChange?.(); };
  const check = async (id: string, key: string, save: boolean): Promise<void> => {
    patch(id, { state: "checking", msg: "" });
    try {
      const models = await listModels(id, key);
      if (save) await props.keys.set(id, key);
      const s = untrack(settings);
      const model = s.models[id] && models.includes(s.models[id]!) ? s.models[id]! : models[0] ?? providerOf(id).models[0];
      settings.set(await props.keys.saveSettings({ models: { ...s.models, ...(model ? { [id]: model } : {}) }, ...(s.provider ? {} : { provider: id }) }));
      patch(id, { has: true, masked: maskKey(key), models: models.length ? models : providerOf(id).models, state: "ok", msg: t`${models.length} models` });
      draft.set({ ...untrack(draft), [id]: "" });
      changed();
    } catch (e) {
      patch(id, { state: "error", msg: errText(e) });
    }
  };
  const save = (id: string): void => { const k = (untrack(draft)[id] ?? "").trim(); if (k) void check(id, k, true); };
  const retest = async (id: string): Promise<void> => { const k = await props.keys.get(id); if (k) await check(id, k, false); };
  const remove = async (id: string): Promise<void> => {
    await props.keys.remove(id);
    const s = untrack(settings);
    if (s.provider === id) { const next = (await props.keys.configured())[0]; settings.set(await props.keys.saveSettings(next ? { provider: next } : {})); }
    patch(id, { has: false, masked: "", state: "none", msg: "" });
    changed();
  };
  const setDefault = async (id: string): Promise<void> => { settings.set(await props.keys.saveSettings({ provider: id })); changed(); };
  const setModel = async (id: string, m: string): Promise<void> => { const s = untrack(settings); settings.set(await props.keys.saveSettings({ models: { ...s.models, [id]: m } })); changed(); };
  const changePass = async (): Promise<void> => {
    passMsg.set("");
    if (passStrength(newPass()) < 2) { passMsg.set(t("Choose a longer passphrase: 10+ characters, letters and digits (a short sentence is best).")); return; }
    try { await props.vault.changePassphrase(oldPass(), newPass()); oldPass.set(""); newPass.set(""); changing.set(false); passMsg.set(t("The passphrase is changed.")); }
    catch (e) { passMsg.set(errText(e)); }
  };
  const hint = (id: string): string => {
    const k = draft()[id] ?? "", like = k.length > 6 ? keyLooksLike(k) : null;
    return like && like !== id ? t`This looks like a ${providerOf(like).name} key.` : "";
  };
  return (
    <div class="m-ai-keys">
      <If when={() => props.vault.state() === "unlocked"}>
        <div class="m-ai-keys-bar">
          <StatusDot tone="success" label={t("Vault open")} />
          <span class="m-ai-keys-note">{t("Keys stay encrypted in this browser; usage is billed to your own accounts.")}</span>
          <span class="m-app-fill" />
          <Button size="sm" variant="ghost" onClick={() => changing.set(!changing())}>{t("Change passphrase")}</Button>
          <Button size="sm" icon={lock} onClick={() => props.vault.lock()}>{t("Lock")}</Button>
        </div>
        <If when={() => changing()}>
          <div class="m-ai-keys-pass">
            <PasswordInput value={oldPass} autocomplete="current-password" placeholder={t("Current passphrase")} />
            <PasswordInput value={newPass} autocomplete="new-password" placeholder={t("New passphrase")} />
            <Button size="sm" variant="primary" onClick={() => void changePass()}>{t("Change")}</Button>
          </div>
        </If>
        <If when={() => passMsg()}><p class="m-vault-note" role="status">{() => passMsg()}</p></If>
        <ul class="m-ai-keys-list">
          <For each={PROVIDERS} key="id">{(p: () => AiProvider) => {
            const id = p().id;
            const r = (): Row => row(id);
            return (
              <li class="m-ai-key" class:is-set={() => r().has} class:is-default={() => settings().provider === id}>
                <div class="m-ai-key-head">
                  <StatusDot tone={() => (r().state === "error" ? "danger" : r().has ? "success" : "neutral")} pulse={() => r().state === "checking"} />
                  <strong class="m-ai-key-name">{p().name}</strong>
                  <If when={() => settings().provider === id}><span class="m-ai-key-badge">{t("default")}</span></If>
                  <If when={() => r().has}><code class="m-ai-key-mask">{() => r().masked}</code></If>
                  <span class="m-app-fill" />
                  <a class="m-ai-key-get" href={p().keyUrl} target="_blank" rel="noopener noreferrer">{t("Get a key")} {glyph(externalLink)}</a>
                </div>
                <If when={() => r().has}>
                  <div class="m-ai-key-tools">
                    <Select class="m-ai-key-model" aria-label={t("Model")} options={r().models} value={settings().models[id] ?? r().models[0] ?? null} onChange={(m) => { if (m) void setModel(id, String(m)); }} />
                    <IconButton icon={refresh} label={t("Check the key")} disabled={() => r().state === "checking"} onClick={() => void retest(id)} />
                    <If when={() => settings().provider !== id}><Button size="sm" variant="ghost" icon={check} onClick={() => void setDefault(id)}>{t("Make default")}</Button></If>
                    <IconButton icon={trash} label={t("Remove the key")} variant="danger" onClick={() => void remove(id)} />
                  </div>
                  <Else>
                    <div class="m-ai-key-tools" onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter" && (e.target as Element).tagName === "INPUT") save(id); }}>
                      <PasswordInput class="m-ai-key-input" value={draft()[id] ?? ""} onChange={(v) => draft.set({ ...untrack(draft), [id]: v })}
                        placeholder={p().keyPrefix ? `${p().keyPrefix}…` : t("API key")} autocomplete="off" aria-label={t`${p().name} API key`}
                      />
                      <Button size="sm" variant="primary" loading={() => r().state === "checking"} disabled={() => !(draft()[id] ?? "").trim()} onClick={() => save(id)}>{t("Check and save")}</Button>
                    </div>
                  </Else>
                </If>
                <If when={() => hint(id)}><p class="m-ai-key-msg is-warn">{() => hint(id)}</p></If>
                <If when={() => r().msg}><p class="m-ai-key-msg" class:is-error={() => r().state === "error"} role={r().state === "error" ? "alert" : "status"}>{() => r().msg}</p></If>
              </li>
            );
          }}</For>
        </ul>
        <Else><VaultGate vault={props.vault} /></Else>
      </If>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- the assistant
/** What the assistant knows about the editor: the open file, the selection, the problems, the last run error. */
export interface AiContext { file?: string | undefined; code?: string | undefined; selection?: string | undefined; problems?: string[] | undefined; error?: string | undefined }
export interface AiChatProps {
  vault: Vault;
  keys: AiKeys;
  /** The editor's state now (read when a message is sent). */
  context?: (() => AiContext) | undefined;
  /** Puts a code block into the file (Apply). */
  apply?: ((file: string, code: string) => void) | undefined;
  /** Opens the AI keys panel. */
  openKeys?: (() => void) | undefined;
  /** The instructions the model gets first. */
  system?: string | undefined;
  /** A signal the plugin sets to send a message from a command ("explain", "fix"…). */
  ask?: (() => { text: string; label?: string; n: number } | null) | undefined;
  /** Bumped when the keys change (the provider list is read again). */
  version?: (() => number) | undefined;
}
interface Msg { role: "user" | "assistant"; content: string; shown?: string; usage?: Usage; model?: string; error?: string; done?: boolean }
const MAX_CODE = 60_000;
/** The parts of an answer: text and fenced code blocks. */
export interface Part { code: boolean; text: string; lang: string }
export function answerParts(s: string): Part[] {
  const out: { code: boolean; text: string; lang: string }[] = [], re = /```([\w+-]*)\n([\s\S]*?)(?:```|$)/g;
  let at = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > at) out.push({ code: false, text: s.slice(at, m.index), lang: "" });
    out.push({ code: true, text: m[2]!.replace(/\n$/, ""), lang: m[1] || "tsx" });
    at = re.lastIndex;
  }
  if (at < s.length) out.push({ code: false, text: s.slice(at), lang: "" });
  return out.filter((p) => p.code || p.text.trim());
}
/** **bold** and `code` in a line of an answer, as nodes (the rest stays text). */
export function inline(s: string): (string | Node)[] {
  return s.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/).filter(Boolean).map((x) => {
    if (x.startsWith("**") && x.endsWith("**") && x.length > 4) { const b = document.createElement("strong"); b.textContent = x.slice(2, -2); return b; }
    if (x.startsWith("`") && x.endsWith("`") && x.length > 2) { const c = document.createElement("code"); c.textContent = x.slice(1, -1); return c; }
    return x;
  });
}
const k = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));

/** The AI chat about the open file. */
export function AiChatPanel(props: AiChatProps) {
  const msgs = signal<Msg[]>([]), input = signal(""), busy = signal(false), consentFor = signal<string | null>(null);
  const settings = signal<AiSettings>({ models: {}, consent: {} }), configured = signal<string[]>([]), withCode = signal(true);
  let stop: AbortController | null = null, pending: [string, string | undefined] | null = null, list!: HTMLElement;
  const load = async (): Promise<void> => {
    if (props.vault.state() !== "unlocked") return;
    const [c, s] = await Promise.all([props.keys.configured(), props.keys.settings()]);
    configured.set(c); settings.set(s);
  };
  effect(() => { props.version?.(); if (props.vault.state() === "unlocked") void load(); });
  const current = computed(() => { const s = settings(), c = configured(); const id = s.provider && c.includes(s.provider) ? s.provider : c[0]; return id ? { id, model: s.models[id] ?? providerOf(id).models[0] ?? "" } : null; });
  const choices = computed(() => configured().map((id) => ({ value: id, label: `${providerOf(id).name.replace(/ \(.*\)$/, "")} · ${settings().models[id] ?? ""}` })));
  const total = computed(() => msgs().reduce((a, m) => ({ input: a.input + (m.usage?.input ?? 0), output: a.output + (m.usage?.output ?? 0) }), { input: 0, output: 0 }));
  const scroll = (): void => { if (list) list.scrollTop = list.scrollHeight; };
  const ctxText = (): string => {
    const c = props.context?.() ?? {};
    const parts: string[] = [];
    if (c.file && withCode() && c.code) parts.push(`Open file: ${c.file}\n\`\`\`tsx\n${c.code.length > MAX_CODE ? `${c.code.slice(0, MAX_CODE)}\n// … (cut)` : c.code}\n\`\`\``);
    else if (c.file) parts.push(`Open file: ${c.file}`);
    if (c.selection) parts.push(`Selected:\n\`\`\`tsx\n${c.selection}\n\`\`\``);
    if (c.problems?.length) parts.push(`Problems:\n${c.problems.slice(0, 30).join("\n")}`);
    if (c.error) parts.push(`Last run error:\n${c.error}`);
    return parts.join("\n\n");
  };
  const sendNow = async (text: string, label?: string): Promise<void> => {
    const cur = untrack(current);
    if (!cur || !text.trim() || untrack(busy)) return;
    // the first request to a provider: the user agrees that the code and the message go there
    if (!untrack(settings).consent[cur.id]) { pending = [text, label]; consentFor.set(cur.id); return; }
    const key = await props.keys.get(cur.id);
    if (!key) { void load(); return; }
    const ctx = ctxText();
    const history: ChatMessage[] = untrack(msgs).filter((m) => !m.error && m.done !== false).map((m) => ({ role: m.role, content: m.content }));
    const user: Msg = { role: "user", content: ctx ? `${ctx}\n\n${text}` : text, shown: label ?? text };
    const answer: Msg = { role: "assistant", content: "", done: false };
    msgs.set([...untrack(msgs), user, answer]);
    input.set(""); busy.set(true);
    stop = new AbortController();
    const at = untrack(msgs).length - 1;
    const put = (m: Partial<Msg>): void => { const all = [...untrack(msgs)]; all[at] = { ...all[at]!, ...m }; msgs.set(all); };
    queueMicrotask(scroll);
    try {
      const r = await chat({ provider: cur.id, key, model: cur.model, system: `${props.system ? `${props.system}\n` : ""}The user's interface language: ${untrack(locale)}; answer in it unless the user writes in another one.`, messages: [...history, { role: "user", content: user.content }], signal: stop.signal,
        onText: (_, all) => { put({ content: all }); scroll(); } });
      put({ content: r.text, usage: r.usage, model: r.model, done: true });
    } catch (e) {
      put({ error: e instanceof AiError && e.code === "abort" ? t("Stopped.") : errText(e), done: true });
    } finally { busy.set(false); stop = null; queueMicrotask(scroll); }
  };
  const agree = async (): Promise<void> => {
    const id = untrack(consentFor);
    if (!id) return;
    settings.set(await props.keys.saveSettings({ consent: { ...untrack(settings).consent, [id]: true } }));
    consentFor.set(null);
    const p = pending; pending = null;
    if (p) void sendNow(p[0], p[1]);
  };
  // a command asked for something ("explain this file")
  let lastAsk = 0;
  effect(() => { const a = props.ask?.(); if (a && a.n !== lastAsk) { lastAsk = a.n; untrack(() => void sendNow(a.text, a.label)); } });
  onCleanup(() => stop?.abort());
  const QUICK: [string, string][] = [
    ["Explain", "Explain what this code does, briefly, step by step."],
    ["Fix", "Find and fix the problems in this file. Reply with the whole fixed file in one code block, then a short list of what changed."],
    ["Write tests", "Write tests for this component with march/testing (test, expect, renderTest) in one code block, as a .test.tsx file."],
    ["Improve", "Suggest improvements (readability, accessibility, March idioms). Reply with the whole improved file in one code block."],
  ];
  return (
    <div class="m-ai">
      <If when={() => props.vault.state() !== "unlocked"}>
        <VaultGate vault={props.vault} intro={t("Enter your passphrase to use the AI with your own keys.")} />
        <Else>
          <If when={() => !current()}>
            <div class="m-ai-empty">
              <div class="m-vault-mark" aria-hidden="true">{glyph(sparkles)}</div>
              <h3 class="m-vault-title">{t("Bring your own AI")}</h3>
              <p class="m-vault-note">{t("Add an API key (Claude, ChatGPT, Gemini, DeepSeek, Kimi, Mistral, Groq or OpenRouter); requests go straight from this browser to the provider and are billed to your account.")}</p>
              <Button variant="primary" icon={keyIcon} onClick={() => props.openKeys?.()}>{t("Add a key")}</Button>
            </div>
            <Else>
              <div class="m-ai-bar">
                <If when={() => choices().length}>
                  <Select class="m-ai-model" aria-label={t("Model")} placeholder={false} options={choices()} value={current()?.id ?? null}
                    onChange={(v) => { if (v) void props.keys.saveSettings({ provider: String(v) }).then((s) => settings.set(s)); }} />
                </If>
                <IconButton icon={keyIcon} label={t("AI keys")} onClick={() => props.openKeys?.()} />
                <span class="m-app-fill" />
                <If when={() => total().input + total().output > 0}>
                  <span class="m-ai-usage" title={t("Tokens used in this chat (billed by the provider)")}>{() => `↑${k(total().input)} ↓${k(total().output)}`}</span>
                </If>
                <IconButton icon={refresh} label={t("New chat")} disabled={() => busy() || !msgs().length} onClick={() => msgs.set([])} />
              </div>
              <div class="m-ai-list" ref={(el: Element) => { list = el as HTMLElement; }} aria-live="polite">
                <If when={() => !msgs().length}>
                  <div class="m-ai-start">
                    <p class="m-vault-note">{t("Ask about the open file, or start with:")}</p>
                    <div class="m-ai-quick">
                      <For each={QUICK}>{(q: () => [string, string]) => <Button size="sm" variant="secondary" onClick={() => void sendNow(q()[1], t(q()[0]))}>{t(q()[0])}</Button>}</For>
                    </div>
                  </div>
                </If>
                <For each={msgs}>{(m: () => Msg) => (
                  <div class="m-ai-msg" class:is-user={() => m().role === "user"} class:is-error={() => !!m().error}>
                    <If when={() => m().role === "user"}>
                      <p class="m-ai-text">{() => m().shown ?? m().content}</p>
                      <Else>
                        <For each={() => answerParts(m().content)}>{(p: () => Part) => (
                          <If when={() => p().code}>
                            <CodeView class="m-ai-code" code={() => p().text} lang={p().lang} copy buttons="icon" label={t("Code")}
                              tools={() => (props.apply && props.context?.().file && m().done ? <Button size="sm" variant="secondary" icon={check} onClick={() => props.apply!(props.context!().file!, p().text)}>{t("Apply")}</Button> : null)} />
                            <Else><p class="m-ai-text">{() => inline(p().text.trim())}</p></Else>
                          </If>
                        )}</For>
                        <If when={() => m().done === false && !m().content}><p class="m-ai-wait" aria-label={t("Thinking")}><i /><i /><i /></p></If>
                        <If when={() => m().error}><p class="m-ai-err" role="alert">{() => m().error}</p></If>
                        <If when={() => m().usage}><p class="m-ai-meta">{() => `${m().model ?? ""} · ↑${k(m().usage!.input)} ↓${k(m().usage!.output)}`}</p></If>
                      </Else>
                    </If>
                  </div>
                )}</For>
              </div>
              <If when={() => consentFor()}>
                <Alert tone="info" title={() => t`Send to ${providerOf(consentFor()!).name}?`}
                  body={t("Your message and the open file go from this browser to the provider; the cost is billed to your API account. Asked once per provider.")}
                  action={[<Button size="sm" variant="primary" icon={send} onClick={() => void agree()}>{t("Send")}</Button>, <Button size="sm" variant="ghost" onClick={() => { consentFor.set(null); pending = null; }}>{t("Cancel")}</Button>]} />
              </If>
              <div class="m-ai-input">
                <Textarea value={input} rows={2} autosize placeholder={t("Ask about this file… (Enter sends, Shift+Enter: new line)")} aria-label={t("Message")}
                  onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); void sendNow(input()); } }} />
                <div class="m-ai-input-tools">
                  <label class="m-ai-ctx"><input type="checkbox" checked={() => withCode()} onChange={(e: Event) => withCode.set((e.target as HTMLInputElement).checked)} /> {() => t`Include ${props.context?.().file ?? t("the file")}`}</label>
                  <span class="m-app-fill" />
                  <If when={() => busy()}>
                    <Button size="sm" icon={xIcon} onClick={() => stop?.abort()}>{t("Stop")}</Button>
                    <Else><Button size="sm" variant="primary" icon={send} disabled={() => !input().trim()} onClick={() => void sendNow(input())}>{t("Send")}</Button></Else>
                  </If>
                </div>
              </div>
            </Else>
          </If>
        </Else>
      </If>
    </div>
  );
}
