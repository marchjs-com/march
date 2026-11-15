// NotificationManager: one notify() for browser notifications and in-app toasts. While the tab is visible (or the
// browser notification is not allowed) the message goes to the toast bridge; while it is hidden and permission is
// granted, to a system notification. Every message is kept in a small inbox (unread count, history).
//
//   import { notifications } from "march/managers/notification";
//   notifications().notify({ title: "Upload finished", body: "report.pdf", onClick: () => open(…) })
//   button.onclick = () => notifications().request()      // asks only from a click (PermissionManager)
//   configureNotifications({ native: "always" })            // or "never"; toast: (n) => mySnackbar(n)
//
// Events: notification:show ({ id, via: "native" | "toast" }), notification:click ({ id }), notification:read.
import { signal } from "../../core/reactive.ts";
import { t, messages } from "../../core/i18n.ts";
import { toast, type ToastKind } from "../../ui/toast.ts";
import { defineManager, emit } from "../manager.ts";
import { permissions, type RequestResult } from "../permission/index.ts";

messages("tr", { Open: "Aç" });

export interface NotifyOptions {
  title: string;
  body?: string;
  /** Same tag = replaces the previous notification with that tag. */
  tag?: string;
  icon?: string;
  /** Toast tone. Default "info". */
  kind?: ToastKind;
  /** Runs on a click (system notification) or the toast's action button. */
  onClick?: () => void;
  /** Label of the toast action (default "Open"). */
  actionLabel?: string;
  /** Override the config for this message. */
  via?: "auto" | "native" | "toast";
  silent?: boolean;
}
/** A message in the inbox. */
export interface NotificationRecord { id: number; title: string; body: string; kind: ToastKind; at: number; via: "native" | "toast" | "none"; read: boolean }

export interface NotificationConfig {
  /** When a system notification is used: "hidden" (tab not visible, default), "always", "never". */
  native: "hidden" | "always" | "never";
  /** In-app bridge. Default: march toast. null = system notifications only (dropped when not allowed). */
  toast: ((n: NotifyOptions & { id: number }) => void) | null;
  /** Inbox size. Default 50. */
  keep: number;
}

export interface Notifications {
  /** Browser notification permission (reactive). */
  permission(): string;
  /** Ask for the browser permission (from a click). */
  request(): Promise<RequestResult>;
  /** Show a message; returns how it went out. */
  notify(opts: NotifyOptions): NotificationRecord;
  /** Newest first (reactive). */
  inbox(): readonly NotificationRecord[];
  unread(): number;
  markRead(id?: number): void;
  clear(): void;
  dispose(): void;
}

function defaultToast(n: NotifyOptions & { id: number }): void {
  toast(n.body ? `${n.title} — ${n.body}` : n.title, {
    kind: n.kind ?? "info",
    ...(n.onClick ? { action: { label: n.actionLabel ?? t`Open`, run: n.onClick } } : {}),
  });
}

const DEFAULTS: NotificationConfig = { native: "hidden", toast: defaultToast, keep: 50 };

function create(cfg: NotificationConfig): Notifications {
  const inbox = signal<NotificationRecord[]>([], { name: "notification.inbox" });
  const open = new Set<Notification>();
  let seq = 0;
  const N = (globalThis as { Notification?: typeof Notification }).Notification;

  const nativeOk = (via: NotifyOptions["via"]): boolean => {
    if (!N || N.permission !== "granted") return false;
    if (via === "native") return true;
    if (via === "toast") return false;
    return cfg.native === "always" || (cfg.native === "hidden" && globalThis.document?.visibilityState === "hidden");
  };
  const showNative = (id: number, o: NotifyOptions): boolean => {
    try {
      const n = new N!(o.title, { ...(o.body ? { body: o.body } : {}), ...(o.tag ? { tag: o.tag } : {}), ...(o.icon ? { icon: o.icon } : {}), ...(o.silent ? { silent: true } : {}) });
      open.add(n);
      n.onclose = () => open.delete(n);
      n.onclick = () => { globalThis.focus?.(); emit("notification", "click", { id }); markRead(id); o.onClick?.(); n.close(); };
      return true;
    } catch { return false; } // Android Chrome: only through a service worker registration
  };
  const markRead = (id?: number): void => {
    inbox.update((l) => l.map((r) => (id === undefined || r.id === id) && !r.read ? { ...r, read: true } : r));
    emit("notification", "read", { id: id ?? "all" });
  };

  return {
    permission: () => permissions().state("notifications"),
    request: () => permissions().request("notifications"),
    notify(o) {
      const id = ++seq;
      let via: NotificationRecord["via"] = "none";
      if (nativeOk(o.via) && showNative(id, o)) via = "native";
      else if (cfg.toast && o.via !== "native") {
        const onClick = o.onClick;
        cfg.toast({ ...o, id, ...(onClick ? { onClick: () => { emit("notification", "click", { id }); markRead(id); onClick(); } } : {}) });
        via = "toast";
      }
      const rec: NotificationRecord = { id, title: o.title, body: o.body ?? "", kind: o.kind ?? "info", at: Date.now(), via, read: false };
      inbox.update((l) => [rec, ...l].slice(0, cfg.keep));
      emit("notification", "show", { id, via });
      return rec;
    },
    inbox,
    unread: () => inbox().filter((r) => !r.read).length,
    markRead,
    clear: () => inbox.set([]),
    dispose() { for (const n of open) n.close(); open.clear(); },
  };
}

const manager = defineManager<Notifications, NotificationConfig>("notification", create, DEFAULTS);
/** The notification manager (created on first call; asks nothing until request()). */
export const notifications = (): Notifications => manager.get();
/** Set the notification manager's options (merged into the current config). */
export const configureNotifications = (config: Partial<NotificationConfig>): void => manager.configure(config);
/** Stop the notification manager and remove its listeners; the next call starts it again. */
export const disposeNotifications = (): void => manager.dispose();
/** The notification manager (get, configure, dispose). */
export const notificationManager = manager;
