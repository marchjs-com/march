// The panels of the vault and AI plugins: "AI keys" (make / open the vault; keys by provider, several each: add,
// check, use, remove; the model and the default provider) and "AI" (a chat about the open file: explain, fix, write tests; answers stream in, code blocks
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
import { TextInput } from "../../forms/text-input/index.ts";
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
import { plus } from "../../../icons/glyphs/plus.ts";
import { VaultError, passLength, type Vault } from "../../../vault/index.ts";
import { PROVIDERS, AiError, chat, listModels, keyLooksLike, maskKey, provider as providerOf, type AiKey, type AiKeys, type AiProvider, type AiSettings, type ChatMessage, type Usage } from "../../../ai/index.ts";

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
      : e.code === "wrong" ? t("The current passphrase is wrong.") : e.code === "hint" ? t("The hint gives the passphrase away: write something that only reminds you of it.") : e.code === "locked" ? t("The vault is locked.") : e.code === "exists" ? t("The vault already exists.") : t("There is no vault yet.");
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
  const pass = signal(""), again = signal(""), hint = signal(""), busy = signal(false), error = signal(""), confirmReset = signal(false);
  const strength = computed(() => passStrength(pass()));
  const create = async (): Promise<void> => {
    error.set("");
    if (strength() < 2) { error.set(t("Choose a longer passphrase: 10+ characters, letters and digits (a short sentence is best).")); return; }
    if (pass() !== again()) { error.set(t("The passphrases do not match.")); return; }
    busy.set(true);
    try { await props.vault.create(pass(), { hint: hint() }); pass.set(""); again.set(""); hint.set(""); } catch (e) { error.set(errText(e)); } finally { busy.set(false); }
  };
  // unlocking: tried as soon as the typed text is as long as the passphrase (the vault keeps its length), or on Enter
  let tried = "";
  const unlock = async (): Promise<void> => {
    const p = untrack(pass);
    if (!p || untrack(busy) || p === tried) return;
    tried = p; error.set(""); busy.set(true);
    try { if (!(await props.vault.unlock(p))) error.set(t("Wrong passphrase.")); else { pass.set(""); tried = ""; } }
    catch (e) { error.set(errText(e)); tried = ""; } finally { busy.set(false); }
  };
  const need = (): number | undefined => props.vault.info().length;
  const typed = computed(() => passLength(pass()));
  // (it reads the text, not only its length: a corrected letter at the same length is tried again)
  effect(() => { const n = need(), p = pass(); if (n && p && passLength(p) === n && props.vault.state() === "locked" && props.vault.waitMs() === 0) untrack(() => void unlock()); });
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
        <label class="m-vault-field" onKeyDown={enter(() => void create())}><span>{t("Hint (optional)")}</span>
          <TextInput value={hint} placeholder={t("Something that reminds you, never the passphrase")} />
        </label>
        <p class="m-vault-note">{t("Unlocking needs no button: it opens the moment the passphrase is typed in full (the vault keeps its length; the hint is shown above it, unencrypted).")}</p>
        <Button variant="primary" icon={shieldCheck} loading={() => busy()} onClick={() => void create()}>{t("Create the vault")}</Button>
        <Else>
          <h3 class="m-vault-title">{t("The vault is locked")}</h3>
          <p class="m-vault-note">{props.intro ?? t("Enter your passphrase to use your AI keys.")}</p>
          <If when={() => props.vault.info().hint}><p class="m-vault-hint"><b>{t("Hint")}:</b> {() => props.vault.info().hint}</p></If>
          <label class="m-vault-field" onKeyDown={enter(() => { tried = ""; void unlock(); })}><span>{t("Passphrase")}</span>
            <PasswordInput value={pass} autocomplete="current-password" disabled={wait() > 0} />
          </label>
          <If when={() => need()} fallback={() => (
            <Button variant="primary" icon={keyIcon} loading={() => busy()} disabled={() => wait() > 0 || !pass()} onClick={() => { tried = ""; void unlock(); }}>
              {() => (wait() > 0 ? t`Wait ${wait()} s` : t("Unlock"))}
            </Button>
          )}>
            <p class="m-vault-count" aria-live="polite" class:is-busy={busy()}>
              {() => (wait() > 0 ? t`Wait ${wait()} s` : busy() ? t("Checking…") : `${typed()} / ${need()}`)}
            </p>
          </If>
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
interface KeyState { state: "ok" | "error" | "checking"; msg: string }
/**
 * The AI keys panel: the vault gate, then the keys. A provider picker on top ("All", or one provider), the keys of the
 * picked ones masked and grouped by provider (each group: the model, the default provider, where to get a key), and
 * "Add": for the picked provider, or (with "All") a provider is chosen first. A provider may have several keys; one is
 * in use.
 */
export function AiKeysPanel(props: { vault: Vault; keys: AiKeys; onChange?: () => void }) {
  const list = signal<readonly AiKey[]>([]), settings = signal<AiSettings>({ models: {}, consent: {}, active: {} });
  const filter = signal<string>("all"), adding = signal(false), addFor = signal<string | null>(null);
  const draftKey = signal(""), draftLabel = signal(""), addState = signal<KeyState | null>(null);
  const states = signal<Record<string, KeyState>>({}), models = signal<Record<string, readonly string[]>>({});
  const confirmDel = signal<string | null>(null), changing = signal(false);
  const oldPass = signal(""), newPass = signal(""), newHint = signal(""), passMsg = signal("");
  const load = async (): Promise<void> => {
    if (props.vault.state() !== "unlocked") return;
    const [l, s] = await Promise.all([props.keys.list(), props.keys.settings()]);
    list.set(l); settings.set(s);
  };
  effect(() => { if (props.vault.state() === "unlocked") void load(); });
  const changed = (): void => { void load(); props.onChange?.(); };
  const setState = (id: string, st: KeyState | null): void => { const all = { ...untrack(states) }; if (st) all[id] = st; else delete all[id]; states.set(all); };
  const count = (p: string): number => list().filter((k) => k.provider === p).length;
  const filterOptions = computed(() => [
    { value: "all", label: t`All (${list().length})` },
    ...PROVIDERS.map((p) => { const n = count(p.id); return { value: p.id, label: n ? `${p.name} (${n})` : p.name }; }),
  ]);
  // the groups shown: with "All", the providers that have a key; else the picked one (also with no key)
  const groups = computed((): AiProvider[] => (filter() === "all" ? PROVIDERS.filter((p) => count(p.id)) : [providerOf(filter())]));
  const modelsOf = (p: string): readonly string[] => models()[p] ?? providerOf(p).models;
  const remember = async (p: string, found: readonly string[]): Promise<void> => {
    if (found.length) models.set({ ...untrack(models), [p]: found });
    const s = untrack(settings), cur = s.models[p];
    if (!cur || (found.length && !found.includes(cur))) {
      const m = found[0] ?? providerOf(p).models[0];
      if (m) settings.set(await props.keys.saveSettings({ models: { ...s.models, [p]: m } }));
    }
  };
  const startAdd = (): void => {
    adding.set(true); draftKey.set(""); draftLabel.set(""); addState.set(null);
    addFor.set(untrack(filter) === "all" ? null : untrack(filter));
  };
  const save = async (): Promise<void> => {
    const p = untrack(addFor), key = untrack(draftKey).trim();
    if (!p) { addState.set({ state: "error", msg: t("Choose a provider first.") }); return; }
    const local = !!providerOf(p).local;
    if (!key && !local) return;
    addState.set({ state: "checking", msg: "" });
    try {
      const found = await listModels(p, key);
      if (untrack(list).some((k) => k.provider === p && k.key === key)) { addState.set({ state: "error", msg: t("This key is already saved.") }); return; }
      const k = await props.keys.add(p, key, untrack(draftLabel));
      await remember(p, found);
      adding.set(false); addState.set(null);
      if (untrack(filter) !== "all") filter.set(p);
      setState(k.id, { state: "ok", msg: t`${found.length} models` });
      changed();
    } catch (e) { addState.set({ state: "error", msg: errText(e) }); }
  };
  const retest = async (k: AiKey): Promise<void> => {
    setState(k.id, { state: "checking", msg: "" });
    try { const found = await listModels(k.provider, k.key); await remember(k.provider, found); setState(k.id, { state: "ok", msg: t`${found.length} models` }); }
    catch (e) { setState(k.id, { state: "error", msg: errText(e) }); }
  };
  const remove = async (k: AiKey): Promise<void> => { confirmDel.set(null); await props.keys.remove(k.id); setState(k.id, null); changed(); };
  const activate = async (k: AiKey): Promise<void> => { await props.keys.activate(k.id); changed(); };
  const setDefault = async (p: string): Promise<void> => { settings.set(await props.keys.saveSettings({ provider: p })); props.onChange?.(); };
  const setModel = async (p: string, m: string): Promise<void> => { const s = untrack(settings); settings.set(await props.keys.saveSettings({ models: { ...s.models, [p]: m } })); props.onChange?.(); };
  const activeOf = (p: string): string | undefined => settings().active[p] ?? list().find((k) => k.provider === p)?.id;
  const changePass = async (): Promise<void> => {
    passMsg.set("");
    if (passStrength(newPass()) < 2) { passMsg.set(t("Choose a longer passphrase: 10+ characters, letters and digits (a short sentence is best).")); return; }
    try { await props.vault.changePassphrase(oldPass(), newPass(), { hint: newHint() }); oldPass.set(""); newPass.set(""); newHint.set(""); changing.set(false); passMsg.set(t("The passphrase is changed.")); }
    catch (e) { passMsg.set(errText(e)); }
  };
  const hint = (): string => {
    const k = draftKey(), like = k.length > 6 ? keyLooksLike(k) : null, p = addFor();
    return like && p && like !== p ? t`This looks like a ${providerOf(like).name} key.` : "";
  };
  const nameOf = (k: AiKey): string => k.label || t`Key ${list().filter((x) => x.provider === k.provider).indexOf(k) + 1}`;
  return (
    <div class="m-ai-keys">
      <If when={() => props.vault.state() === "unlocked"}>
        <div class="m-ai-keys-bar">
          <Select class="m-ai-keys-filter" aria-label={t("Provider")} placeholder={false} options={filterOptions()} value={filter()} onChange={(v) => { filter.set(String(v ?? "all")); if (adding()) startAdd(); }} />
          <Button size="sm" variant="primary" icon={plus} onClick={startAdd}>{t("Add")}</Button>
          <span class="m-app-fill" />
          <Button size="sm" variant="ghost" onClick={() => changing.set(!changing())}>{t("Change passphrase")}</Button>
          <IconButton icon={lock} label={t("Lock")} onClick={() => props.vault.lock()} />
        </div>
        <If when={() => changing()}>
          <div class="m-ai-keys-pass">
            <PasswordInput value={oldPass} autocomplete="current-password" placeholder={t("Current passphrase")} />
            <PasswordInput value={newPass} autocomplete="new-password" placeholder={t("New passphrase")} />
            <TextInput value={newHint} placeholder={t("Hint (optional)")} aria-label={t("Hint (optional)")} />
            <Button size="sm" variant="primary" onClick={() => void changePass()}>{t("Change")}</Button>
          </div>
        </If>
        <If when={() => passMsg()}><p class="m-vault-note m-ai-keys-msg" role="status">{() => passMsg()}</p></If>
        <If when={() => adding()}>
          <form class="m-ai-add" onSubmit={(e: Event) => { e.preventDefault(); void save(); }}>
            <div class="m-ai-add-row">
              <If when={() => filter() === "all"}>
                <Select class="m-ai-add-provider" aria-label={t("Provider")} placeholder={t("Choose a provider")} options={PROVIDERS.map((p) => ({ value: p.id, label: p.name }))} value={addFor()} onChange={(v) => addFor.set(v ? String(v) : null)} />
              </If>
              <TextInput class="m-ai-add-label" value={draftLabel} placeholder={t("Name (optional): work, personal…")} aria-label={t("Name")} />
            </div>
            <div class="m-ai-add-row">
              <PasswordInput class="m-ai-add-key" value={draftKey} autocomplete="off" aria-label={t("API key")}
                placeholder={addFor() && providerOf(addFor()!).local ? t("No key needed (optional)") : addFor() && providerOf(addFor()!).keyPrefix ? `${providerOf(addFor()!).keyPrefix}…` : t("API key")} />
              <Button size="sm" variant="primary" type="submit" loading={() => addState()?.state === "checking"}
                disabled={() => !addFor() || (!draftKey().trim() && !providerOf(addFor()!).local)}>{() => (addFor() && providerOf(addFor()!).local ? t("Connect") : t("Check and save"))}</Button>
              <Button size="sm" variant="ghost" onClick={() => adding.set(false)}>{t("Cancel")}</Button>
            </div>
            <If when={() => addFor()}>
              <p class="m-ai-key-msg">
                <a class="m-ai-key-get" href={providerOf(addFor()!).keyUrl} target="_blank" rel="noopener noreferrer">{() => (providerOf(addFor()!).local ? t("Download") : t("Get a key"))} {glyph(externalLink)}</a>
                {() => (providerOf(addFor()!).hint ? ` · ${t(providerOf(addFor()!).hint!)}` : "")}
              </p>
            </If>
            <If when={() => hint()}><p class="m-ai-key-msg is-warn">{() => hint()}</p></If>
            <If when={() => addState()?.msg}><p class="m-ai-key-msg" class:is-error={addState()?.state === "error"} role="alert">{() => addState()?.msg}</p></If>
          </form>
        </If>
        <If when={() => groups().length} fallback={() => (
          <div class="m-ai-keys-empty">
            <p class="m-vault-note">{t("No keys yet. Add one: requests go from this browser straight to the provider and are billed to your account.")}</p>
            <Button variant="primary" icon={plus} onClick={startAdd}>{t("Add a key")}</Button>
          </div>
        )}>
          <div class="m-ai-groups">
            <For each={groups} key="id">{(gp: () => AiProvider) => {
              const p = gp().id;
              const keysOf = computed(() => list().filter((k) => k.provider === p));
              return (
                <section class="m-ai-group" class:is-default={settings().provider === p}>
                  <header class="m-ai-group-head">
                    <strong class="m-ai-key-name">{gp().name}</strong>
                    <If when={() => settings().provider === p}><span class="m-ai-key-badge">{t("default")}</span></If>
                    <span class="m-app-fill" />
                    <If when={() => keysOf().length}>
                      <Select class="m-ai-key-model" aria-label={t("Model")} placeholder={false} options={modelsOf(p)} value={settings().models[p] ?? modelsOf(p)[0] ?? null} onChange={(m) => { if (m) void setModel(p, String(m)); }} />
                      <If when={() => settings().provider !== p}><Button size="sm" variant="ghost" icon={check} onClick={() => void setDefault(p)}>{t("Make default")}</Button></If>
                    </If>
                    <a class="m-ai-key-get" href={gp().keyUrl} target="_blank" rel="noopener noreferrer">{gp().local ? t("Download") : t("Get a key")} {glyph(externalLink)}</a>
                  </header>
                  <If when={() => keysOf().length} fallback={() => <p class="m-ai-key-msg">{gp().hint ? t(gp().hint!) : t("No key for this provider yet.")}</p>}>
                    <ul class="m-ai-key-list">
                      <For each={keysOf} key="id">{(k: () => AiKey) => {
                        const st = (): KeyState | undefined => states()[k().id];
                        const used = (): boolean => activeOf(p) === k().id;
                        return (
                          <li class="m-ai-key" class:is-used={used()}>
                            <StatusDot tone={st()?.state === "error" ? "danger" : used() ? "success" : "neutral"} pulse={st()?.state === "checking"} />
                            <span class="m-ai-key-label">{() => nameOf(k())}</span>
                            <code class="m-ai-key-mask">{() => (k().key ? maskKey(k().key) : t("no key"))}</code>
                            <If when={() => used() && keysOf().length > 1}><span class="m-ai-key-badge">{t("in use")}</span></If>
                            <span class="m-app-fill" />
                            <If when={() => !used()}><Button size="sm" variant="ghost" onClick={() => void activate(k())}>{t("Use")}</Button></If>
                            <IconButton icon={refresh} label={t("Check the key")} disabled={st()?.state === "checking"} onClick={() => void retest(k())} />
                            <If when={() => confirmDel() === k().id} fallback={() => <IconButton icon={trash} label={t("Remove the key")} onClick={() => confirmDel.set(k().id)} />}>
                              <Button size="sm" variant="danger" onClick={() => void remove(k())}>{t("Remove?")}</Button>
                              <IconButton icon={xIcon} label={t("Cancel")} onClick={() => confirmDel.set(null)} />
                            </If>
                            <If when={() => st()?.msg}><p class="m-ai-key-msg" class:is-error={st()?.state === "error"} role={st()?.state === "error" ? "alert" : "status"}>{() => st()?.msg}</p></If>
                          </li>
                        );
                      }}</For>
                    </ul>
                  </If>
                </section>
              );
            }}</For>
          </div>
        </If>
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
  /** The instructions the model gets first: a text, or a function that gives it (loaded once, on the first send). */
  system?: string | (() => string | Promise<string>) | undefined;
  /** A signal the plugin sets to send a message from a command ("explain", "fix"…). */
  ask?: (() => { text: string; label?: string; n: number } | null) | undefined;
  /** Reference text for one message (the docs of what it uses): sent with that message only, not kept in the history. */
  reference?: ((text: string, context: AiContext) => Promise<string>) | undefined;
  /** Bumped when the keys change (the provider list is read again). */
  version?: (() => number) | undefined;
}
interface Msg { role: "user" | "assistant"; content: string; shown?: string; usage?: Usage; model?: string; error?: string; done?: boolean; cut?: boolean }
/** The answer stopped at the length limit (each provider names it its own way). */
const isCut = (stop: string | undefined): boolean => stop === "max_tokens" || stop === "length" || stop === "MAX_TOKENS";
/** The longest answer asked for (a whole file fits; a longer one goes on with Continue). */
const MAX_ANSWER = 16_000;
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
  const settings = signal<AiSettings>({ models: {}, consent: {}, active: {} }), configured = signal<string[]>([]), withCode = signal(true);
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
  // the instructions: read once (a long guide is fetched on the first send, then kept)
  let sys: Promise<string> | null = null;
  const systemText = (): Promise<string> => (sys ??= Promise.resolve(typeof props.system === "function" ? props.system() : props.system ?? "").catch(() => { sys = null; return ""; }));
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
    const ref = props.reference ? await props.reference(`${text}\n${ctx}`, props.context?.() ?? {}).catch(() => "") : "";
    await run(cur, key, untrack(msgs).length - 1, [...history, { role: "user", content: ref ? `${ref}\n\n${user.content}` : user.content }], "");
  };
  /** Asks and streams the answer into message `at`, after `before` (the text it already has: a continuation). */
  const run = async (cur: { id: string; model: string }, key: string, at: number, messages: ChatMessage[], before: string): Promise<void> => {
    busy.set(true);
    stop = new AbortController();
    const put = (m: Partial<Msg>): void => { const all = [...untrack(msgs)]; all[at] = { ...all[at]!, ...m }; msgs.set(all); };
    const was = untrack(msgs)[at]?.usage;
    queueMicrotask(scroll);
    try {
      const base = await systemText();
      const r = await chat({ provider: cur.id, key, model: cur.model, maxTokens: MAX_ANSWER, system: `${base ? `${base}\n\n` : ""}The user's interface language: ${untrack(locale)}; answer in it unless the user writes in another one.`, messages, signal: stop.signal,
        onText: (_, all) => { put({ content: before + all }); scroll(); } });
      const usage = was ? { input: was.input + r.usage.input, output: was.output + r.usage.output, ...((was.cached ?? 0) + (r.usage.cached ?? 0) ? { cached: (was.cached ?? 0) + (r.usage.cached ?? 0) } : {}) } : r.usage;
      put({ content: before + r.text, usage, model: r.model, done: true, cut: isCut(r.stop) });
    } catch (e) {
      put({ error: e instanceof AiError && e.code === "abort" ? t("Stopped.") : errText(e), done: true });
    } finally { busy.set(false); stop = null; queueMicrotask(scroll); }
  };
  /** An answer cut at the length limit goes on in the same message (the model is told where it stopped). */
  const goOn = async (at: number): Promise<void> => {
    const cur = untrack(current), key = cur ? await props.keys.get(cur.id) : undefined, all = untrack(msgs), m = all[at];
    if (!cur || !key || !m || untrack(busy)) return;
    const history: ChatMessage[] = all.slice(0, at).filter((x) => !x.error).map((x) => ({ role: x.role, content: x.content }));
    const open = (m.content.match(/```/g)?.length ?? 0) % 2 === 1;
    const ask = `Your answer stopped at the length limit. Continue exactly where it stopped: no repeat, no preface${open ? ", and you are inside a code block: go on with its code (do not open a new block), then close it" : ""}.`;
    const all2 = [...all]; all2[at] = { ...m, done: false, cut: false }; msgs.set(all2);
    await run(cur, key, at, [...history, { role: "assistant", content: m.content }, { role: "user", content: ask }], m.content);
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
        <div class="m-ai-empty">
          <div class="m-vault-mark" aria-hidden="true">{glyph(lock)}</div>
          <h3 class="m-vault-title">{() => (props.vault.state() === "new" ? t("Bring your own AI") : t("The vault is locked"))}</h3>
          <p class="m-vault-note">{() => (props.vault.state() === "new"
            ? t("Add an API key (Claude, ChatGPT, Gemini, DeepSeek, Kimi, Mistral, Groq, OpenRouter or Meta (Muse)); requests go straight from this browser to the provider and are billed to your account.")
            : t("Open the vault in AI keys; the chat is ready here as soon as it is open."))}</p>
          <Button variant="primary" icon={keyIcon} onClick={() => props.openKeys?.()}>{() => (props.vault.state() === "new" ? t("Add a key") : t("Open AI keys"))}</Button>
        </div>
        <Else>
          <If when={() => !current()}>
            <div class="m-ai-empty">
              <div class="m-vault-mark" aria-hidden="true">{glyph(sparkles)}</div>
              <h3 class="m-vault-title">{t("Bring your own AI")}</h3>
              <p class="m-vault-note">{t("Add an API key (Claude, ChatGPT, Gemini, DeepSeek, Kimi, Mistral, Groq, OpenRouter or Meta (Muse)); requests go straight from this browser to the provider and are billed to your account.")}</p>
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
                              tools={() => (props.apply && props.context?.().file && m().done && !m().cut ? <Button size="sm" variant="secondary" icon={check} onClick={() => props.apply!(props.context!().file!, p().text)}>{t("Apply")}</Button> : null)} />
                            <Else><p class="m-ai-text">{() => inline(p().text.trim())}</p></Else>
                          </If>
                        )}</For>
                        <If when={() => m().done === false && !m().content}><p class="m-ai-wait" aria-label={t("Thinking")}><i /><i /><i /></p></If>
                        <If when={() => m().error}><p class="m-ai-err" role="alert">{() => m().error}</p></If>
                        <If when={() => m().cut}>
                          <div class="m-ai-cut"><span>{t("The answer reached the length limit.")}</span>
                            <Button size="sm" variant="primary" disabled={() => busy()} onClick={() => void goOn(msgs().indexOf(m()))}>{t("Continue")}</Button></div>
                        </If>
                        <If when={() => m().usage}><p class="m-ai-meta">{() => `${m().model ?? ""} · ↑${k(m().usage!.input)}${m().usage!.cached ? ` (${k(m().usage!.cached!)} ${t("cached")})` : ""} ↓${k(m().usage!.output)}`}</p></If>
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
