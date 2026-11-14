// The banner, panel and gate behaviour is covered with the manager (src/managers/consent/consent.test.js, "UI: …").
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const C = await import("./index.ts");
const Old = await import("../../../managers/consent/ui.ts");
const { configureConsent, consent } = await import("../../../managers/consent/index.ts");

test("ConsentBanner: the managers/consent/ui subpath is this module; own wording; a choice closes it", async () => {
  assert.equal(Old.ConsentBanner, C.ConsentBanner);
  configureConsent({ storageKey: "t.consent.banner", version: "1", policyHref: null });
  consent.withdraw();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = render(() => h(C.ConsentBanner, { inline: true, title: "Çerezler", text: "HADİ analitik kullanır." }), host);
  assert.equal(host.querySelector(".hm-consent [role=region], .hm-consent")?.getAttribute("aria-label"), "Çerezler");
  assert.match(host.textContent, /HADİ analitik kullanır\./);
  const accept = [...host.querySelectorAll(".hm-consent-actions button")].at(-1); // Accept all (last, primary)
  accept.click();
  assert.equal(host.querySelector(".hm-consent"), null);
  assert.equal(consent.has("analytics"), true);
  off(); host.remove();
});

test("ConsentBanner: own button texts, Customize can be turned off, class; the gate's texts and Preferences button", () => {
  configureConsent({ storageKey: "t.consent.banner2", version: "1", policyHref: null });
  consent.withdraw();
  const host = document.createElement("div");
  document.body.appendChild(host);
  const off = render(() => [
    h(C.ConsentBanner, { inline: true, always: true, customize: false, class: "mine", labels: { reject: "No", accept: "Yes" } }),
    h(C.ConsentGate, { category: "thirdParty", class: "gate", preferences: false, labels: { allow: "Show" } }, "inside"),
  ], host);
  assert.ok(host.querySelector(".hm-consent").classList.contains("mine"));
  const btns = [...host.querySelectorAll(".hm-consent .hm-consent-actions button")].map((b) => b.textContent);
  assert.deepEqual(btns, ["No", "Yes"]);
  const gate = host.querySelector(".hm-consent-gate.gate");
  assert.deepEqual([...gate.querySelectorAll("button")].map((b) => b.textContent), ["Show"]);
  gate.querySelector("button").click();
  assert.equal(host.querySelector(".hm-consent-gate"), null);
  assert.match(host.textContent, /inside/);
  off(); host.remove();
});
