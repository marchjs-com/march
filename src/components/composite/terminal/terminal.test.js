import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Terminal, defineTerminalCommands, ansi, tokenizeCommand, parseArgs } = await import("./index.ts");
const { parseAnsi } = await import("./ansi.ts");
const mount = (props) => { const host = document.createElement("div"); document.body.appendChild(host); let api; const dispose = render(() => h(Terminal, { ...props, ref: (a) => { api = a; } }), host); return { host, api, dispose }; };
const rows = (host) => [...host.querySelectorAll(".m-term-row")].map((r) => r.textContent);

test("tokenizeCommand and parseArgs: quotes, options, aliases, types, choices, required, rest", () => {
  assert.deepEqual(tokenizeCommand(`deploy "my app" --env=prod -f 'a b' x\\ y`), ["deploy", "my app", "--env=prod", "-f", "a b", "x y"]);
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
  const last = [...m.host.querySelectorAll(".m-term-row")].pop();
  assert.ok(last.querySelector(".m-term-tag"), "tag badge");
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
  assert.ok(m.host.querySelector(".m-term-table"));
  await m.api.exec("ping");
  assert.ok(rows(m.host).some((r) => r === "pong"), "page-wide commands work in every terminal");
  await m.api.exec("nope");
  assert.ok(rows(m.host).some((r) => /nope/.test(r)));
  await m.api.exec("greet");
  assert.ok(rows(m.host).some((r) => /greet <name>/.test(r)), "usage after a wrong call");
  await m.api.exec("help");
  const help = m.host.querySelectorAll(".m-term-table")[1];
  assert.ok(help && /greet/.test(help.textContent) && /ping/.test(help.textContent) && /clear/.test(help.textContent));
  assert.deepEqual(m.api.history().slice(0, 2), ["greet Ayşe", "user list"]);
  m.dispose();
});

test("async command is cancelled with Ctrl+C (io.signal)", async () => {
  let aborted = false;
  const m = mount({ commands: { long: (_a, io) => new Promise((ok) => io.signal.addEventListener("abort", () => { aborted = true; ok(); })) } });
  const run = m.api.exec("long");
  m.host.querySelector(".m-term-input").dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true }));
  await run;
  assert.equal(aborted, true);
  assert.ok(rows(m.host).some((r) => r === "^C"));
  m.dispose();
});

test("input: Enter runs, ↑ recalls, Tab completes commands and choices", async () => {
  const m = mount({ commands: { deploy: { args: [{ name: "env", choices: ["staging", "prod"] }], run: () => {} } } });
  const input = m.host.querySelector(".m-term-input");
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
  const root = m.host.querySelector(".m-term");
  assert.match(root.getAttribute("class"), /m-term-auto/);
  scheme.set("dark");
  assert.match(root.getAttribute("class"), /m-term-dark/);
  assert.ok(root.style.getPropertyValue("--m-term-c1"), "the fixed scheme sets its palette");
  scheme.set("auto");
  assert.equal(root.style.getPropertyValue("--m-term-c1"), "", "the previous scheme's colors are gone");
  bg.set("#0b1d33");
  assert.equal(root.style.getPropertyValue("--m-term-bg"), "#0b1d33");
  assert.match(root.getAttribute("class"), /is-custom-bg/);
  m.dispose();
});

test("builtins off, a steady cursor and own texts", async () => {
  const m = mount({ commands: { hi: (_a, io) => io.print("hello") }, builtins: false, blink: false, class: "mine",
    labels: { command: "Shell input", notFound: (name) => `no ${name} here` } });
  assert.ok(m.host.querySelector(".m-term.mine"));
  assert.equal(m.host.querySelector(".m-term-input").getAttribute("aria-label"), "Shell input");
  assert.ok(!m.host.querySelector(".m-term-caret").classList.contains("is-blinking"), "blink={false}");
  await m.api.exec("help");
  assert.ok(rows(m.host).some((r) => r.includes("no help here")), `no built-in help; own not-found text: ${JSON.stringify(rows(m.host))}`);
  assert.equal(m.host.querySelector(".m-term-table"), null);
  await m.api.exec("hi");
  assert.ok(rows(m.host).some((r) => r === "hello"));
  m.dispose();
  const d = mount({});
  assert.ok(d.host.querySelector(".m-term-caret").classList.contains("is-blinking"));
  assert.equal(d.host.querySelector(".m-term-input").getAttribute("aria-label"), "Command");
  d.dispose();
});

test("TerminalWindow: the terminal's props stay live through the window (prompt, cursor)", async () => {
  const { TerminalWindow } = await import("./index.ts");
  const { reactive } = await import("../../../index.ts");
  const prompt = signal("$ "), cursor = signal("bar");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = render(() => h(TerminalWindow, { title: "t", prompt: reactive(() => prompt()), cursor: reactive(() => cursor()) }), host);
  const term = document.querySelector(".m-term-window .m-term");
  assert.ok(term);
  assert.equal(term.querySelector(".m-term-line .m-term-prompt").textContent, "$ ");
  prompt.set("march › "); cursor.set("underline");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(term.querySelector(".m-term-line .m-term-prompt").textContent, "march › ");
  assert.ok(term.classList.contains("m-term-cursor-underline"));
  dispose();
});

test("fallback: a line that names no command runs there (a REPL); commands still win; its error is printed", async () => {
  const seen = [];
  const m = mount({ commands: { hi: (_a, io) => io.print("hello") }, fallback: async (line, io) => { seen.push(line); if (line === "boom") throw new Error("patladı"); io.print(`= ${line.length}`); } });
  await m.api.exec("1 + 2");
  await m.api.exec("hi");
  await m.api.exec("boom");
  assert.deepEqual(seen, ["1 + 2", "boom"]);
  const r = rows(m.host);
  assert.ok(r.includes("= 5") && r.includes("hello") && r.some((x) => /patladı/.test(x)));
  assert.ok(!r.some((x) => /command not found/.test(x)));
  m.dispose();
});
