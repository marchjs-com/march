// Command palette view: loaded the first time the palette opens (or when its button is hovered), so the search,
// ranking and dialog code is not in the app's first download. The shell (shortcut, button, open state) is palette.ts.
import { signal, computed, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { navigate, type Href } from "../../../router/router.ts";
import { can } from "../../../access/index.ts";
import { isAction } from "../../../ui/action.ts";
import { Dialog } from "../../../ui/dialog.ts";
import { rank } from "../../../ui/fold.ts";
import { pages, commands, type Command } from "../../../ui/registry.ts";
import { val, cx, uid, debounce, type MaybeFn } from "../../../ui/util.ts";
import { sparkles } from "../../../icons/glyphs/sparkles.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import { Kbd } from "../../typography/kbd/index.ts";
import { OverflowText } from "../../typography/overflow-text/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { isOpen } from "./state.ts";
import type { PaletteEntry, CommandPaletteProps, CommandPaletteLabels } from "./index.ts";
import { listNav } from "../../../behaviors/list-nav/index.ts";

type Row =
  | { kind: "item"; item: PaletteEntry; score: number; reason?: undefined }
  | { kind: "ai"; item: PaletteEntry; reason: string | undefined }
  | { kind: "ask"; status: AskState["status"]; item?: undefined; reason?: undefined };
interface AskState { status: "idle" | "loading" | "done" | "error"; q: string; results: Row[]; error?: unknown }

const go = (href: string): void => { try { void navigate(href as Href); } catch { globalThis.location?.assign(href); } };

/** Normalise commands, actions and pages into palette entries. */
function entries(extra: MaybeFn<readonly Command[] | null | undefined>): PaletteEntry[] {
  const out: PaletteEntry[] = [];
  for (const c of [...commands(), ...(val(extra) ?? [])]) {
    if (isAction(c)) {
      if (!c.visible()) continue;
      out.push({ id: c.id ?? c.label(), title: c.label(), group: c.opts.group ?? t`Actions`, keywords: c.opts.keywords, icon: c.opts.icon, shortcut: c.opts.key, run: () => c.run().catch(() => {}) });
    } else if (c && !val(c.hidden) && can(c.can)) {
      const href = c.href;
      out.push({ ...c, title: val(c.title), group: c.group ?? t`Commands`, run: c.run ?? (href ? () => go(href) : () => {}) });
    }
  }
  for (const p of pages()) out.push({ ...p, title: val(p.title), sub: p.group, group: t`Pages`, keywords: [p.keywords, p.group].filter(Boolean).join(" "), run: () => go(p.href) });
  return out;
}

/** The palette dialog (see CommandPalette in palette.ts for the props). */
export function PaletteView(props: CommandPaletteProps): unknown {
  const base = uid("hm-pal");
  const L = (): CommandPaletteLabels => val(props.labels) ?? {};
  const hint = props.hint;
  const q = signal("");
  const sel = signal(0);
  const ask = signal<AskState>({ status: "idle", q: "", results: [] });
  const all = computed(() => entries(() => props.commands));
  const local = computed((): Row[] => {
    const query = q().trim();
    const list = all();
    const limit = props.limit ?? 50;
    if (!query) return list.slice(0, limit).map((item) => ({ kind: "item", item, score: 0 }));
    return rank(query, list, (x) => ({ title: x.title, keywords: [x.keywords, x.sub].filter(Boolean).join(" ") })).slice(0, limit).map((r) => ({ kind: "item", ...r }));
  });
  const weak = (): boolean => { const l = local()[0]; return !l || l.kind !== "item" || l.score < 60; };
  const runAsk = async (query: string): Promise<void> => {
    if (!props.ask || !query.trim()) return;
    ask.set({ status: "loading", q: query, results: [] });
    try {
      const res = await props.ask(query);
      if (untrack(q) !== query) return;
      const byId = new Map(untrack(all).map((x) => [x.id, x]));
      const results = (res?.results ?? []).map((r): Row | null => {
        const href = r.href;
        const item = byId.get(r.id) ?? (href ? { id: r.id, title: r.title ?? href, group: "", run: () => go(href) } : null);
        return item && { kind: "ai", item, reason: r.reason };
      }).filter((x): x is Row => !!x);
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
  const rows = computed((): Row[] => {
    const out = [...local()];
    const a = ask();
    if (props.ask && q().trim()) out.push(...a.results, { kind: "ask", status: a.status });
    return out;
  });
  const activate = (row: Row | undefined): void => {
    if (!row) return;
    if (row.kind === "ask") { auto.cancel(); void runAsk(untrack(q)); return; }
    isOpen.set(false);
    row.item.run?.();
    props.onRun?.(row.item);
  };
  // arrows (looping), Page Up / Down by 8, Ctrl+Home / End, Enter: the list-nav behavior
  const onKey = listNav({
    count: () => untrack(rows).length, active: sel, page: 8,
    onPick: (i) => activate(untrack(rows)[i]),
    onMove: (i) => globalThis.document.getElementById(`${base}-o-${i}`)?.scrollIntoView?.({ block: "nearest" }),
  });
  // reset the query each time it opens (the SearchBox follows `q`)
  effect(() => { if (isOpen()) untrack(() => { q.set(""); sel.set(0); }); });
  // Escape closes the palette at once (the box's own Escape would first clear the text)
  const onInputKey = (e: KeyboardEvent): void => { if (e.key === "Escape") { e.preventDefault(); isOpen.set(false); } else onKey(e); };

  const rowEl = (r: Row, i: number, prev: Row | undefined): unknown[] => {
    const id = `${base}-o-${i}`;
    const on = (): boolean => sel() === i;
    const heading = r.kind === "item" && r.item.group !== prev?.item?.group ? r.item.group : r.kind === "ai" && prev?.kind !== "ai" ? L().suggested ?? t`Suggested` : null;
    const ask = r.kind === "ask";
    return [
      heading && h(SectionLabel, { as: "li", role: "presentation", class: "hm-pal-heading" }, heading),
      h(ListRow, {
        as: "li", id, role: "option", "aria-selected": () => String(on()), class: `hm-pal-row hm-pal-${r.kind}`, active: on, indicator: true,
        "data-id": r.item?.id ?? null, onClick: () => activate(r), onMousemove: () => { if (!on()) sel.set(i); },
        lead: ask ? (props.askIcon === false ? undefined : props.askIcon ?? sparkles) : r.item.icon,
        title: ask ? () => (r.status === "loading" ? L().asking ?? t`Asking…` : r.status === "error" ? L().askFailed ?? t`Ask failed — press Enter to retry` : L().ask?.(q()) ?? t`Ask: “${q()}”`) : r.item.title,
        trail: ask || !(r.reason || r.item.sub || r.item.shortcut) ? undefined : [
          r.reason && h(OverflowText, { class: "hm-pal-reason" }, r.reason),
          r.item.sub && h("span", { class: "hm-pal-sub" }, r.item.sub),
          r.item.shortcut && h(Kbd, { keys: r.item.shortcut })],
      }),
    ];
  };

  const ownEmpty = props.empty;
  return h(Dialog, {
    open: () => isOpen(), onClose: () => isOpen.set(false), label: L().dialog ?? t`Command palette`, size: "md", class: cx("hm-palette", val(props.class)),
    children: [
      h(SearchBox, {
        class: "hm-pal-search", inputClass: "hm-pal-input", variant: "plain", icon: false, clear: false, debounce: 0, value: q, inputRef: (x: HTMLInputElement) => x.setAttribute("data-autofocus", ""),
        controls: `${base}-list`, activeDescendant: () => (rows().length ? `${base}-o-${sel()}` : null), onKeyDown: onInputKey,
        placeholder: () => val(props.placeholder) ?? t`Search pages and commands…`, label: () => L().search ?? t`Search pages and commands`,
      }),
      h("ul", { id: `${base}-list`, role: "listbox", class: "hm-pal-list", "aria-label": () => L().results ?? t`Results` },
        () => { const list = rows(); return untrack(() => list.length ? list.map((r, i) => rowEl(r, i, list[i - 1]))
          : h("li", { class: "hm-pal-empty", role: "presentation" }, h(Empty, { size: "sm", title: ownEmpty != null ? false : L().empty ?? t`No results` }, ownEmpty))); }),
      hint === false ? null : hint != null && hint !== true ? h("div", { class: "hm-pal-hint" }, hint)
        : h("div", { class: "hm-pal-hint", "aria-hidden": "true" }, () => L().hint ?? t`↑↓ to move · Enter to open · Esc to close`),
    ],
  });
}
