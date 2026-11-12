// PermissionManager: state from the Permissions API (and its change event), request flows, consent gate, rationale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { permissions, configurePermissions, disposePermissions } = await import("./index.ts");
const { consent, configureConsent } = await import("../consent/index.ts");
// a minimal event target (the fake DOM replaces Event, which Node's own EventTarget rejects)
const target = (props) => { const l = {}; return Object.assign({ addEventListener(t, f) { (l[t] ??= new Set()).add(f); }, removeEventListener(t, f) { l[t]?.delete(f); }, fire(t) { for (const f of [...(l[t] ?? [])]) f(); } }, props); };
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

const statuses = {};
const status = (name, state) => (statuses[name] ??= target({ state }));
let asked = 0;
globalThis.Notification = { permission: "default", requestPermission: async () => { asked++; status("notifications").state = "granted"; globalThis.Notification.permission = "granted"; return "granted"; } };
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
  permissions: { query: async ({ name }) => { if (name === "midi") throw new TypeError("no"); return status(name, "prompt"); } },
  geolocation: { getCurrentPosition: (ok) => ok({ coords: {} }) },
} });

test("state is reactive and follows PermissionStatus change", async () => {
  disposePermissions();
  const p = permissions();
  assert.equal(p.state("camera"), "unsupported", "no mediaDevices");
  assert.equal(p.state("notifications"), "prompt");
  await tick();
  status("notifications").state = "denied";
  status("notifications").fire("change");
  assert.equal(p.state("notifications"), "denied");
  status("notifications").state = "prompt";
  status("notifications").fire("change");
  assert.equal(p.state("notifications"), "prompt");
});

test("request runs the browser flow once; consent and rationale block it", async () => {
  configureConsent({ storageKey: "t.perm.consent" });
  consent.rejectAll();
  configurePermissions({ consent: { notifications: "marketing" } });
  const p = permissions();
  assert.equal(p.consented("notifications"), false);
  assert.equal(await p.request("notifications"), "blocked");
  assert.equal(asked, 0, "no browser prompt without consent");
  consent.acceptAll();
  assert.equal(await p.request("notifications", { rationale: () => false }), "blocked", "declined explanation");
  assert.equal(asked, 0);
  const r = p.request("notifications", { rationale: async () => true });
  assert.equal(p.pending("notifications"), true);
  assert.equal(await r, "granted");
  assert.equal(asked, 1);
  assert.equal(p.state("notifications"), "granted");
  assert.equal(p.allowed("notifications"), true);
  assert.equal(await p.request("notifications"), "granted", "already granted: no prompt");
  assert.equal(asked, 1);
  consent.rejectAll();
  assert.equal(p.allowed("notifications"), false, "consent withdrawn");
});

test("custom requesters and fallback when the API cannot answer", async () => {
  configurePermissions({ consent: {}, requesters: { midi: async () => "granted" } });
  const p = permissions();
  assert.equal(p.state("midi"), "unsupported", "no requestMIDIAccess");
  navigator.requestMIDIAccess = () => Promise.resolve({});
  disposePermissions();
  assert.equal(permissions().state("midi"), "prompt");
  assert.equal(await permissions().request("midi"), "granted");
  assert.equal(await permissions().request("geolocation"), "prompt", "the Permissions API answer wins (still prompt)");
  disposePermissions();
});
