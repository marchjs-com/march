import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Terminal, defineTerminalCommands, ansi, tokenize, parseArgs } = await import("./index.ts");
const { parseAnsi } = await import("./ansi.ts");
const mount = (props) => { const host = document.createElement("div"); document.body.appendChild(host); let api; const dispose = render(() => h(Terminal, { ...props, ref: (a) => { api = a; } }), host); return { host, api, dispose }; };
const rows = (host) => [...host.querySelectorAll(".hm-term-row")].map((r) => r.textContent);

test("tokenize and parseArgs: quotes, options, aliases, types, choices, required, rest", () => {
  assert.deepEqual(tokenize(`deploy "my app" --env=prod -f 'a b' x\\ y`), ["deploy", "my app", "--env=prod", "-f", "a b", "x y"]);
  const p = parseArgs(["prod", "3", "--force", "--tag", "v2"], [{ name: "env", choices: ["staging", "prod"], required: true }, { name: "n", type: "number" }], { force: { alias: "f" }, tag: { type: "string" } });
  assert.deepEqual(p.args, { env: "prod", n: 3 });
  assert.deepEqual(p.options, { force: true, tag: "v2" });
  assert.throws(() => parseArgs([], [{ name: "env", required: true }]), /env/);
  assert.throws(() => parseArgs(["dev"], [{ name: "env", choices: ["staging", "prod"] }]), /staging/);
  assert.deepEqual(parseArgs(["a", "b", "c"], [{ name: "first" }, { name: "all", rest: true }]).args, { first: "a", all: "b c" });
});

test("ANSI and tags: styled spans, no HTML", () => {
  const s = parseAnsi(`${ansi.red("kırmızı")} düz ${ansi.bold("kalın")}`);
  assert.equal(s[0].fg, 1);
  assert.equal(s[0].text, "kırmızı");
  assert.equal(s.find((x) => x.text === "kalın").bold, true);
  const m = mount({ commands: { say: (a, io) => io.print(a.rest.join(" ")) } });
  m.api.print("[ok] <b>bitti</b>");
  const last = [...m.host.querySelectorAll(".hm-term-row")].pop();
  assert.ok(last.querySelector(".hm-term-tag"), "tag badge");
  assert.equal(last.querySelector("b"), null, "HTML is text, never markup");
  m.dispose();
});

test("commands: run with parsed args, sub-commands, unknown command, usage on a wrong argument, help lists them", async () => {
  const seen = [];
  defineTerminalCommands({ ping: (_a, io) => io.print("pong") });
  const m = mount({ commands: {
    greet: { desc: "Selam", args: [{ name: "name", required: true }], run: (a, io) => { seen.push(a.args.name); io.success(`merhaba ${a.args.name}`); } },
    user: { sub: { list: (_a, io) => io.table([{ ad: "Ayşe" }]) } },
  } });
  await m.api.exec("greet Ayşe");
  assert.deepEqual(seen, ["Ayşe"]);
  await m.api.exec("user list");
  assert.ok(m.host.querySelector(".hm-term-table"));
  await m.api.exec("ping");
  assert.ok(rows(m.host).some((r) => r === "pong"), "page-wide commands work in every terminal");
  await m.api.exec("nope");
  assert.ok(rows(m.host).some((r) => /nope/.test(r)));
  await m.api.exec("greet");
  assert.ok(rows(m.host).some((r) => /greet <name>/.test(r)), "usage after a wrong call");
  await m.api.exec("help");
  const help = m.host.querySelectorAll(".hm-term-table")[1];
  assert.ok(help && /greet/.test(help.textContent) && /ping/.test(help.textContent) && /clear/.test(help.textContent));
  assert.deepEqual(m.api.history().slice(0, 2), ["greet Ayşe", "user list"]);
  m.dispose();
});

test("async command is cancelled with Ctrl+C (io.signal)", async () => {
  let aborted = false;
  const m = mount({ commands: { long: (_a, io) => new Promise((ok) => io.signal.addEventListener("abort", () => { aborted = true; ok(); })) } });
  const run = m.api.exec("long");
  m.host.querySelector(".hm-term-input").dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true }));
  await run;
  assert.equal(aborted, true);
  assert.ok(rows(m.host).some((r) => r === "^C"));
  m.dispose();
});

test("input: Enter runs, ↑ recalls, Tab completes commands and choices", async () => {
  const m = mount({ commands: { deploy: { args: [{ name: "env", choices: ["staging", "prod"] }], run: () => {} } } });
  const input = m.host.querySelector(".hm-term-input");
  const key = (k, o = {}) => input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...o }));
  input.value = "dep"; key("Tab");
  assert.equal(input.value, "deploy ");
  input.value = "deploy st"; key("Tab");
  assert.equal(input.value, "deploy staging ");
  key("Enter");
  await new Promise((r) => setTimeout(r, 0));
  key("ArrowUp");
  assert.equal(input.value, "deploy staging");
  m.dispose();
});

test("scheme and background are live: switching replaces the variables the previous look set", () => {
  const scheme = signal("auto"), bg = signal(undefined);
  const m = mount({ scheme, background: bg });
  const root = m.host.querySelector(".hm-term");
  assert.match(root.getAttribute("class"), /hm-term-auto/);
  scheme.set("dark");
  assert.match(root.getAttribute("class"), /hm-term-dark/);
  assert.ok(root.style.getPropertyValue("--hm-term-c1"), "the fixed scheme sets its palette");
  scheme.set("auto");
  assert.equal(root.style.getPropertyValue("--hm-term-c1"), "", "the previous scheme's colors are gone");
  bg.set("#0b1d33");
  assert.equal(root.style.getPropertyValue("--hm-term-bg"), "#0b1d33");
  assert.match(root.getAttribute("class"), /is-custom-bg/);
  m.dispose();
});
