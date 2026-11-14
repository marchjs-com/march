// March dev client: live reload + build error overlay. Served at /__march/client.js in `march dev` only.
// Builds the overlay with DOM APIs and textContent (no HTML strings), so it works under strict CSP / Trusted Types.
const es = new EventSource("/__march/events");
let overlay = null;
function show(errors) {
  hide();
  overlay = document.createElement("div");
  overlay.className = "m-dev-overlay";
  overlay.setAttribute("role", "alert");
  const box = document.createElement("div");
  box.className = "m-dev-overlay-box";
  const h = document.createElement("h2");
  h.textContent = `Build failed (${errors.length})`;
  box.append(h);
  for (const e of errors) {
    const p = document.createElement("pre");
    p.textContent = `${e.text}\n${e.file ? `${e.file}:${e.line}:${(e.column ?? 0) + 1}\n` : ""}${e.lineText ? `  ${e.lineText}\n` : ""}${e.detail ?? ""}`;
    box.append(p);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.addEventListener("click", hide);
  box.append(close);
  overlay.append(box);
  document.body.append(overlay);
}
function hide() { overlay?.remove(); overlay = null; }
es.addEventListener("build-error", (e) => show(JSON.parse(e.data)));
es.addEventListener("reload", () => location.reload());
window.addEventListener("error", (e) => show([{ text: `Runtime error: ${e.message}`, file: e.filename, line: e.lineno, column: e.colno - 1 }]));
window.addEventListener("unhandledrejection", (e) => show([{ text: `Unhandled rejection: ${e.reason?.message ?? e.reason}` }]));
