// FontPicker (hadi-march/ui): choose a typeface from the fonts of the device and a web font catalog (Google Fonts by
// default) in one searchable list. Each name is drawn in its own type (only the letters shown are requested, only for
// the rows in view), a specimen shows your own sample text with size, weight and italic, and the list narrows by
// category, subset, favourites and order. It opens as a popover, a dialog, or sits inline. Folder:
// src/components/composite/font-picker/.
//   <FontPicker bind:value={$font} onPick={(f) => setTheme({ font: f.stack })} />
import "./font-picker.css";
import { signal, computed, effect, untrack, batch, onCleanup, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { cx, uid, val, setStyle, type ClassProp } from "../../../core/util.ts";
import { model, ctl, live, listNav, type ControlProps } from "../../../forms/util.ts";
import { formatCount } from "../../../ui/format.ts";
import { persisted } from "../../../managers/storage/index.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { VirtualList, type VirtualListApi } from "../../data/virtual-list/index.ts";
import { Alert } from "../../feedback/alert/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import { Segmented } from "../../forms/segmented/index.ts";
import { Select } from "../../forms/select/index.ts";
import { Slider } from "../../forms/slider/index.ts";
import { Textarea } from "../../forms/textarea/index.ts";
import { Toggle } from "../../forms/toggle/index.ts";
import { Dialog } from "../../overlays/dialog/index.ts";
import { Popover } from "../../overlays/popover/index.ts";
import { SectionLabel } from "../../typography/section-label/index.ts";
import { star } from "../../../icons/glyphs/star.ts";
import { starFilled } from "../../../icons/glyphs/starFilled.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { Icon } from "../../../icons/index.ts";
import { monitor } from "../../../icons/glyphs/monitor.ts";
import { chevronsUpDown } from "../../../icons/glyphs/chevronsUpDown.ts";
import {
  SYSTEM_FONTS, FONT_CATEGORIES, filterFonts, fontStack, fontUrl, googleFonts, loadFontSheet, nearestWeight,
  type FontCategory, type FontFamily, type FontSort, type FontSource,
} from "./fonts.ts";
import tr from "./tr.ts";
import { withColor } from "../../../theme/colors.ts";

messages("tr", tr);

export * from "./fonts.ts";

/** What a pick hands over: the family, the CSS to use it and the style chosen. */
export interface FontChoice {
  family: string;
  /** The CSS `font-family` value: `"Inter", sans-serif`. */
  stack: string;
  category: FontCategory;
  source: "system" | "web";
  weight: number;
  italic: boolean;
  /** The stylesheet that brings this style from the font source (null: a system font, or no source). */
  url: string | null;
  font: FontFamily;
}

/** The texts FontPicker writes itself; every one is optional (default: the built-in text). */
export interface FontPickerLabels {
  picker?: string; placeholder?: string; title?: string; done?: string; search?: string; list?: string; category?: string; all?: string;
  sansSerif?: string; serif?: string; display?: string; handwriting?: string; monospace?: string;
  sort?: string; popular?: string; name?: string; newest?: string; subset?: string; allSubsets?: string;
  favorites?: string; onlyFavorites?: string; addFavorite?: string; removeFavorite?: string; recent?: string; system?: string; web?: string;
  device?: string; deviceFonts?: string; empty?: string; loading?: string; failed?: string; retry?: string;
  consent?: string; allow?: string; sample?: string; sampleText?: string; size?: string; weight?: string; italic?: string; copy?: string;
  count?: (n: number) => string; styles?: (n: number) => string;
}

export interface FontPickerProps extends ControlProps<string> {
  /** How the picker shows: "popover" (default: a panel by its button), "dialog" (a window), "inline" (the panel itself). */
  view?: "popover" | "dialog" | "inline" | undefined;
  /** Fonts of the device: true (default: the built-in list), false, or your own families (`source: "system"`, `stack`). */
  system?: boolean | readonly FontFamily[] | undefined;
  /** Web fonts: the built-in Google Fonts catalog (default, loaded when the picker first opens), your own families, a function that loads them, or false. */
  catalog?: false | readonly FontFamily[] | (() => Promise<readonly FontFamily[]>) | undefined;
  /** Where web fonts are loaded from: "google" (default), the address of your own server that answers `/css2?family=…`, a function `(request) => stylesheet address`, or false (never load). */
  source?: FontSource | undefined;
  /** Ask before the first request to the font source (it sees the visitor's address); the answer is remembered. Default false. */
  askConsent?: boolean | undefined;
  /** Every pick and every change of weight / italic, with the CSS to use the font. */
  onPick?: ((choice: FontChoice) => void) | undefined;
  /** Weight chosen at first (default 400; the family's nearest weight is used). */
  weight?: number | undefined;
  /** Italic at first. */
  italic?: boolean | undefined;
  /** Load the picked web font into the page before the value changes (default true); false: you load it (`onPick` gives `url`). */
  load?: boolean | undefined;
  /** What a row draws in its type: "name" (default) or "sample" (the sample text, the name under it). */
  preview?: "name" | "sample" | undefined;
  /** The sample text of the specimen (and of the rows with `preview="sample"`). */
  sample?: string | undefined;
  /** The sample text was edited. */
  onSample?: ((text: string) => void) | undefined;
  /** Category shown at first / followed when it changes ("all" by default). */
  category?: FontCategory | "all" | undefined;
  /** Order: "popular" (default), "name", "newest". */
  sort?: FontSort | undefined;
  /** Only families with this subset ("latin-ext", "cyrillic", "arabic"…); "all" by default. */
  subset?: string | undefined;
  /** The search field (default true). */
  search?: boolean | undefined;
  /** The category switcher: true (default), false, or the categories to offer. */
  categories?: boolean | readonly FontCategory[] | undefined;
  /** The order switcher: true (default), false, or the orders to offer. */
  sorts?: boolean | readonly FontSort[] | undefined;
  /** The subset list: true (default: every subset of the catalog), false, or the subsets to offer. */
  subsets?: boolean | readonly string[] | undefined;
  /** Favourites: the star on each row, the Favourites group and the "only favourites" filter (default true). */
  favorites?: boolean | undefined;
  /** A star was pressed. */
  onFavorite?: ((family: string, on: boolean) => void) | undefined;
  /** Recent picks kept in their own group (default 5; 0: none). */
  recent?: number | undefined;
  /** The specimen: the chosen font with your sample text, size, weight, italic and the CSS (default true). */
  specimen?: boolean | undefined;
  /** In the specimen: the size slider (default true). */
  sizeControl?: boolean | undefined;
  /** In the specimen: weight and italic (default true). */
  styleControls?: boolean | undefined;
  /** In the specimen: the `font-family` line with a copy button (default true). */
  css?: boolean | undefined;
  /** The second line of a row: category and number of styles (default true). */
  meta?: boolean | undefined;
  /** How many families match, next to the filters (default true). */
  count?: boolean | undefined;
  /** "Fonts on this device" where the browser can list them (asks the visitor; default true). */
  deviceFonts?: boolean | undefined;
  /** Close the popover / dialog after a pick (default false: weight and italic can still be set). */
  closeOnPick?: boolean | undefined;
  /** Where favourites, recent picks and the consent are remembered (default "fonts"); false: only while the page is open. */
  storageKey?: string | false | undefined;
  /** Open state of the popover / dialog (yours); without it the picker keeps its own. */
  open?: boolean | Signal<boolean> | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Your own button: a node, or `(api) => node` with `api.toggle()`, `api.font()`. Default: a button with the name in its type. */
  trigger?: unknown | ((api: { toggle(): void; open(): void; close(): void; font(): FontFamily | undefined }) => unknown) | undefined;
  /** Size of the default button. */
  size?: "sm" | "md" | "lg" | undefined;
  /** Where the popover opens (default "bottom-start"). */
  placement?: "bottom-start" | "bottom" | "bottom-end" | "top-start" | "top" | "top-end" | undefined;
  /** Entrance of the popover / dialog: "scale" (default), "fade", "rise", "none". */
  motion?: "scale" | "fade" | "rise" | "none" | undefined;
  /** Draw the inside of a row yourself. */
  renderRow?: ((font: FontFamily, state: { selected: boolean; favorite: boolean }) => unknown) | undefined;
  /** Shown when nothing matches: text or a node (default "No fonts match"). */
  empty?: unknown;
  /** Own texts. */
  labels?: FontPickerLabels | undefined;
  class?: ClassProp;
  /** Class of the panel (the popover, the dialog body or the inline box). */
  panelClass?: string | undefined;
}

type Row = { key: string; head: string; count: number } | { key: string; font: FontFamily };
const WEIGHT_NAMES: Record<number, () => string> = {
  100: () => t`Thin`, 200: () => t`Extra light`, 300: () => t`Light`, 400: () => t`Regular`, 500: () => t`Medium`,
  600: () => t`Semi bold`, 700: () => t`Bold`, 800: () => t`Extra bold`, 900: () => t`Black`,
};
const SUBSET_NAMES: Record<string, () => string> = {
  latin: () => t`Latin`, "latin-ext": () => t`Latin extended (Turkish, Central European)`, cyrillic: () => t`Cyrillic`, "cyrillic-ext": () => t`Cyrillic extended`,
  greek: () => t`Greek`, "greek-ext": () => t`Greek extended`, vietnamese: () => t`Vietnamese`, arabic: () => t`Arabic`, hebrew: () => t`Hebrew`,
  japanese: () => t`Japanese`, korean: () => t`Korean`, "chinese-simplified": () => t`Chinese (simplified)`, "chinese-traditional": () => t`Chinese (traditional)`,
  devanagari: () => t`Devanagari`, thai: () => t`Thai`, math: () => t`Math`, symbols: () => t`Symbols`, emoji: () => t`Emoji`,
};
const subsetName = (s: string): string => SUBSET_NAMES[s]?.() ?? s.replace(/(^|-)([a-z])/g, (_m, a: string, b: string) => (a ? " " : "") + b.toUpperCase());
type LocalFonts = () => Promise<{ family: string }[]>;

/** Font picker: `<FontPicker bind:value={$font} />`. The value is the family name; `onPick` gives the CSS stack, the weight and the stylesheet. */
export function FontPicker(props: FontPickerProps): unknown {
  const [get, set] = model(props, "");
  const id = uid("m-fp"), listId = `${id}-list`;
  const c = ctl(props);
  const ro = (): boolean => !!(props.readonly || props.disabled);
  const L = (): FontPickerLabels => props.labels ?? {};
  const view = untrack(() => props.view ?? "popover");
  const store = <T>(name: string, initial: T): Signal<T> => (props.storageKey === false ? signal<T>(initial) : persisted<T>(`${props.storageKey ?? "fonts"}.${name}`, initial));
  const favs = store<string[]>("favorites", []), recent = store<string[]>("recent", []), agreed = store<boolean>("consent", false);
  const allowed = (): boolean => props.source !== false && (!props.askConsent || agreed());

  // ------------------------------------------------------------------ state
  const query = signal(""), category = signal<FontCategory | "all">("all"), sort = signal<FontSort>("popular"), subset = signal("all"), onlyFavs = signal(false);
  const weight = signal(untrack(() => props.weight ?? 400)), italic = signal(untrack(() => !!props.italic));
  const sample = signal(""), size = signal(30), pending = signal<string | null>(null), active = signal(-1);
  const web = signal<readonly FontFamily[]>([]), status = signal<"idle" | "loading" | "ready" | "failed">("idle"), device = signal<readonly FontFamily[] | null>(null);
  const isOpen = signal(false);
  effect(() => { const v = props.category; if (v) category.set(v); });
  effect(() => { const v = props.sort; if (v) sort.set(v); });
  effect(() => { const v = props.subset; if (v) subset.set(v); });
  effect(() => { const v = props.weight; if (v) weight.set(v); });
  effect(() => { const v = props.italic; if (v != null) italic.set(v); });
  effect(() => { sample.set(props.sample ?? L().sampleText ?? t`The quick brown fox jumps over the lazy dog. 0123456789`); });
  effect(() => { const o = val(props.open as Signal<boolean> | boolean | undefined); if (o != null) isOpen.set(o); });
  const setOpen = (v: boolean): void => {
    if (v === isOpen.peek() || (v && ro())) return;
    const o = props.open as Partial<Signal<boolean>> | boolean | undefined;
    if (typeof o === "function" && o.signal) o.set?.(v); else if (o === undefined) isOpen.set(v);
    props.onOpenChange?.(v);
    if (!v) { query.set(""); active.set(-1); }
  };

  const system = (): readonly FontFamily[] => device() ?? (props.system === false ? [] : Array.isArray(props.system) ? (props.system as readonly FontFamily[]) : SYSTEM_FONTS);
  const byName = computed(() => { const m = new Map<string, FontFamily>(); for (const f of web()) m.set(f.family, f); for (const f of system()) m.set(f.family, f); return m; });
  const shown = (): string => pending() ?? get();
  const current = (): FontFamily | undefined => byName().get(shown());
  const styleOf = (font: FontFamily): { weight: number; italic: boolean } => { const w = nearestWeight(font, weight()); return { weight: w, italic: italic() && font.italics.includes(w) }; };

  // the catalog: its own lazy part, asked for when the list is first shown
  const loadCatalog = (): void => {
    const src = props.catalog;
    if (src === false) { web.set([]); status.set("ready"); return; }
    if (Array.isArray(src)) { web.set(src as readonly FontFamily[]); status.set("ready"); return; }
    status.set("loading");
    ((src as (() => Promise<readonly FontFamily[]>) | undefined) ?? googleFonts)().then((list) => { web.set(list); status.set("ready"); }, () => status.set("failed"));
  };
  const ensureCatalog = (): void => { if (untrack(status) === "idle") untrack(loadCatalog); };
  // another catalog while the list is already shown: load that one
  effect(() => { void props.catalog; if (untrack(status) !== "idle") untrack(loadCatalog); });

  // ------------------------------------------------------------------ type on an element, once its font is in
  // a system font: its stack at once. A web font: the stylesheet (only `text`'s letters when given) is asked for after
  // a short stay in view, and the family is set when the face has arrived (no half-drawn text).
  const typeOn = (el: HTMLElement, font: () => FontFamily | undefined, opts: { text?: () => string; style?: () => { weight: number; italic: boolean }; delay?: number } = {}): void => {
    effect(() => {
      const f = font();
      if (!f) { setStyle(el, { "font-family": null, "font-weight": null, "font-style": null }); return; }
      const st = opts.style?.() ?? { weight: nearestWeight(f, 400), italic: false };
      const paint = (): void => { setStyle(el, { "font-family": fontStack(f), "font-weight": st.weight, "font-style": st.italic ? "italic" : null }); el.classList.add("is-typed"); };
      if (f.source === "system") { paint(); return; }
      if (!allowed()) return;
      const text = opts.text?.();
      const url = fontUrl(props.source, { family: f.family, weights: st.italic ? [] : [st.weight], italics: st.italic ? [st.weight] : [], text });
      if (!url) return;
      let live = true;
      const timer = setTimeout(() => { void loadFontSheet(url, { family: f.family, weight: st.weight, italic: st.italic, text }).then((ok) => { if (ok && live) paint(); }); }, opts.delay ?? 0);
      onCleanup(() => { live = false; clearTimeout(timer); });
    });
  };

  // ------------------------------------------------------------------ picking
  const choiceOf = (font: FontFamily, w: number, it: boolean): FontChoice => ({
    family: font.family, stack: fontStack(font), category: font.category, source: font.source, weight: w, italic: it, font,
    url: font.source === "web" ? fontUrl(props.source, { family: font.family, weights: it ? [] : [w], italics: it ? [w] : [] }) : null,
  });
  let turn = 0;
  const commit = async (font: FontFamily, close: boolean): Promise<void> => {
    const mine = ++turn, st = untrack(() => styleOf(font)), choice = choiceOf(font, st.weight, st.italic);
    if (choice.url && props.load !== false && untrack(allowed)) {
      await Promise.race([loadFontSheet(choice.url, { family: font.family, weight: st.weight, italic: st.italic }), new Promise((r) => setTimeout(r, 2500))]);
      if (mine !== turn) return;
    }
    const n = props.recent ?? 5;
    batch(() => {
      pending.set(null);
      if (n > 0) recent.set([font.family, ...recent.peek().filter((x) => x !== font.family)].slice(0, n));
      if (untrack(get) !== font.family) set(font.family);
    });
    props.onPick?.(choice);
    if (close && props.closeOnPick) setOpen(false);
  };
  const choose = (font: FontFamily): void => { if (ro()) return; pending.set(font.family); void commit(font, true); };
  const restyle = (): void => { const f = untrack(current); if (f && !ro()) void commit(f, false); };
  const isFav = (family: string): boolean => favs().includes(family);
  const toggleFav = (family: string): void => {
    const on = !favs.peek().includes(family);
    favs.set(on ? [family, ...favs.peek()] : favs.peek().filter((x) => x !== family));
    props.onFavorite?.(family, on);
  };

  // ------------------------------------------------------------------ rows: groups and families, one flat list
  const rows = computed<Row[]>(() => {
    const f = { query: query(), category: category(), subset: subset(), sort: sort() };
    const sysList = filterFonts(system(), f), webList = filterFonts(web(), f), out: Row[] = [];
    const group = (key: string, head: string, list: readonly FontFamily[]): void => {
      if (!list.length) return;
      out.push({ key, head, count: list.length });
      for (const font of list) out.push({ key: `${key}:${font.family}`, font });
    };
    const named = (names: readonly string[]): FontFamily[] => filterFonts(names.map((n) => byName().get(n)).filter((x): x is FontFamily => !!x), { ...f, sort: "popular" });
    const useFavs = props.favorites !== false;
    if (useFavs && onlyFavs()) { group("fav", L().favorites ?? t`Favorites`, named(favs())); return out; }
    if (!f.query) {
      if (useFavs) group("fav", L().favorites ?? t`Favorites`, named(favs()));
      if ((props.recent ?? 5) > 0) group("recent", L().recent ?? t`Recent`, named(recent()));
    }
    group("system", device() ? L().device ?? t`This device` : L().system ?? t`System`, sysList);
    group("web", L().web ?? (!props.catalog && (!props.source || props.source === "google") ? "Google Fonts" : t`Web fonts`), webList);
    return out;
  });
  const options = computed(() => { const out: number[] = []; rows().forEach((r, i) => { if ("font" in r) out.push(i); }); return out; });
  const total = computed(() => rows().reduce((n, r) => n + ("head" in r && (r.key === "system" || r.key === "web" || onlyFavs()) ? r.count : 0), 0));
  const activeKey = (): string | null => { const i = options()[active()]; return i == null ? null : (rows()[i] as Row).key; };
  const optionId = (key: string): string => `${id}-o-${key.replace(/[^\w-]+/g, "_")}`;
  // a new search or filter: the first match is the one Enter picks
  effect(() => { rows(); active.set(untrack(query) ? 0 : -1); });

  let list: VirtualListApi | undefined;
  // and the list starts from its top again
  effect(() => { query(); category(); subset(); sort(); onlyFavs(); list?.scrollToIndex(0, "start"); });
  const keys = listNav({
    count: () => options().length, active, loop: false,
    onPick: (i) => { const r = rows()[options()[i] as number]; if (r && "font" in r) choose(r.font); },
    onMove: (i) => list?.scrollToIndex(options()[i] as number),
  });

  const localFonts = (globalThis as { queryLocalFonts?: LocalFonts }).queryLocalFonts;
  const askDevice = async (): Promise<void> => {
    if (device.peek()) { device.set(null); return; }
    try {
      const names = [...new Set((await localFonts!()).map((x) => x.family))].sort((a, b) => a.localeCompare(b));
      if (names.length) device.set(names.map((family): FontFamily => ({ family, category: "sans-serif", source: "system", weights: [400, 700], italics: [400, 700], subsets: [], stack: `"${family.replace(/["\\]/g, "")}", sans-serif` })));
    } catch { /* not allowed: the built-in list stays */ }
  };
  // ------------------------------------------------------------------ a row
  const row = (item: () => Row): unknown => {
    const r = untrack(item);
    if ("head" in r) return h(SectionLabel, {
      class: "m-fp-group", size: "sm", count: () => { const x = item(); return "head" in x ? formatCount(x.count, "full") : null; },
      // the fonts of this very device, where the browser can list them (it asks the visitor first)
      actions: r.key !== "system" || !localFonts ? undefined : () => (props.deviceFonts === false ? null : h(IconButton, {
        class: "m-fp-device", size: "xs", icon: monitor, pressed: () => !!device(), label: () => L().deviceFonts ?? t`Fonts on this device`, onClick: () => void askDevice(),
      })),
    }, () => { const x = item(); return "head" in x ? x.head : ""; });
    const font = r.font, fav = (): boolean => isFav(font.family), selected = (): boolean => shown() === font.family;
    const own = props.renderRow;
    const name = h("span", { class: "m-fp-name" }, () => (props.preview === "sample" ? sample() : font.family)) as HTMLElement;
    typeOn(name, () => font, { text: () => (props.preview === "sample" ? sample() : font.family), delay: 120 });
    const styles = font.weights.length + font.italics.length;
    const meta = (): string => [props.preview === "sample" ? font.family : null, categoryName(font.category), L().styles?.(styles) ?? t`${styles} styles`].filter(Boolean).join(" · ");
    return h(ListRow, {
      as: "div", role: "option", id: optionId(r.key), class: "m-fp-row", interactive: true, overflow: "ellipsis",
      "aria-label": font.family, "aria-setsize": () => String(options().length),
      selected: live(selected), active: live(() => activeKey() === r.key), disabled: live(ro),
      title: own ? () => own(font, { selected: selected(), favorite: fav() }) : name,
      sub: () => (own || props.meta === false ? null : meta()),
      trail: () => (selected() ? h(Icon, { of: check, class: "m-fp-tick" }) : null),
      actions: () => (props.favorites === false ? null : withColor(h(IconButton, {
        class: cx("m-fp-star", fav() && "is-on"), size: "sm", icon: fav() ? starFilled : star, pressed: fav(),
        label: fav() ? L().removeFavorite ?? t`Remove ${font.family} from favorites` : L().addFavorite ?? t`Add ${font.family} to favorites`,
        onClick: (e: MouseEvent) => { e.stopPropagation(); toggleFav(font.family); } }), fav() ? "brand-gold" : undefined)),
      onClick: () => choose(font),
    });
  };
  const categoryName = (cat: FontCategory | "all"): string => {
    const l = L();
    return cat === "all" ? l.all ?? t`All` : cat === "sans-serif" ? l.sansSerif ?? t`Sans` : cat === "serif" ? l.serif ?? t`Serif` : cat === "display" ? l.display ?? t`Display`
      : cat === "handwriting" ? l.handwriting ?? t`Script` : l.monospace ?? t`Mono`;
  };

  // ------------------------------------------------------------------ the panel: tools, list, specimen
  const tools = (): unknown => {
    const cats = (): readonly (FontCategory | "all")[] => ["all", ...(Array.isArray(props.categories) ? (props.categories as readonly FontCategory[]) : FONT_CATEGORIES)];
    const sorts = (): readonly FontSort[] => (Array.isArray(props.sorts) ? (props.sorts as readonly FontSort[]) : ["popular", "name", "newest"]);
    const sortName = (s: FontSort): string => (s === "popular" ? L().popular ?? t`Popular` : s === "name" ? L().name ?? t`A–Z` : L().newest ?? t`New`);
    const subsetList = computed(() => {
      if (Array.isArray(props.subsets)) return props.subsets as readonly string[];
      const n = new Map<string, number>();
      for (const f of web()) for (const s of f.subsets) n.set(s, (n.get(s) ?? 0) + 1);
      return [...n].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    });
    return h("div", { class: "m-fp-tools" },
      h("div", { class: "m-fp-find" },
        () => (props.search === false ? null : h(SearchBox, {
          class: "m-fp-search", value: query, debounce: 0, placeholder: L().search ?? t`Search fonts…`, label: L().search ?? t`Search fonts`,
          controls: listId, activeDescendant: () => { const k = activeKey(); return k ? optionId(k) : undefined; },
          onKeyDown: (e: KeyboardEvent) => { keys(e); }, inputRef: (el: HTMLInputElement) => el.setAttribute("data-autofocus", ""),
        })),
        () => (props.count === false ? null : h("span", { class: "m-fp-count", "aria-live": "polite" }, () => L().count?.(total()) ?? t`${formatCount(total(), "full")} fonts`))),
      () => (props.categories === false ? null : h(Segmented, {
        class: "m-fp-cats", "aria-label": L().category ?? t`Category`, value: live(() => category()), onChange: (v: FontCategory | "all" | null) => category.set(v ?? "all"),
        options: () => cats().map((x) => ({ value: x, label: categoryName(x) })),
      })),
      () => (props.sorts === false && props.subsets === false && props.favorites === false ? null : h("div", { class: "m-fp-filters" },
        () => (props.sorts === false ? null : h(Segmented, {
          class: "m-fp-sorts", "aria-label": L().sort ?? t`Order`, value: live(() => sort()), onChange: (v: FontSort | null) => sort.set(v ?? "popular"),
          options: () => sorts().map((x) => ({ value: x, label: sortName(x) })),
        })),
        () => (props.subsets === false || !subsetList().length ? null : h(Select, {
          class: "m-fp-subset", "aria-label": L().subset ?? t`Subset`, placeholder: false, value: live(() => subset()), onChange: (v: string | null) => subset.set(v ?? "all"),
          options: () => [{ value: "all", label: L().allSubsets ?? t`All subsets` }, ...subsetList().map((x) => ({ value: x, label: subsetName(x) }))],
        })),
        () => (props.favorites === false ? null : h(IconButton, {
          class: "m-fp-only", size: "sm", icon: () => (onlyFavs() ? starFilled : star), pressed: () => onlyFavs(), label: () => L().onlyFavorites ?? t`Only favorites`, onClick: () => onlyFavs.set(!onlyFavs.peek()),
        })))));
  };

  const specimen = (): unknown => {
    const box = h(Textarea, {
      class: "m-fp-sample", rows: 2, spellcheck: "false", "aria-label": live(() => L().sample ?? t`Sample text`),
      value: live(() => sample()), onChange: (v: string) => { sample.set(v); props.onSample?.(v); },
    }) as HTMLElement;
    const style = (): { weight: number; italic: boolean } => { const f = current(); return f ? styleOf(f) : { weight: 400, italic: false }; };
    const title = h("b", { class: "m-fp-spec-name" }, () => current()?.family ?? L().placeholder ?? t`Choose a font`) as HTMLElement;
    typeOn(box, current, { style });
    typeOn(title, current, { text: () => current()?.family ?? "" });
    effect(() => setStyle(box, { "--m-fp-size": `${size()}px` }));
    const cssLine = (): string => { const f = current(); return f ? `font-family: ${fontStack(f)};` : ""; };
    return h("div", { class: "m-fp-specimen" },
      h("div", { class: "m-fp-spec-head" },
        h("div", { class: "m-fp-spec-title" }, title,
          h("span", { class: "m-fp-spec-meta" }, () => { const f = current(); return f ? `${categoryName(f.category)} · ${f.source === "system" ? L().system ?? t`System` : L().web ?? t`Web font`}` : ""; })),
        () => { const f = current(); return !f || props.favorites === false ? null : withColor(h(IconButton, {
          class: cx("m-fp-star", isFav(f.family) && "is-on"), size: "sm", icon: isFav(f.family) ? starFilled : star, pressed: isFav(f.family),
          label: isFav(f.family) ? L().removeFavorite ?? t`Remove ${f.family} from favorites` : L().addFavorite ?? t`Add ${f.family} to favorites`, onClick: () => toggleFav(f.family) }), isFav(f.family) ? "brand-gold" : undefined); }),
      box,
      h("div", { class: "m-fp-controls" },
        () => (props.sizeControl === false ? null : h(Slider, {
          class: "m-fp-size", min: 12, max: 96, value: live(() => size()), onChange: (v: number) => size.set(v), format: (v: number) => `${v} px`,
          "aria-label": live(() => L().size ?? t`Size`), valueText: (v: number) => t`${v} pixels`,
        })),
        () => {
          const f = current();
          if (!f || props.styleControls === false) return null;
          return [
            f.weights.length > 1 ? h(Select, {
              class: "m-fp-weight", "aria-label": L().weight ?? t`Weight`, placeholder: false, value: live(() => style().weight), disabled: live(ro),
              options: f.weights.map((w) => ({ value: w, label: `${WEIGHT_NAMES[w]?.() ?? ""} ${w}`.trim() })),
              onChange: (w: number | null) => { if (w) { weight.set(w); restyle(); } },
            }) : null,
            f.italics.length ? h(Toggle, {
              class: "m-fp-italic", value: live(() => style().italic), disabled: live(() => ro() || !f.italics.includes(style().weight)), label: L().italic ?? t`Italic`,
              onChange: (v: boolean) => { italic.set(v); restyle(); },
            }) : null,
          ];
        }),
      () => (props.css === false || !current() ? null : h("div", { class: "m-fp-css" }, h("code", null, cssLine), h(CopyButton, { text: cssLine, iconOnly: true, label: L().copy ?? t`Copy the CSS` }))));
  };

  const panel = (): unknown => {
    ensureCatalog();
    const notice = (): unknown => (!props.askConsent || agreed() || props.source === false || !web().length ? null : h(Alert, {
      class: "m-fp-consent", tone: "info",
      body: L().consent ?? (!props.source || props.source === "google" ? t`Previews load the fonts from Google Fonts; Google sees your IP address.` : t`Previews load the fonts from the font server.`),
      action: h(Button, { size: "sm", variant: "primary", onClick: () => agreed.set(true) }, () => L().allow ?? t`Allow`),
    }));
    const foot = (): unknown => {
      const s = status();
      if (s === "loading") return h("p", { class: "m-fp-note", role: "status" }, L().loading ?? t`Loading the font list…`);
      if (s === "failed") return h("p", { class: "m-fp-note", role: "alert" }, L().failed ?? t`The font list could not be loaded.`, " ", h(Button, { size: "sm", variant: "link", onClick: loadCatalog }, L().retry ?? t`Try again`));
      if (options().length) return null;
      const e = props.empty;
      return e === false ? null : e != null && typeof e !== "string" ? e : h(Empty, { size: "sm", title: (e as string | undefined) ?? L().empty ?? t`No fonts match` });
    };
    // bring the chosen family into view once the list is there
    let placed = false;
    effect(() => {
      if (placed || status() !== "ready") return;
      const at = rows().findIndex((r) => "font" in r && (r.key.startsWith("system:") || r.key.startsWith("web:")) && r.font.family === untrack(shown));
      placed = true;
      if (at > 0) queueMicrotask(() => list?.scrollToIndex(at, "center"));
    });
    return h("div", {
      class: () => cx("m-fp-panel", `m-fp-in-${view}`, props.specimen === false && "is-plain", ro() && "is-readonly", props.panelClass), "data-m-color": c["data-m-color"],
      role: view === "inline" ? "group" : null, "aria-label": view === "inline" ? () => c["aria-label"]() ?? L().picker ?? t`Font picker` : null,
    },
    h("div", { class: "m-fp-browse" }, tools(), notice,
      h(VirtualList, {
        class: "m-fp-list", items: rows, key: (r: Row) => r.key, render: row, estimate: 52, overscan: 260, role: "listbox", id: listId,
        label: () => L().list ?? t`Fonts`, footer: foot, api: (a: VirtualListApi) => { list = a; },
      })),
    () => (props.specimen === false ? null : specimen()));
  };

  // ------------------------------------------------------------------ the button and the overlay
  if (view === "inline") return h("div", { class: () => cx("m-fp", "m-fp-inline", props.disabled && "is-disabled", val(props.class)) }, panel());

  const api = { toggle: () => setOpen(!isOpen.peek()), open: () => setOpen(true), close: () => setOpen(false), font: () => untrack(current) };
  const button = (): unknown => {
    if (typeof props.trigger === "function") return (props.trigger as (a: typeof api) => unknown)(api);
    if (props.trigger != null) { const el = props.trigger as HTMLElement; if (view === "dialog") el.addEventListener?.("click", api.toggle); return el; }
    const name = h("span", { class: "m-fp-trigger-name" }, () => get() || (L().placeholder ?? t`Choose a font`)) as HTMLElement;
    // the name in its own type: a system font at once, a web font once the catalog (or the page) has it
    typeOn(name, () => (get() ? current() ?? { family: get(), category: "sans-serif", source: "web", weights: [untrack(weight)], italics: [], subsets: [] } : undefined), { text: get });
    return h(Button, {
      id: c.id, class: "m-fp-trigger", variant: "secondary", size: props.size, iconEnd: chevronsUpDown, disabled: live(() => !!props.disabled),
      "aria-label": c["aria-label"], "aria-describedby": c["aria-describedby"], "aria-invalid": c["aria-invalid"], ...(view === "dialog" ? { "aria-haspopup": "dialog", "aria-expanded": () => String(isOpen()) } : {}),
      onBlur: props.onBlur, onFocus: props.onFocus, onClick: view === "dialog" ? api.toggle : undefined,
    }, h("span", { class: "m-fp-trigger-aa", "aria-hidden": "true" }, "Aa"), name);
  };
  const root = (overlay: unknown, trigger: unknown): unknown => h("span", { class: () => cx("m-fp", `m-fp-${view}`, val(props.class)), "data-m-color": c["data-m-color"] }, trigger, overlay);

  if (view === "dialog") {
    return root(h(Dialog, {
      open: () => isOpen(), onClose: () => setOpen(false), size: "lg", class: "m-fp-dialog", motion: props.motion,
      title: () => L().title ?? t`Choose a font`,
      footer: h(Button, { variant: "primary", onClick: () => setOpen(false) }, () => L().done ?? t`Done`),
      children: () => panel(),
    }), button());
  }
  return root(null, h(Popover, {
    // the default button and a node trigger get the click and the ARIA from Popover; a function trigger wires itself
    trigger: typeof props.trigger === "function" ? () => button() : button(),
    open: live(() => isOpen()), onOpenChange: (v: boolean) => setOpen(v), placement: props.placement, motion: props.motion, flush: true,
    panelClass: "m-fp-pop", label: () => L().picker ?? t`Font picker`,
    children: (_close: () => void) => panel(),
  }));
}
