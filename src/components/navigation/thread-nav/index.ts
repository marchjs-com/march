// ThreadNav (march/navigation): an app's navigation drawn as a thread at the side of the screen. The sections are beads
// on the thread; near the pointer it magnifies like a dock and the thread bends toward the pointer. A bead opens a
// capsule beside it: a search and the section's categories (text and a count); the open category's pages hang from it
// on a second thread. A drop marks where you are and flows to a new place (on the thread and on the pages' thread) in
// the colour of its section. While closed, a small capsule shows the path (section › category › page) with the same
// beads; a bead there opens the capsule at that level. Every level by keyboard. Composed of SearchBox.
import "./thread-nav.css";
import { signal, computed, untrack, effect, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { Portal } from "../../../dom/portal.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, clamp, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { nextFrame } from "../../../motion/engine/clock.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { dockLens } from "../../../ui/dock-lens.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import tr from "./tr.ts";
import type { Handler } from "../../../core/util.ts";
import { on as listen } from "../../../core/util.ts";
import { isActivateKey } from "../../../ui/behave.ts";

messages("tr", tr);

/** A place in the navigation: a section (the thread), a category (the capsule) or a page (the pages' thread). */
export interface ThreadNavItem {
  /** Unique in the tree (a path works). @tr Ağaçta tek (bir yol olabilir). */
  id: string;
  /** Its name. @tr Adı. */
  label: string;
  /** One line about it: shown under the capsule while it is pointed at or focused. @tr Hakkında tek satır: imleç ya da odak üstündeyken kapsülün altında görünür. */
  desc?: string | undefined;
  /** A number beside a category (its pages). @tr Bir kategorinin yanındaki sayı (sayfaları). */
  count?: number | undefined;
  /** A section's colour (the drop and its beads take it). @tr Bir bölümün rengi (damla ve boncukları onu alır). */
  color?: ColorToken | undefined;
  /** Its address: the item is a link. @tr Adresi: öğe bir bağlantı olur. */
  href?: string | undefined;
  /** What it holds: a section's categories, a category's pages. @tr İçindekiler: bir bölümün kategorileri, bir kategorinin sayfaları. */
  children?: readonly ThreadNavItem[] | undefined;
}

export interface ThreadNavProps {
  /** The sections, each with its categories and their pages. @tr Bölümler, her biri kategorileri ve onların sayfalarıyla. */
  items: MaybeFn<readonly ThreadNavItem[]>;
  /** Where you are: the id of a page (or a category, a section). @tr Bulunduğun yer: bir sayfanın (ya da kategorinin, bölümün) id'si. */
  value?: MaybeFn<string | null | undefined>;
  /** A place was chosen (a page, or a category / section without pages): `(item, path)`, path from the section. @tr Bir yer seçildi (bir sayfa ya da sayfasız bir kategori / bölüm): `(item, path)`, yol bölümden başlar. */
  onNavigate?: Handler<[item: ThreadNavItem, path: readonly ThreadNavItem[]]> | undefined;
  /** Fixed at the start edge of the screen (default false: fills its place). @tr Ekranın başlangıç kenarına sabit (varsayılan false: yerini doldurur). */
  fixed?: boolean | undefined;
  /** Magnify the beads near the pointer (default true). @tr Boncukları imlecin yakınında büyüt (varsayılan true). */
  magnify?: MaybeFn<boolean | undefined>;
  /** How far the magnifier reaches, px (default 120). @tr Büyütecin erimi, px (varsayılan 120). */
  reach?: MaybeFn<number | undefined>;
  /** Room a fully magnified bead takes beyond its step, px (default 22). @tr Tam büyümüş bir boncuğun adımının ötesinde kapladığı yer, px (varsayılan 22). */
  grow?: MaybeFn<number | undefined>;
  /** The thread bends toward the pointer (default true; not under reduced motion). @tr İplik imlece doğru eğilir (varsayılan true; hareket azaltılınca yok). */
  bend?: MaybeFn<boolean | undefined>;
  /** A search at the top of the capsule (default true). @tr Kapsülün tepesinde bir arama (varsayılan true). */
  search?: MaybeFn<boolean | undefined>;
  /** While closed, a capsule with the path to where you are (default true). @tr Kapalıyken bulunduğun yere giden yolu gösteren bir kapsül (varsayılan true). */
  crumbs?: MaybeFn<boolean | undefined>;
  /** Close the capsule once a place is chosen (default true). @tr Bir yer seçilince kapsülü kapat (varsayılan true). */
  closeOnNavigate?: boolean | undefined;
  /** Own names: the navigation, the search, closing. @tr Kendi adların: gezinme, arama, kapatma. */
  labels?: { group?: string | undefined; search?: string | undefined; close?: string | undefined; empty?: string | undefined } | undefined;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** The path (section … item) to the item with this id, or []. */
export function threadPath(items: readonly ThreadNavItem[], id: string | null | undefined): ThreadNavItem[] {
  if (!id) return [];
  for (const it of items) {
    if (it.id === id) return [it];
    const sub = threadPath(it.children ?? [], id);
    if (sub.length) return [it, ...sub];
  }
  return [];
}

const fold = (s: string): string => s.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

/** `<ThreadNav items={sections} value={$page} onNavigate={(it) => go(it.href)} fixed />` */
export function ThreadNav(props: ThreadNavProps): unknown {
  const items = (): readonly ThreadNavItem[] => val(props.items) ?? [];
  const path = computed(() => threadPath(items(), val(props.value)));
  const openAt = signal<number>(-1);           // the section whose capsule is open (-1: closed)
  const expanded = signal<string | null>(null); // the open category's id
  const hint = signal<string>("");
  const query = signal("");
  let alive = true, root: HTMLElement | undefined, list: HTMLElement | undefined, thread: SVGPathElement | undefined, rail: HTMLElement | undefined;
  const doc = globalThis.document;
  const on = (): boolean => val(props.magnify) !== false;

  // ── where you are: the section, the category, the page
  const here = (level: number): ThreadNavItem | undefined => path()[level];
  const sectionIndex = (): number => { const s = here(0); return s ? items().indexOf(s) : -1; };

  // ── opening and closing the capsule
  const open = (i: number, cat?: string | null): void => {
    const sec = untrack(items)[i];
    if (!sec) return;
    openAt.set(i);
    query.set("");
    const cur = untrack(path);
    expanded.set(cat !== undefined ? cat : cur[0] === sec ? cur[1]?.id ?? null : null);
  };
  const close = (refocus = false): void => {
    const i = openAt.peek();
    openAt.set(-1); hint.set("");
    if (refocus) beadOf(i)?.focus();
  };
  const choose = (item: ThreadNavItem): void => {
    const p = threadPath(untrack(items), item.id);
    props.onNavigate?.(item, p);
    if (props.closeOnNavigate !== false) close();
  };

  // ── the rail: beads on a thread, the dock lens, the thread bending toward the pointer, the drop
  const lens = dockLens({
    list: () => list, vertical: () => true, reach: () => val(props.reach) ?? 120, grow: () => val(props.grow) ?? 22, shiftVar: "--m-thn-shift",
    // the drop rides with its bead while the beads move apart
    onDraw: (shifts) => railDrop.style.setProperty("--m-thn-drop-shift", `${shifts[untrack(sectionIndex)] ?? 0}px`),
  });
  let bendTo = 0, bendAt = 0, bend = 0, vel = 0, bending = false;
  const drawThread = (): void => {
    if (!thread || !rail || !alive) { bending = false; return; }
    // a damped spring toward the pointer's pull: it overshoots a little and trembles back when let go
    const acc = (bendTo - bend) * 0.16 - vel * 0.32;
    vel += acc; bend += vel;
    const hgt = rail.clientHeight, x = rail.clientWidth / 2, y = clamp(bendAt, 0, hgt);
    thread.setAttribute("d", `M${x} 0 C${x} ${(y * 0.6).toFixed(1)} ${(x + bend).toFixed(1)} ${(y - 40).toFixed(1)} ${(x + bend).toFixed(1)} ${y.toFixed(1)} S${x} ${Math.min(hgt, y + 40 + (hgt - y) * 0.4).toFixed(1)} ${x} ${hgt}`);
    if (Math.abs(bendTo - bend) < 0.05 && Math.abs(vel) < 0.05) { bend = bendTo; bending = false; if (!bend) thread.setAttribute("d", `M${x} 0 L${x} ${hgt}`); return; }
    nextFrame(drawThread);
  };
  const pull = (e: PointerEvent | null): void => {
    if (!rail || val(props.bend) === false || reducedMotion()) return;
    const r = rail.getBoundingClientRect();
    bendTo = e ? clamp((e.clientX - (r.left + r.width / 2)) * 0.45, 0, 9) : 0;
    if (e) bendAt = e.clientY - r.top;
    if (!bending) { bending = true; nextFrame(drawThread); }
  };
  const straighten = (): void => { if (thread && rail) thread.setAttribute("d", `M${rail.clientWidth / 2} 0 L${rail.clientWidth / 2} ${rail.clientHeight}`); };

  /** The drop: it stands on the bead of where you are; moving, it stretches along the thread and settles. */
  const drop = (el: HTMLElement, target: () => HTMLElement | null | undefined, box: () => HTMLElement | null | undefined): void => {
    let last = -1;
    const place = (): void => {
      const t = target(), b = box();
      if (!t || !b) { el.classList.remove("is-on"); return; }
      // its laid-out place (offsets: a bead moved by the lens does not move it; the lens shift is added on its own)
      let y = t.offsetHeight / 2;
      for (let n: HTMLElement | null = t; n && n !== b; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      y = Math.round(y);
      if (y === last) return;
      const far = last >= 0 && Math.abs(y - last) > 4;
      last = y;
      el.style.setProperty("--m-thn-drop-y", `${y}px`);
      el.classList.add("is-on");
      if (far && !reducedMotion()) {
        el.classList.add("is-flowing");
        setTimeout(() => el.classList.remove("is-flowing"), 220);
      }
    };
    effect(() => { path(); openAt(); expanded(); query(); nextFrame(place); });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => nextFrame(place)) : null;
    nextFrame(() => { const b = box(); if (b) ro?.observe(b); place(); });
    onCleanup(() => ro?.disconnect());
  };

  const beadOf = (i: number): HTMLElement | null => (list?.children[i]?.firstElementChild as HTMLElement | null) ?? null;
  const onRailKey = (e: KeyboardEvent): void => {
    const n = untrack(items).length, cur = list ? [...list.children].findIndex((li) => li.contains(doc?.activeElement ?? null)) : -1;
    if (e.key === "ArrowRight" || isActivateKey(e)) {
      if (cur < 0) return;
      e.preventDefault();
      if (!untrack(items)[cur]?.children?.length) { const it = untrack(items)[cur]; if (it) choose(it); return; }
      open(cur);
      queueMicrotask(() => firstRow()?.focus());
      return;
    }
    if (e.key === "Escape" && openAt.peek() >= 0) { e.preventDefault(); close(true); return; }
    const to = e.key === "ArrowDown" ? cur + 1 : e.key === "ArrowUp" ? cur - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (to == null || to < 0 || to >= n) return;
    e.preventDefault();
    beadOf(to)?.focus();
  };

  // ── the capsule: search, categories, the open category's pages on their thread
  let panel: HTMLElement | undefined;
  const rows = (): HTMLElement[] => (panel ? [...panel.querySelectorAll<HTMLElement>(".m-thn-row")] : []);
  const firstRow = (): HTMLElement | undefined => rows().find((r) => r.getAttribute("aria-current")) ?? rows()[0];
  const onPanelKey = (e: KeyboardEvent): void => {
    const all = rows(), cur = all.indexOf(doc?.activeElement as HTMLElement);
    const row = all[cur], cat = row?.dataset["cat"], page = row?.dataset["page"];
    if (e.key === "Escape") { e.preventDefault(); close(true); return; }
    if (cur < 0) return;
    if (e.key === "ArrowRight" && cat) { e.preventDefault(); expanded.set(cat); queueMicrotask(() => rows()[cur + 1]?.focus()); return; }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (page) { all.slice(0, cur).reverse().find((r) => r.dataset["cat"])?.focus(); return; }
      if (cat && expanded.peek() === cat) { expanded.set(null); return; }
      close(true); return;
    }
    const to = e.key === "ArrowDown" ? cur + 1 : e.key === "ArrowUp" ? cur - 1 : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : null;
    if (to == null || to < 0 || to >= all.length) return;
    e.preventDefault();
    all[to]?.focus();
  };
  const matches = (it: ThreadNavItem, q: string): boolean => !q || fold(`${it.label} ${it.desc ?? ""}`).includes(q);
  const say = (it: ThreadNavItem): (() => void) => () => hint.set(it.desc ?? "");

  const link = (it: ThreadNavItem, cls: string, extra: Record<string, unknown>, ...kids: unknown[]): Element =>
    h(it.href ? "a" : "button", {
      class: cls, ...(it.href ? { href: it.href } : { type: "button" }), ...extra,
      onPointerEnter: say(it), onFocus: say(it),
    }, ...kids);

  const pageRow = (p: ThreadNavItem): Element => h("li", { class: () => cx("m-thn-page", here(2)?.id === p.id && "is-on") },
    link(p, "m-thn-row m-thn-page-link", {
      "data-page": p.id, "aria-current": () => (here(2)?.id === p.id ? "page" : null),
      onClick: (e: MouseEvent) => { e.preventDefault(); choose(p); },
    }, h("span", { class: "m-thn-knot", "aria-hidden": "true" }), h("span", { class: "m-thn-text" }, p.label)));

  const catRow = (c: ThreadNavItem, q: string): Element | null => {
    const pages = (c.children ?? []).filter((p) => matches(p, q));
    if (q && !matches(c, q) && !pages.length) return null;
    const isOpen = (): boolean => !!q || expanded() === c.id;
    const isHere = (): boolean => here(1)?.id === c.id;
    const el = h("li", { class: () => cx("m-thn-cat", isOpen() && "is-open", isHere() && "is-here") },
      link(c, "m-thn-row m-thn-cat-link", {
        "data-cat": c.id, "aria-expanded": c.children?.length ? () => String(isOpen()) : null,
        "aria-current": () => (isHere() && !here(2) ? "page" : null),
        onClick: (e: MouseEvent) => {
          e.preventDefault();
          if (c.children?.length) expanded.set(untrack(expanded) === c.id ? null : c.id); else choose(c);
        },
      }, h("span", { class: "m-thn-text" }, c.label), c.count != null ? h("span", { class: "m-thn-count" }, String(c.count)) : null),
      () => {
        if (!isOpen() || !pages.length) return null;
        // the pages' thread, with its own drop at the page you are on (when it is in this category)
        const subDrop = h("span", { class: "m-thn-subdrop", "aria-hidden": "true" }) as HTMLElement;
        const sub = h("div", { class: "m-thn-sub" }, subDrop, h("ol", { class: "m-thn-pages" }, untrack(() => pages.map(pageRow)))) as HTMLElement;
        drop(subDrop, () => sub.querySelector<HTMLElement>(".m-thn-page.is-on"), () => sub);
        return sub;
      });
    return el;
  };

  const capsule = (): Element | null => {
    const i = openAt();
    const sec = items()[i];
    if (!sec) return null;
    return h("div", {
      class: "m-thn-panel", role: "dialog", "aria-label": sec.label, "data-m-color": colorAttr(sec.color),
      ref: (x: HTMLElement) => { panel = x; }, onKeyDown: onPanelKey,
    },
    h("div", { class: "m-thn-head" },
      h("strong", { class: "m-thn-title" }, sec.label),
      sec.desc ? h("span", { class: "m-thn-sub-title" }, sec.desc) : null,
      h("button", { type: "button", class: "m-thn-close", "aria-label": () => props.labels?.close ?? t`Close`, onClick: () => close(true) }, "×")),
    () => (val(props.search) === false ? null : h(SearchBox, {
      class: "m-thn-search", size: "sm", value: () => query(), debounce: 0,
      placeholder: () => props.labels?.search ?? t`Search`, label: () => props.labels?.search ?? t`Search`,
      onSearch: (v: string) => query.set(v ?? ""),
    })),
    h("ul", { class: "m-thn-cats" }, () => {
      const q = fold(query().trim());
      const out = (sec.children ?? []).map((c) => catRow(c, q)).filter(Boolean);
      return out.length ? out : h("li", { class: "m-thn-empty" }, () => props.labels?.empty ?? t`Nothing matches`);
    }),
    h("p", { class: () => cx("m-thn-hint", hint() && "is-on"), "aria-live": "polite" }, () => hint()));
  };

  // close on a press outside (the rail and the capsule are inside)
  const outside = (e: PointerEvent): void => { if (openAt.peek() >= 0 && root && !root.contains(e.target as Node)) close(); };
  listen(doc, "pointerdown", outside, true);
  onCleanup(() => { alive = false; lens.dispose(); });

  const railDrop = h("span", { class: "m-thn-drop", "aria-hidden": "true", "data-m-color": () => colorAttr(here(0)?.color) }) as HTMLElement;

  // ── the path while closed: the same beads in a small capsule; a bead opens the capsule at that level
  const crumbs = (): Element | null => {
    const p = path();
    if (val(props.crumbs) === false || openAt() >= 0 || !p.length) return null;
    return h("nav", { class: "m-thn-crumbs", "aria-label": () => t`You are here`, "data-m-color": colorAttr(p[0]?.color) },
      h("ol", {}, p.map((it, lvl) => h("li", { class: cx("m-thn-crumb", lvl === p.length - 1 && "is-here") },
        h("button", {
          type: "button", "aria-current": lvl === p.length - 1 ? "location" : null,
          onClick: () => { const s = untrack(items).indexOf(p[0] as ThreadNavItem); open(s, lvl >= 1 ? p[1]?.id ?? null : null); },
        }, h("span", { class: "m-thn-knot", "aria-hidden": "true" }), it.label)))));
  };

  const view = h("div", {
    class: () => cx("m-thn", props.fixed && "is-fixed", openAt() >= 0 && "is-open", val(props.class)),
    ref: (x: HTMLElement) => { root = x; },
  },
  h("nav", { class: "m-thn-rail", "aria-label": () => props.labels?.group ?? t`Navigation`, ref: (x: HTMLElement) => { rail = x; },
    onPointerMove: (e: PointerEvent) => pull(e), onPointerLeave: () => pull(null) },
  h("svg", { class: "m-thn-thread", "aria-hidden": "true" }, h("path", { ref: (x: SVGPathElement) => { thread = x; } })),
  railDrop,
  h("ol", {
    class: "m-thn-list", ref: (x: HTMLElement) => { list = x; }, onKeyDown: onRailKey,
    onPointerEnter: () => { if (on()) lens.enter(); },
    onPointerMove: (e: PointerEvent) => { if (on()) { lens.enter(); lens.at(e.clientY); } },
    onPointerLeave: () => lens.at(null),
    onFocusIn: (e: FocusEvent) => { const li = (e.target as Element).closest("li"); if (li && list && on()) lens.atItem([...list.children].indexOf(li)); },
    onFocusOut: () => lens.at(null),
  }, () => {
    const secs = items();
    return untrack(() => secs.map((s, i) => h("li", {
      class: () => cx("m-thn-item", sectionIndex() === i && "is-here", openAt() === i && "is-open"), "data-m-color": colorAttr(s.color),
    }, h("button", {
      type: "button", class: "m-thn-bead", "aria-label": s.label,
      "aria-expanded": s.children?.length ? () => String(openAt() === i) : null, "aria-haspopup": s.children?.length ? "dialog" : null,
      "aria-current": () => (sectionIndex() === i ? "location" : null),
      tabindex: () => (sectionIndex() === i || (sectionIndex() < 0 && i === 0) ? "0" : "-1"),
      onClick: () => { if (!s.children?.length) return choose(s); if (untrack(openAt) === i) close(); else open(i); },
    }, h("svg", { class: "m-thn-dot", viewBox: "0 0 24 24", "aria-hidden": "true" }, h("circle", { cx: "12", cy: "12", r: "11.5" })),
    h("span", { class: "m-thn-label", "aria-hidden": "true" }, s.label)))));
  })),
  capsule, crumbs);
  drop(railDrop, () => list?.querySelector<HTMLElement>(".m-thn-item.is-here"), () => rail);
  nextFrame(() => { if (alive) straighten(); });
  return props.fixed ? h(Portal, { mount: doc?.body, children: view }) : view;
}
