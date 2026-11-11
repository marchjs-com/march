// Command palette (Ctrl/⌘+K): searches registered commands, NavMenu pages and actions with typo-tolerant ranking.
// Optional `ask(query)` hook (e.g. an AI intent search provided by the app) adds an "Ask" row; it runs on Enter, or by
// itself after 600 ms when local results are weak. Keyboard: ↑ ↓ PageUp PageDown Enter Esc.
import { signal, computed, effect, untrack, onCleanup, createRoot } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t } from "../core/i18n.ts";
import { navigate } from "../router/index.ts";
import { can } from "../access/index.ts";
import { isAction } from "./action.js";
import { Dialog } from "./dialog.js";
import { key, formatKey } from "./keys.js";
import { rank } from "./fold.js";
import { pages, commands } from "./registry.js";
import { val, cx, uid, icon, debounce } from "./util.js";

export { registerCommands, registerPages } from "./registry.js";

const isOpen = signal(false, { name: "palette.open" });
let mounted = 0;
/** Open the command palette (mounts a default one if the app did not render <CommandPalette/>). */
export function openPalette() {
  if (!mounted && globalThis.document?.body) createRoot(() => h(CommandPalette, {}), null);
  isOpen.set(true);
}
export const closePalette = () => isOpen.set(false);
export const paletteOpen = () => isOpen();

const go = (href) => { try { navigate(href); } catch { globalThis.location?.assign(href); } };

/** Normalise commands, actions and pages into palette entries. */
function entries(extra) {
  const out = [];
  for (const c of [...commands(), ...(val(extra) ?? [])]) {
    if (isAction(c)) {
      if (!c.visible()) continue;
      out.push({ id: c.id ?? c.label(), title: c.label(), group: c.opts.group ?? t`Actions`, keywords: c.opts.keywords, icon: c.opts.icon, shortcut: c.opts.key, run: () => c.run().catch(() => {}) });
    } else if (c && !val(c.hidden) && can(c.can)) {
      out.push({ ...c, title: val(c.title), group: c.group ?? t`Commands`, run: c.run ?? (c.href ? () => go(c.href) : () => {}) });
    }
  }
  for (const p of pages()) out.push({ ...p, title: val(p.title), sub: p.group, group: t`Pages`, keywords: [p.keywords, p.group].filter(Boolean).join(" "), run: () => go(p.href) });
  return out;
}

/**
 * `<CommandPalette ask={(q) => api.intent(q)} placeholder="…" shortcut="mod+k" limit={50} commands={[…]} />`
 * ask(query) → Promise<{ results: [{ id, reason }] }> (ids of commands/pages/actions).
 */
export function CommandPalette(props) {
  mounted++;
  onCleanup(() => mounted--);
  if (props.shortcut !== false) key(props.shortcut ?? "mod+k", () => (isOpen.peek() ? isOpen.set(false) : openPalette()), { inInputs: true, description: () => t`Open command palette` });
  const base = uid("hm-pal");
  const q = signal("");
  const sel = signal(0);
  const ask = signal({ status: "idle", q: "", results: [] });
  const all = computed(() => entries(() => props.commands));
  const local = computed(() => {
    const query = q().trim();
    const list = all();
    const limit = props.limit ?? 50;
    if (!query) return list.slice(0, limit).map((item) => ({ kind: "item", item, score: 0 }));
    return rank(query, list, (x) => ({ title: x.title, keywords: [x.keywords, x.sub].filter(Boolean).join(" ") })).slice(0, limit).map((r) => ({ kind: "item", ...r }));
  });
  const weak = () => { const l = local(); return !l.length || l[0].score < 60; };
  const runAsk = async (query) => {
    if (!props.ask || !query.trim()) return;
    ask.set({ status: "loading", q: query, results: [] });
    try {
      const res = await props.ask(query);
      if (untrack(q) !== query) return;
      const byId = new Map(untrack(all).map((x) => [x.id, x]));
      const results = (res?.results ?? []).map((r) => { const item = byId.get(r.id) ?? (r.href ? { id: r.id, title: r.title ?? r.href, run: () => go(r.href) } : null); return item && { kind: "ai", item, reason: r.reason }; }).filter(Boolean);
      ask.set({ status: "done", q: query, results });
    } catch (e) {
      if (untrack(q) === query) ask.set({ status: "error", q: query, results: [], error: e });
    }
  };
  const auto = debounce(runAsk, props.askDelay ?? 600);
  onCleanup(auto.cancel);
  effect(() => {
    const query = q().trim();
    sel.set(0);
    auto.cancel();
    if (!props.ask) return;
    untrack(() => { if (ask.peek().q !== query) ask.set({ status: "idle", q: "", results: [] }); });
    if (query.length >= 3 && weak()) auto(query);
  });
  const rows = computed(() => {
    const out = [...local()];
    const a = ask();
    if (props.ask && q().trim()) out.push(...a.results, { kind: "ask", status: a.status });
    return out;
  });
  const activate = (row) => {
    if (!row) return;
    if (row.kind === "ask") { auto.cancel(); runAsk(untrack(q)); return; }
    isOpen.set(false);
    row.item.run?.();
    props.onRun?.(row.item);
  };
  const move = (d, e) => {
    e.preventDefault();
    const n = untrack(rows).length;
    if (!n) return;
    const cur = untrack(sel);
    const next = Math.abs(d) > 1 ? Math.max(0, Math.min(n - 1, cur + d)) : (cur + d + n) % n;
    sel.set(next);
    globalThis.document.getElementById(`${base}-o-${next}`)?.scrollIntoView?.({ block: "nearest" });
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") move(1, e);
    else if (e.key === "ArrowUp") move(-1, e);
    else if (e.key === "PageDown") move(8, e);
    else if (e.key === "PageUp") move(-8, e);
    else if (e.key === "Enter") { e.preventDefault(); activate(untrack(rows)[untrack(sel)]); }
  };
  // reset the query each time it opens
  let input;
  effect(() => { if (isOpen()) untrack(() => { q.set(""); sel.set(0); if (input) input.value = ""; }); });

  const rowEl = (r, i, prev) => {
    const id = `${base}-o-${i}`;
    const on = () => sel() === i;
    const heading = r.kind === "item" && r.item.group !== prev?.item?.group ? r.item.group : r.kind === "ai" && prev?.kind !== "ai" ? t`Suggested` : null;
    return [
      heading && h("li", { role: "presentation", class: "hm-pal-heading" }, heading),
      h("li", {
        id, role: "option", "aria-selected": () => String(on()), class: () => cx("hm-pal-row", `hm-pal-${r.kind}`, on() && "is-active"),
        "data-id": r.item?.id ?? null, onClick: () => activate(r), onMousemove: () => { if (!on()) sel.set(i); },
      },
      r.kind === "ask"
        ? [h("span", { class: "hm-icon", "aria-hidden": "true" }, "✦"), h("span", { class: "hm-pal-title" }, () => (r.status === "loading" ? t`Asking…` : r.status === "error" ? t`Ask failed — press Enter to retry` : t`Ask: “${q()}”`))]
        : [icon(r.item.icon), h("span", { class: "hm-pal-title" }, r.item.title),
          r.reason && h("span", { class: "hm-pal-reason" }, r.reason),
          r.item.sub && h("span", { class: "hm-pal-sub" }, r.item.sub),
          r.item.shortcut && h("kbd", { class: "hm-kbd" }, formatKey(r.item.shortcut))]),
    ];
  };

  return h(Dialog, {
    open: () => isOpen(), onClose: () => isOpen.set(false), label: t`Command palette`, size: "md", class: "hm-palette",
    children: [
      h("input", {
        type: "text", class: "hm-input hm-pal-input", "data-autofocus": "", ref: (x) => { input = x; }, role: "combobox", "aria-expanded": "true", "aria-controls": `${base}-list`,
        "aria-autocomplete": "list", "aria-activedescendant": () => (rows().length ? `${base}-o-${sel()}` : null),
        placeholder: () => val(props.placeholder) ?? t`Search pages and commands…`, "aria-label": () => t`Search pages and commands`,
        autocomplete: "off", spellcheck: "false", onInput: (e) => q.set(e.target.value), onKeydown: onKey,
      }),
      h("ul", { id: `${base}-list`, role: "listbox", class: "hm-pal-list", "aria-label": () => t`Results` },
        () => { const list = rows(); return untrack(() => list.length ? list.map((r, i) => rowEl(r, i, list[i - 1])) : h("li", { class: "hm-pal-empty", role: "presentation" }, t`No results`)); }),
      h("div", { class: "hm-pal-hint", "aria-hidden": "true" }, () => t`↑↓ to move · Enter to open · Esc to close`),
    ],
  });
}
