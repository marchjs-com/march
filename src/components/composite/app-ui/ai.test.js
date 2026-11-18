// march-app-ui's vault and AI plugins: the services and panels they add, the commands; the panels' helpers (passphrase
// strength, an answer's code blocks, inline marks).
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";

installDom();
const { createAppKit } = await import("./kit.ts");
const { vaultPlugin, aiPlugin } = await import("./ai.ts");
const { passStrength, answerParts, inline } = await import("./ai-panels.tsx");
const { _resetVaults } = await import("../../../vault/index.ts");

test("vaultPlugin + aiPlugin: services, panels, ai waits for the vault", () => {
  _resetVaults();
  const opened = [];
  const kit = createAppKit([aiPlugin({ open: (id) => opened.push(id) }), vaultPlugin({ name: "kit-t", memory: true, iterations: 1000, autoLock: 0 })]);
  assert.ok(kit.has("march.vault") && kit.has("march.ai"), "ai starts once the vault is there");
  assert.deepEqual(kit.panels().map((p) => p.id), ["ai-keys", "ai"]);
  const v = kit.service("vault");
  assert.equal(typeof v.vault.unlock, "function");
  kit.service("ai").ask("hi", "Hi");
  assert.deepEqual(opened, ["ai"]);
  kit.remove("march.vault");
  assert.ok(!kit.has("march.ai"), "removing the vault removes the AI too");
  kit.dispose();
});

test("passStrength, answerParts, inline", () => {
  assert.equal(passStrength("short"), 0);
  assert.ok(passStrength("Mavi kedi 7 kez zıpladı!") >= 3);
  assert.ok(passStrength("aaaaaaaaaaaa") < passStrength("aaaaaaaaaaaA1"));
  const parts = answerParts("Intro\n```tsx\nconst a = 1\n```\nAfter\n```\nopen");
  assert.deepEqual(parts.map((p) => [p.code, p.text.trim(), p.lang]), [[false, "Intro", ""], [true, "const a = 1", "tsx"], [false, "After", ""], [true, "open", "tsx"]], "an unclosed block (still streaming) is code too");
  const nodes = inline("a **b** `c` d");
  assert.equal(nodes.length, 5);
  assert.equal(nodes[1].tagName, "STRONG");
  assert.equal(nodes[3].tagName, "CODE");
});
