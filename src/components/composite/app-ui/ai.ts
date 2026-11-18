// The vault and AI plugins of march-app-ui. vaultPlugin: the user's encrypted vault (march/vault; service "vault") and
// the "AI keys" panel (a key per provider, checked against the provider, a model each, a default). aiPlugin: the "AI"
// panel (a chat about the open file with the user's own key; service "ai"), and commands: explain the file, fix it,
// write its tests, ask about the selection. The host says what the editor has (`context`) and how a code block goes
// into a file (`apply`).
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { key as keyIcon } from "../../../icons/glyphs/key.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";
import { lock } from "../../../icons/glyphs/lock.ts";
import { createVault, type Vault, type VaultOptions } from "../../../vault/index.ts";
import { aiKeys, chat, type AiKeys, type ChatRequest, type ChatResult } from "../../../ai/index.ts";
import { definePlugin, type AppPlugin } from "./kit.ts";
import type { DockPanel } from "../dock-layout/index.ts";
import type { AiContext, AiChatProps } from "./ai-panels.tsx";

// the panels load when one is first shown (a chunk of its own; nothing of them in the page's start)
const panels = (): Promise<typeof import("./ai-panels.tsx")> => import("./ai-panels.tsx");
async function KeysPanel(p: { vault: Vault; keys: AiKeys; onChange?: () => void }): Promise<unknown> { const m = await panels(); return h(m.AiKeysPanel, p); }
async function ChatPanel(p: AiChatProps): Promise<unknown> { const m = await panels(); return h(m.AiChatPanel, p); }

messages("tr", {
  "AI keys": "AI anahtarları", "AI": "AI", "API key": "API anahtarı", "Add a key": "Anahtar ekle",
  "Add an API key (Claude, ChatGPT, Gemini, DeepSeek, Kimi, Mistral, Groq or OpenRouter); requests go straight from this browser to the provider and are billed to your account.":
    "Bir API anahtarı ekle (Claude, ChatGPT, Gemini, DeepSeek, Kimi, Mistral, Groq ya da OpenRouter); istekler bu tarayıcıdan doğrudan sağlayıcıya gider, ücreti senin hesabından düşer.",
  "Again": "Tekrar", "Apply": "Uygula", "Ask about the open file, or start with:": "Açık dosyayı sor ya da şununla başla:",
  "Ask about this file… (Enter sends, Shift+Enter: new line)": "Bu dosya hakkında sor… (Enter gönderir, Shift+Enter: yeni satır)",
  "Asked once per browser session; locked after 15 minutes without use and when the browser closes.": "Tarayıcı oturumunda bir kez sorulur; 15 dakika kullanılmazsa ve tarayıcı kapanınca kilitlenir.",
  "Bring your own AI": "Kendi AI'ını getir", "Cancel": "Vazgeç", "Change passphrase": "Parolayı değiştir", "Change": "Değiştir",
  "Check and save": "Dene ve kaydet", "Check the key": "Anahtarı dene",
  "Choose a longer passphrase: 10+ characters, letters and digits (a short sentence is best).": "Daha uzun bir parola seç: 10+ karakter, harf ve rakam (en iyisi kısa bir cümle).",
  "Code": "Kod", "Create the vault": "Kasayı oluştur", "Current passphrase": "Şimdiki parola", "Delete everything": "Hepsini sil", "Delete the vault?": "Kasa silinsin mi?",
  "Encrypted with your passphrase (AES-256, PBKDF2 600 000 rounds); only ciphertext is stored, in this browser.": "Parolanla şifrelenir (AES-256, PBKDF2 600 000 tur); bu tarayıcıda yalnız şifreli hâli durur.",
  "Enter your passphrase to use your AI keys.": "AI anahtarlarını kullanmak için parolanı gir.",
  "Every key in it is deleted; there is no way back. Then you make a new vault.": "İçindeki bütün anahtarlar silinir, geri dönüşü yok. Sonra yeni bir kasa oluşturursun.",
  "Forgot the passphrase?": "Parolanı mı unuttun?", "Get a key": "Anahtar al",
  "Keys stay encrypted in this browser; usage is billed to your own accounts.": "Anahtarlar bu tarayıcıda şifreli durur; kullanım kendi hesaplarından ücretlenir.",
  "Lock": "Kilitle", "Make default": "Varsayılan yap", "Message": "Mesaj", "Model": "Model", "New chat": "Yeni sohbet", "New passphrase": "Yeni parola",
  "Passphrase": "Parola", "Remove the key": "Anahtarı sil",
  "Requests go from this browser straight to the provider; usage is billed to your own API account.": "İstekler bu tarayıcıdan doğrudan sağlayıcıya gider; kullanım kendi API hesabından ücretlenir.",
  "Send": "Gönder", "Stop": "Durdur", "Stopped.": "Durduruldu.", "The passphrase is changed.": "Parola değişti.", "The passphrases do not match.": "Parolalar aynı değil.",
  "The vault is locked": "Kasa kilitli", "There is no recovery: a forgotten passphrase means making a new vault.": "Kurtarma yok: parolayı unutursan yeni bir kasa oluşturman gerekir.",
  "Thinking": "Düşünüyor", "Tokens used in this chat (billed by the provider)": "Bu sohbette harcanan token (sağlayıcı ücretlendirir)", "Unlock": "Aç", "Vault open": "Kasa açık",
  "Wrong passphrase.": "Parola yanlış.", "Your keys, in your vault": "Anahtarların, kendi kasanda",
  "Your message and the open file go from this browser to the provider; the cost is billed to your API account. Asked once per provider.":
    "Mesajın ve açık dosya bu tarayıcıdan sağlayıcıya gider; ücreti senin API hesabından düşer. Her sağlayıcı için bir kez sorulur.",
  "default": "varsayılan", "e.g. a short sentence only you know": "ör. yalnız senin bildiğin kısa bir cümle",
  "{0} models": "{0} model", "{0} API key": "{0} API anahtarı", "Include {0}": "{0} eklensin", "the file": "dosya", "Send to {0}?": "{0} sağlayıcısına gönderilsin mi?",
  "This looks like a {0} key.": "Bu bir {0} anahtarına benziyor.", "Wait {0} s": "{0} sn bekle", "Too many wrong tries; wait {0} s.": "Çok fazla yanlış deneme; {0} sn bekle.",
  "The current passphrase is wrong.": "Şimdiki parola yanlış.", "The vault is locked.": "Kasa kilitli.", "The vault already exists.": "Kasa zaten var.", "There is no vault yet.": "Henüz kasa yok.",
  "the key was refused (check it, or make a new one)": "anahtar reddedildi (kontrol et ya da yenisini oluştur)",
  "the rate limit was hit; try again in a moment": "istek sınırına takıldı; birazdan yeniden dene", "the account's balance or quota is used up": "hesabın bakiyesi ya da kotası bitti",
  "Too short": "Çok kısa", "Weak": "Zayıf", "Fair": "İdare eder", "Good": "İyi", "Strong": "Güçlü",
  "Explain": "Açıkla", "Fix": "Düzelt", "Write tests": "Test yaz", "Improve": "İyileştir",
  "Lock the vault": "Kasayı kilitle", "AI: explain the file": "AI: dosyayı açıkla", "AI: fix the file": "AI: dosyayı düzelt", "AI: write tests": "AI: test yaz",
  "AI: ask about the selection": "AI: seçimi sor", "cached": "önbellekten", "The answer reached the length limit.": "Yanıt uzunluk sınırına ulaştı.", "Continue": "Devam et", "Open AI keys": "AI anahtarlarını aç", "Open the vault in AI keys; the chat is ready here as soon as it is open.": "Kasayı AI anahtarları sekmesinde aç; açılınca sohbet burada hazır olur.",
});

/** What the vault plugin provides (service "vault"): the vault and the AI keys in it. */
export interface VaultService { vault: Vault; keys: AiKeys; /** Bumped when a key or a choice changes. */ version: () => number }
export interface VaultPluginOptions extends VaultOptions {
  /** The keys panel (id "ai-keys"); false: the service only. */
  panel?: { id?: string; title?: string; place?: DockPanel["place"] } | false | undefined;
}
/** `<AppUI plugins={[vaultPlugin(), aiPlugin({ context, apply }), …]}>` */
export function vaultPlugin(o: VaultPluginOptions = {}): AppPlugin {
  return definePlugin({
    id: "march.vault", title: "Vault", version: "1.0.0",
    activate(ctx) {
      const vault = createVault(o), keys = aiKeys(vault), version = signal(0);
      const svc: VaultService = { vault, keys, version: () => version() };
      ctx.provide("vault", svc);
      ctx.command({ id: "vault.lock", title: () => t("Lock the vault"), group: "AI", icon: lock, when: () => vault.state() === "unlocked", run: () => vault.lock() });
      if (o.panel !== false) {
        const p = o.panel ?? {};
        ctx.panel({ id: p.id ?? "ai-keys", title: p.title ?? t("AI keys"), icon: keyIcon, ...(p.place ? { place: p.place } : {}),
          content: () => h(KeysPanel, { vault, keys, onChange: () => { version.set(version.peek() + 1); ctx.emit("ai:keys"); } }) });
      }
    },
  });
}

/** What the AI plugin provides (service "ai"): a chat with the default provider and model. */
export interface AiService {
  /** Sends to the default provider / model (the vault must be open; the first send to a provider asks in the panel). */
  chat(r: Omit<ChatRequest, "provider" | "key" | "model"> & { provider?: string; model?: string }): Promise<ChatResult>;
  /** Opens the AI panel and sends a message there (`label`: what the chat shows for it). */
  ask(text: string, label?: string): void;
}
export interface AiPluginOptions {
  /** The editor's state: the open file, its code, the selection, the problems, the last run error. */
  context?: (() => AiContext) | undefined;
  /** Puts a code block into a file (the Apply button). */
  apply?: ((file: string, code: string) => void) | undefined;
  /** Opens a panel by id (the host's dock): the AI panel for a command, the keys panel for "Add a key". */
  open?: ((id: string) => void) | undefined;
  /** The instructions the model gets first (the framework, the house rules): a text, or a function that loads it (once, on the first send). */
  system?: string | (() => string | Promise<string>) | undefined;
  /** The panel (id "ai"). */
  panel?: { id?: string; title?: string; place?: DockPanel["place"] } | undefined;
  /** Reference text for a message (the docs of the names it uses), sent with that message only. */
  reference?: ((text: string, context: AiContext) => Promise<string>) | undefined;
  /** The keys panel's id (default "ai-keys"). */
  keysPanel?: string | undefined;
}
/** `<AppUI plugins={[vaultPlugin(), aiPlugin({ context, apply, open }), …]}>`: the AI panel (a chat about the open file with the user's own key) and its commands. */
export function aiPlugin(o: AiPluginOptions = {}): AppPlugin {
  return definePlugin({
    id: "march.ai", title: "AI", version: "1.0.0", requires: ["march.vault"],
    activate(ctx) {
      const v = ctx.service<VaultService>("vault")!;
      const panelId = o.panel?.id ?? "ai", asked = signal<{ text: string; label?: string; n: number } | null>(null);
      let n = 0;
      const svc: AiService = {
        async chat(r) {
          const s = await v.keys.settings(), id = r.provider ?? s.provider ?? (await v.keys.configured())[0];
          if (!id) throw new Error(t("Add a key"));
          const key = (await v.keys.get(id)) ?? "";
          return chat({ ...r, provider: id, key, model: r.model ?? s.models[id] ?? "" });
        },
        ask(text, label) { o.open?.(panelId); asked.set({ text, ...(label ? { label } : {}), n: ++n }); },
      };
      ctx.provide("ai", svc);
      ctx.panel({ id: panelId, title: o.panel?.title ?? t("AI"), icon: sparkles, ...(o.panel?.place ? { place: o.panel.place } : {}),
        content: () => h(ChatPanel, { vault: v.vault, keys: v.keys, context: o.context, apply: o.apply, system: o.system, reference: o.reference, ask: () => asked(), version: v.version,
          openKeys: () => o.open?.(o.keysPanel ?? "ai-keys") }) });
      const cmds: [string, string, string, (() => boolean)?][] = [
        ["ai.explain", "AI: explain the file", "Explain what this code does, briefly, step by step."],
        ["ai.fix", "AI: fix the file", "Find and fix the problems in this file. Reply with the whole fixed file in one code block, then a short list of what changed."],
        ["ai.tests", "AI: write tests", "Write tests for this component with march/testing (test, expect, renderTest) in one code block, as a .test.tsx file."],
        ["ai.selection", "AI: ask about the selection", "Explain the selected code and suggest a better version if there is one.", () => !!o.context?.().selection],
      ];
      for (const [id, title, text, when] of cmds) ctx.command({ id, title: () => t(title), group: "AI", icon: sparkles, ...(when ? { when } : {}), run: () => svc.ask(text, t(title).replace(/^AI: /, "")) });
    },
  });
}
export type { AiContext };
