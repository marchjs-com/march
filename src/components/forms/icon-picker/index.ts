// IconPicker (march/ui): choose an icon. A button shows the chosen icon and its name; it opens a panel with a search
// (by name, Turkish or English words), filter chips (arrows, files, media, messages, people, layout, filled) and a grid
// of every icon. Composed of Dropdown, SearchBox, Chip, IconButton, Spinner and Empty. The value is the icon's export
// name ("plus"); `icons` takes another set (default: every built-in icon). `packs` adds icon sets (Lucide, Tabler…) as
// chips above the grid, several at once: a set loads when it is first chosen (its `load`), and a value from it is
// "id:name" ("lucide:arrow-left"). The filter chips combine too (arrows or files). The grid draws its icons a page at a
// time, the next page as it is scrolled to the end.
import "./icon-picker.css";
import { signal, computed, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ICONS } from "../../../icons/catalog.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { Dropdown } from "../../actions/menu/index.ts";
import { SearchBox } from "../search-box/index.ts";
import { Chip } from "../../actions/chip/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { Spinner } from "../../feedback/spinner/index.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** A filter of the panel: its label and the icon names it keeps. */
export interface IconGroup { id: string; label: MaybeFn<string>; match: RegExp | ((name: string, def: IconDef) => boolean) }
/** The built-in filters. */
export const ICON_GROUPS: readonly IconGroup[] = [
  { id: "arrows", label: () => t`Arrows`, match: /arrow|chevron|corner|undo|redo|refresh|rotate/i },
  { id: "files", label: () => t`Files`, match: /file|folder|archive|save|download|upload|clipboard|copy|book/i },
  { id: "media", label: () => t`Media`, match: /play|pause|step|music|video|image|camera|mic|volume|film|monitor/i },
  { id: "messages", label: () => t`Messages`, match: /mail|message|phone|bell|send|chat|inbox|share|at/i },
  { id: "people", label: () => t`People`, match: /user|heart|smile|thumb|award|star/i },
  { id: "layout", label: () => t`Layout`, match: /layout|panel|column|grid|sidebar|list|table|layers|maximize|minimize/i },
  { id: "filled", label: () => t`Filled`, match: (_n, d) => !!d.fill },
];

/** An icon set to choose from besides `icons`: loaded on first use; a value from it is "id:name". */
export interface IconPickerPack { id: string; label: MaybeFn<string>; count?: number | undefined; load: () => Promise<Readonly<Record<string, IconDef>>> }

export interface IconPickerProps {
  /** The chosen icon's name (a signal, a value or an accessor); null: none. @tr Seçilen ikonun adı (sinyal, değer ya da erişimci); null: yok. */
  value?: Signal<string | null> | MaybeFn<string | null | undefined>;
  /** Called with the chosen icon's name (null for none). @tr Seçilen ikonun adıyla çağrılır (yoksa null). */
  onChange?: ((name: string | null) => void) | undefined;
  /** The icons to choose from (default every built-in icon). @tr Seçilebilecek ikonlar (varsayılan: tüm yerleşik ikonlar). */
  icons?: Readonly<Record<string, IconDef>> | undefined;
  /** More icon sets, chosen above the grid and loaded when first chosen (or when the value names one). @tr Izgaranın üstünden seçilen, ilk seçildiğinde (ya da değer onlardan birini adlandırınca) yüklenen ek ikon setleri. */
  packs?: readonly IconPickerPack[] | undefined;
  /** The name of `icons` in the set list (default "March"). @tr Set listesinde `icons`'un adı (varsayılan "March"). */
  setLabel?: MaybeFn<string | undefined>;
  /** Icons drawn at once; scrolling to the end of the grid draws as many more (default 240). @tr Bir kerede çizilen ikon sayısı; ızgaranın sonuna kaydırınca bir o kadar daha çizilir (varsayılan 240). */
  pageSize?: number | undefined;
  /** The filter chips (default ICON_GROUPS); false: none. @tr Süzgeç chip'leri (varsayılan ICON_GROUPS); false: yok. */
  groups?: readonly IconGroup[] | false | undefined;
  /** The panel right in the page instead of behind a button (a sidebar, a form section). @tr Panel bir düğmenin arkası yerine doğrudan sayfada (kenar çubuğu, form bölümü). */
  inline?: boolean | undefined;
  /** A "No icon" choice (default true). @tr "No icon" seçeneği (varsayılan true). */
  none?: boolean | undefined;
  /** Accessible name of the button and the panel (default "Icon"). @tr Düğmenin ve panelin erişilebilir adı (varsayılan "Icon"). */
  label?: MaybeFn<string | undefined>;
  /** Placeholder of the search field (default "Search icons"). @tr Arama alanının yer tutucusu (varsayılan "Search icons"). */
  placeholder?: MaybeFn<string | undefined>;
  /** Size of the button: `sm` (default) or `md`. @tr Düğmenin boyutu: `sm` (varsayılan) ya da `md`. */
  size?: "sm" | "md" | undefined;
  /** Extra CSS classes on the root element. @tr Kök öğeye eklenen CSS sınıfları. */
  class?: ClassProp;
}

const words = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/-/g, " ").toLowerCase();

// a pack's icons, loaded once for the page (every picker shares them)
const loaded = signal<Readonly<Record<string, Readonly<Record<string, IconDef>>>>>({});
const loading = new Map<string, Promise<unknown>>();
const ensure = (pack: IconPickerPack): void => {
  if (loaded.peek()[pack.id] || loading.has(pack.id)) return;
  loading.set(pack.id, pack.load().then((set) => loaded.set({ ...loaded.peek(), [pack.id]: set }), () => undefined).finally(() => loading.delete(pack.id)));
};
/** "lucide:arrow-left" → ["lucide", "arrow-left"]; a name of `icons` → ["", name]. */
const split = (v: string): [string, string] => { const i = v.indexOf(":"); return i < 0 ? ["", v] : [v.slice(0, i), v.slice(i + 1)]; };

/** `<IconPicker value={$icon} onChange={(n) => $icon = n} />` */
export function IconPicker(props: IconPickerProps): unknown {
  const base = props.icons ?? ICONS;
  const packs = props.packs ?? [];
  const step = props.pageSize ?? 240;
  const own = signal<string | null>(null);
  const value = (): string | null => {
    const v = props.value as unknown;
    if (v === undefined) return own();
    const x = typeof v === "function" ? (v as () => unknown)() : v;
    // only a name counts (a tool handing over an icon object or a number must not throw on split)
    return typeof x === "string" ? x : null;
  };
  const pick = (n: string | null): void => {
    const v = props.value as { set?: (x: string | null) => void } | undefined;
    if (typeof v?.set === "function") v.set(n); else if (props.value === undefined) own.set(n);
    props.onChange?.(n);
  };
  /** The icon a value names (a pack's once it is loaded; asking loads it). */
  const defOf = (v: string): IconDef | undefined => {
    const [id, n] = split(v);
    if (!id) return base[n];
    const p = packs.find((x) => x.id === id);
    if (p) ensure(p);
    return loaded()[id]?.[n];
  };
  // the sets shown ("" is `icons`; several at once): the value's own at first
  const first = split(value() ?? "")[0];
  const setIds = signal<string[]>([packs.some((p) => p.id === first) ? first : ""]);
  /** A set's icons, or null while it loads (choosing a pack loads it). */
  const iconsOf = (id: string): Readonly<Record<string, IconDef>> | null => {
    const p = packs.find((x) => x.id === id);
    if (!p) return base;
    ensure(p);
    return loaded()[p.id] ?? null;
  };
  /** Every chosen set is there (none is still loading). */
  const ready = (): boolean => setIds().every((id) => iconsOf(id) !== null);
  const q = signal(""), chosenGroups = signal<string[]>([]), limit = signal(step);
  const groups = props.groups === false ? [] : props.groups ?? ICON_GROUPS;
  /** The icons that fit: of every chosen set (in the chips' order), in any chosen filter, holding the search. */
  const shown = computed((): { v: string; n: string; d: IconDef }[] => {
    const needle = q().trim().toLowerCase(), gs = groups.filter((x) => chosenGroups().includes(x.id)), out: { v: string; n: string; d: IconDef }[] = [];
    for (const id of setIds()) {
      const icons = iconsOf(id);
      if (!icons) continue;
      for (const n of Object.keys(icons)) {
        const d = icons[n] as IconDef;
        if (gs.length && !gs.some((g) => (typeof g.match === "function" ? g.match(n, d) : g.match.test(n)))) continue;
        if (needle && !(words(n).includes(needle) || n.toLowerCase().includes(needle) || (d.name ?? "").includes(needle) || t(words(n)).toLowerCase().includes(needle))) continue;
        out.push({ v: id ? `${id}:${n}` : n, n, d });
      }
    }
    return out;
  });
  // a new search, filter or set starts at the first page again
  const restart = (): void => limit.set(step);
  /** Add or take out a chip's value (a set: at least one stays). */
  const toggle = (list: typeof setIds, v: string, keepOne: boolean): void => {
    const now = list.peek(), on = now.includes(v);
    if (on && keepOne && now.length === 1) return;
    list.set(on ? now.filter((x) => x !== v) : [...now, v]);
    restart();
  };
  const name = (): string => { const v = value(); return v ? words(split(v)[1]) : t`No icon`; };
  const trigger = [() => { const v = value(), d = v ? defOf(v) : undefined; return d ? icon(d, "m-icon m-ipk-cur") : h("span", { class: "m-ipk-none", "aria-hidden": "true" }); }, h("span", { class: "m-ipk-name" }, name)];
  // the next page when the grid is scrolled near its end
  const more = (e: Event): void => {
    const el = e.currentTarget as HTMLElement;
    if (limit.peek() < shown().length && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) limit.set(limit.peek() + step);
  };
  const sets = (): { value: string; label: string }[] => [
    { value: "", label: `${val(props.setLabel) ?? "March"} (${Object.keys(base).length})` },
    ...packs.map((p) => ({ value: p.id, label: p.count ? `${val(p.label)} (${p.count})` : val(p.label) })),
  ];
  const grid = (close: (refocus?: boolean) => void): unknown => {
    if (!shown().length && !ready()) return h("div", { class: "m-ipk-loading" }, h(Spinner, { size: "sm", label: () => t`Loading icons` }));
    if (!shown().length) return h(Empty, { size: "sm", title: () => t`No icon matches` });
    return h("div", { class: "m-ipk-grid", role: "listbox", "aria-label": () => val(props.label) ?? t`Icon`, onScroll: more },
      props.none === false ? null : h(IconButton, { class: "m-ipk-item m-ipk-off", label: () => t`No icon`, pressed: () => value() === null, onClick: () => { pick(null); close(true); } }, h("span", { class: "m-ipk-none", "aria-hidden": "true" })),
      () => shown().slice(0, limit()).map(({ v, n, d }) => h(IconButton, { class: "m-ipk-item", icon: d, label: words(n), pressed: () => value() === v, onClick: () => { pick(v); close(true); } })));
  };
  const panel = (close: (refocus?: boolean) => void, cls?: unknown): Element => h("div", { class: cx("m-ipk", cls as string), role: "group", "aria-label": () => val(props.label) ?? t`Icon` },
      packs.length ? h("div", { class: "m-ipk-sets", role: "group", "aria-label": () => t`Icon set` },
        sets().map((x) => h(Chip, { size: "sm", selected: () => setIds().includes(x.value), onClick: () => toggle(setIds, x.value, true) }, x.label))) : null,
      h(SearchBox, { value: q, size: "sm", placeholder: () => val(props.placeholder) ?? t`Search icons`, label: () => t`Search icons`, debounce: 0, onSearch: restart }),
      groups.length ? h("div", { class: "m-ipk-groups", role: "group", "aria-label": () => t`Filter` },
        groups.map((g) => h(Chip, { size: "sm", selected: () => chosenGroups().includes(g.id), onClick: () => toggle(chosenGroups, g.id, false) }, () => val(g.label)))) : null,
      () => { shown(); ready(); return grid(close); },
      h("p", { class: "m-ipk-count", "aria-live": "polite" }, () => (ready() ? t`${shown().length} icons` : t`Loading icons`))) as Element;
  if (props.inline) return panel(() => undefined, cx("m-ipk-inline", val(props.class)));
  return h(Dropdown, {
    trigger, variant: "secondary", size: props.size ?? "sm", label: () => `${val(props.label) ?? t`Icon`}: ${name()}`, placement: "bottom-start",
    class: cx("m-ipk-btn", val(props.class)), panelClass: "m-ipk-panel",
    children: (close: (refocus?: boolean) => void) => panel(close),
  });
}
