// ConsentManager: record (version, date, storage), gates, listeners, withdrawal, expiry, other tabs, consent: props, UI.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { h, render, effect } = await import("../../index.ts");
const { consent, configureConsent, disposeConsent, DEFAULT_CATEGORIES } = await import("./index.ts");
const { onManager } = await import("../manager.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const fresh = (cfg = {}) => { localStorage.clear(); configureConsent({ version: "1", maxAgeDays: 365, storage: undefined, ...cfg }); };

test("undecided: only required categories; acceptAll / rejectAll / save write a versioned, dated record", () => {
  fresh();
  assert.equal(consent.decided(), false);
  assert.equal(consent.has("necessary"), true, "required is always on");
  assert.equal(consent.has("analytics"), false);
  const r = consent.acceptAll();
  assert.equal(r.method, "all");
  assert.equal(r.version, "1");
  assert.ok(Date.now() - Date.parse(r.date) < 5000);
  assert.deepEqual(JSON.parse(localStorage.getItem("hm.consent")), r, "kept in storage");
  assert.ok(consent.has("analytics") && consent.has("marketing") && consent.has("thirdParty"));
  consent.rejectAll();
  assert.ok(!consent.has("analytics") && consent.has("necessary"));
  const c = consent.save({ analytics: true, necessary: false });
  assert.equal(c.method, "custom");
  assert.deepEqual(c.choices, { necessary: true, preferences: false, analytics: true, marketing: false, thirdParty: false });
});

test("the record survives a restart; a new policy version or an old record asks again", () => {
  fresh();
  consent.save({ preferences: true });
  disposeConsent();
  assert.equal(consent.has("preferences"), true, "loaded from storage");
  configureConsent({ version: "2" });
  assert.equal(consent.decided(), false, "new version: undecided");
  assert.equal(consent.has("preferences"), false);
  const old = { version: "2", date: new Date(Date.now() - 400 * 864e5).toISOString(), choices: { analytics: true }, method: "all" };
  localStorage.setItem("hm.consent", JSON.stringify(old));
  disposeConsent();
  assert.equal(consent.decided(), false, "older than maxAgeDays");
  localStorage.setItem("hm.consent", "{not json");
  disposeConsent();
  assert.equal(consent.decided(), false, "a broken record is ignored");
});

test("has() is reactive; on(category) fires only on a change; gate() blocks; events", () => {
  fresh();
  const events = [];
  const prev = onManager("*", (e) => events.push(e));
  const seen = [];
  const stop = effect(() => seen.push(consent.has("analytics")));
  const changes = [];
  const off = consent.on("analytics", (g) => changes.push(g));
  const any = [];
  consent.on("change", (_g, rec) => any.push(rec?.method ?? null));
  const sent = [];
  const track = consent.gate("analytics", (name) => { sent.push(name); return "sent"; });
  assert.equal(track("page"), undefined, "no consent: not sent");
  consent.save({ marketing: true });
  assert.deepEqual(changes, [], "analytics did not change");
  consent.acceptAll();
  assert.equal(track("click"), "sent");
  consent.withdraw();
  assert.equal(track("again"), undefined);
  assert.deepEqual(sent, ["click"]);
  assert.deepEqual(changes, [true, false]);
  assert.deepEqual(any, ["custom", "all", null]);
  assert.deepEqual(seen, [false, true, false]);
  assert.equal(localStorage.getItem("hm.consent"), null, "withdrawal removes the record");
  assert.ok(events.some((e) => e.manager === "consent" && e.type === "withdraw"));
  assert.ok(events.some((e) => e.type === "change" && e.detail.choices.analytics === true));
  off(); stop(); prev();
});

test("whenGranted(): third-party hooks start on consent and stop on withdrawal; granted() resolves", async () => {
  fresh();
  const log = [];
  const off = consent.whenGranted("thirdParty", () => { log.push("load"); return () => log.push("unload"); });
  assert.deepEqual(log, []);
  const p = consent.granted("thirdParty");
  consent.save({ thirdParty: true });
  await p;
  consent.save({ thirdParty: true, analytics: true });
  assert.deepEqual(log, ["load"], "started once");
  consent.withdraw();
  assert.deepEqual(log, ["load", "unload"]);
  consent.acceptAll();
  off();
  assert.deepEqual(log, ["load", "unload", "load", "unload"], "off() also stops it");
});

test("another tab's decision arrives through the storage event; unknown categories are refused", () => {
  fresh();
  localStorage.setItem("hm.consent", JSON.stringify({ version: "1", date: new Date().toISOString(), choices: { analytics: true }, method: "custom" }));
  const e = new Event("storage"); e.key = "hm.consent";
  window.dispatchEvent(e);
  assert.equal(consent.has("analytics"), true);
  assert.equal(consent.has("nope"), false);
});

test("memory-only storage and custom categories", () => {
  configureConsent({ storage: null, categories: [{ id: "necessary", title: "N", description: "", required: true }, { id: "maps", title: "Maps", description: "" }] });
  localStorage.clear();
  consent.acceptAll();
  assert.equal(localStorage.getItem("hm.consent"), null);
  assert.deepEqual(consent.choices(), { necessary: true, maps: true });
  configureConsent({ storage: undefined, categories: DEFAULT_CATEGORIES });
});

test("consent: props show content only while granted", () => {
  fresh();
  const host = document.createElement("div");
  const off = render(() => [h("div", { id: "map", "consent:thirdParty": true }), h("p", { id: "ph", "consent:thirdParty": false }, "blocked")], host);
  assert.equal(host.querySelector("#map").hidden, true);
  assert.equal(host.querySelector("#ph").hidden, false);
  consent.acceptAll();
  assert.equal(host.querySelector("#map").hidden, false);
  assert.equal(host.querySelector("#ph").hidden, true);
  off();
});

test("UI: banner until decided, Reject all is offered next to Accept all; gate placeholder allows in place; preferences panel saves", async () => {
  fresh();
  const { ConsentBanner, ConsentGate, openConsentPreferences } = await import("./ui.ts");
  const { setLocale, locale } = await import("../../core/i18n.ts");
  await setLocale("tr");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = render(() => [h(ConsentBanner, { inline: true }), h(ConsentGate, { category: "thirdParty" }, h("b", { id: "video" }, "video"))], host);
  const buttons = () => [...host.querySelectorAll("button")].map((b) => b.textContent);
  assert.ok(host.querySelector(".hm-consent"));
  assert.ok(buttons().includes("Tümünü reddet") && buttons().includes("Tümünü kabul et"), "Turkish texts");
  await setLocale("en");
  assert.ok(buttons().includes("Reject all") && buttons().includes("Accept all"), "follows the locale");
  assert.equal(locale(), "en");
  [...host.querySelectorAll(".hm-consent button")].find((b) => b.textContent === "Reject all").click();
  await tick();
  assert.equal(host.querySelector(".hm-consent"), null, "gone after a decision");
  assert.equal(consent.has("analytics"), false);
  assert.equal(host.querySelector("#video"), null);
  [...host.querySelectorAll(".hm-consent-gate button")].find((b) => b.textContent === "Allow").click();
  await tick();
  assert.ok(host.querySelector("#video"), "allowed in place");
  assert.equal(consent.has("thirdParty"), true);

  const done = openConsentPreferences();
  await tick();
  const panel = document.querySelector(".hm-consent-panel");
  assert.ok(panel, "panel open");
  const switches = [...panel.querySelectorAll('[role="switch"]')];
  assert.equal(switches.length, 5);
  assert.equal(switches[0].disabled, true, "necessary is locked");
  switches[2].click(); // analytics on
  [...document.querySelectorAll(".hm-dialog button, .hm-drawer button")].find((b) => b.textContent === "Save choices").click();
  assert.equal(await done, true);
  assert.equal(consent.has("analytics"), true);
  assert.equal(consent.record().method, "custom");
  off(); host.remove();
});

test("UI: a choice on the banner closes it, also with always (demos); showConsentBanner brings it back; withdrawal shows it again", async () => {
  fresh();
  const { ConsentBanner, showConsentBanner } = await import("./ui.ts");
  const { setLocale } = await import("../../core/i18n.ts");
  await setLocale("en");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = render(() => h(ConsentBanner, { inline: true, always: true }), host);
  const click = (label) => [...host.querySelectorAll(".hm-consent button")].find((b) => b.textContent === label).click();
  assert.ok(host.querySelector(".hm-consent"));
  click("Accept all");
  await tick();
  assert.equal(host.querySelector(".hm-consent"), null, "Accept all closes it even with always");
  assert.equal(consent.has("analytics"), true);
  showConsentBanner();
  await tick();
  assert.ok(host.querySelector(".hm-consent"), "shown again on request");
  click("Reject all");
  await tick();
  assert.equal(host.querySelector(".hm-consent"), null, "Reject all closes it");
  assert.equal(consent.has("analytics"), false);
  consent.withdraw();
  await tick();
  assert.ok(host.querySelector(".hm-consent"), "no decision any more: back");
  off(); host.remove();
});

test("UI: the bottom banner sits in the toast band, above dialogs, menus and sticky parts", async () => {
  fresh();
  const fs = await import("node:fs");
  const { ConsentBanner } = await import("./ui.ts");
  const { layers, openLayer } = await import("../../dom/portal.ts");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const closeDialog = openLayer("dialog", document.createElement("div"));
  const off = render(() => h(ConsentBanner, {}), host);
  await tick();
  const banner = document.querySelector(".hm-layer .hm-consent");
  assert.ok(banner, "rendered into a layer, not in the page");
  const layer = layers().find((l) => l.el.contains(banner));
  assert.equal(layer.kind, "toast");
  assert.match(layer.el.style.getPropertyValue("z-index"), /--hm-z-toast/);
  const closeLater = openLayer("dialog", document.createElement("div"));
  assert.match(layer.el.style.getPropertyValue("z-index"), /--hm-z-toast/, "a dialog opened later stays below");
  const css = fs.readFileSync(new URL("./consent.css", import.meta.url), "utf8");
  assert.match(css, /\.hm-consent \{[^}]*z-index: var\(--hm-z-toast/, "the banner box itself is in the toast band");
  const tokens = fs.readFileSync(new URL("../../css/tokens.css", import.meta.url), "utf8");
  const z = (n) => Number(tokens.match(new RegExp(`--hm-z-${n}: ([0-9]+)`))[1]);
  assert.ok(z("toast") > z("dialog") && z("toast") > z("dropdown") && z("toast") > z("sticky"));
  consent.acceptAll();
  await tick();
  assert.equal(document.querySelector(".hm-consent"), null, "gone after a decision");
  closeLater(); closeDialog(); off(); host.remove();
});
