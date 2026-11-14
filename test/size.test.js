import { test } from "node:test";
import assert from "node:assert/strict";
import { sizes, BUDGET } from "../bench/size.js";

test("gzip size budgets (core entry and a minimal counter app)", async () => {
  const s = await sizes(["core"]);
  assert.ok(s.core.gzip <= BUDGET.core, `core ${s.core.gzip} B > ${BUDGET.core} B`);
  assert.ok(s.minimal.gzip <= BUDGET.minimal, `minimal ${s.minimal.gzip} B > ${BUDGET.minimal} B`);
});

test("only what you use is bundled: a Button-only app has no other component's CSS or code, within budget", async () => {
  const { buildApp, BUTTON_APP, APP_BUDGET } = await import("../bench/size.js");
  const r = await buildApp(BUTTON_APP);
  assert.match(r.css, /\.m-btn\b/, "Button's CSS is there");
  assert.match(r.css, /--m-primary-solid/, "tokens and the default (HADİ) theme are there");
  for (const other of ["m-menu", "m-pop", "m-dialog", "m-drawer", "m-toast", "m-tab", "m-card", "m-nav", "m-sb-", "m-pal-", "m-table", "m-chart", "m-cal", "m-otp", "m-chip2"]) {
    assert.ok(!r.css.includes(`.${other}`), `CSS has .${other}`);
    assert.ok(!r.js.includes(other), `JS has ${other}`);
  }
  assert.ok(!r.css.includes('data-m-theme="neon"'), "other themes are loaded on demand, not bundled");
  assert.ok(!r.js.includes("pushState"), "the router stays out (Button links bind late)");
  assert.ok(r.jsGzip <= APP_BUDGET.buttonJs, `JS ${r.jsGzip} B gzip > ${APP_BUDGET.buttonJs} B`);
  assert.ok(r.cssGzip <= APP_BUDGET.buttonCss, `CSS ${r.cssGzip} B gzip > ${APP_BUDGET.buttonCss} B`);
});

test("a typical small app (signals, For, If, one component) stays within its JS budget", async () => {
  const { buildApp, TYPICAL_APP, APP_BUDGET } = await import("../bench/size.js");
  const r = await buildApp(TYPICAL_APP);
  assert.ok(!r.js.includes("pushState"), "no router");
  assert.ok(r.jsGzip <= APP_BUDGET.typicalJs, `JS ${r.jsGzip} B gzip > ${APP_BUDGET.typicalJs} B`);
});
