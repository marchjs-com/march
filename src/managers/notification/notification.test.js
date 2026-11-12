// NotificationManager: toast bridge while visible, system notification while hidden, inbox, clicks, request flow.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const shown = [];
class FakeNotification {
  static permission = "default";
  static requestPermission = async () => { FakeNotification.permission = "granted"; return "granted"; };
  constructor(title, opts) { this.title = title; this.opts = opts; shown.push(this); }
  close() { this.closed = true; this.onclose?.(); }
}
globalThis.Notification = FakeNotification;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
const { notifications, configureNotifications, disposeNotifications } = await import("./index.ts");
const { setManagerEmit } = await import("../manager.ts");

test("visible tab or no permission: the toast bridge; the inbox counts unread", () => {
  const toasts = [];
  configureNotifications({ toast: (n) => toasts.push(n) });
  const n = notifications();
  const r = n.notify({ title: "Saved", body: "report.pdf" });
  assert.equal(r.via, "toast");
  assert.equal(toasts[0].title, "Saved");
  assert.equal(n.unread(), 1);
  let clicked = 0;
  n.notify({ title: "New message", onClick: () => clicked++ });
  assert.equal(n.unread(), 2);
  toasts[1].onClick();
  assert.equal(clicked, 1);
  assert.equal(n.unread(), 1, "clicking marks it read");
  n.markRead();
  assert.equal(n.unread(), 0);
  assert.equal(n.inbox().length, 2);
  n.clear();
  assert.equal(n.inbox().length, 0);
});

test("hidden tab with permission: a system notification; click focuses and runs onClick", async () => {
  const events = [];
  const prev = setManagerEmit((e) => events.push(`${e.manager}:${e.type}`));
  const toasts = [];
  configureNotifications({ toast: (n) => toasts.push(n), native: "hidden" });
  const n = notifications();
  assert.equal(await n.request(), "granted");
  document.visibilityState = "visible";
  assert.equal(n.notify({ title: "a" }).via, "toast", "visible: in-app");
  document.visibilityState = "hidden";
  let clicked = 0;
  const r = n.notify({ title: "b", body: "c", tag: "t", onClick: () => clicked++ });
  assert.equal(r.via, "native");
  const sys = shown.at(-1);
  assert.deepEqual([sys.title, sys.opts.body, sys.opts.tag], ["b", "c", "t"]);
  sys.onclick();
  assert.equal(clicked, 1);
  assert.equal(sys.closed, true);
  assert.equal(n.inbox()[0].read, true);
  configureNotifications({ native: "never" });
  assert.equal(notifications().notify({ title: "d" }).via, "toast");
  configureNotifications({ native: "hidden", toast: null });
  document.visibilityState = "visible";
  assert.equal(notifications().notify({ title: "e" }).via, "none", "no bridge, visible tab");
  assert.ok(events.includes("notification:show") && events.includes("notification:click"));
  setManagerEmit(prev);
  disposeNotifications();
});
