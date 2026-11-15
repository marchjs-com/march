// IconPicker (hadi-march/ui): choose an icon. A button shows the chosen icon and its name; it opens a panel with a search
// (by name, Turkish or English words), filter chips (arrows, files, media, messages, people, layout, filled) and a grid
// of every icon. Composed of Dropdown, SearchBox, Chip, IconButton and Empty. The value is the icon's export name
// ("plus"); `icons` takes another set (default: every built-in icon).
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

export interface IconPickerProps {
  /** The chosen icon's name (a signal, a value or an accessor); null: none. */
  value?: Signal<string | null> | MaybeFn<string | null | undefined>;
  onChange?: ((name: string | null) => void) | undefined;
  /** The icons to choose from (default every built-in icon). */
  icons?: Readonly<Record<string, IconDef>> | undefined;
  /** The filter chips (default ICON_GROUPS); false: none. */
  groups?: readonly IconGroup[] | false | undefined;
  /** The panel right in the page instead of behind a button (a sidebar, a form section). */
  inline?: boolean | undefined;
  /** A "No icon" choice (default true). */
  none?: boolean | undefined;
  /** Accessible name of the button and the panel (default "Icon"). */
  label?: MaybeFn<string | undefined>;
  placeholder?: MaybeFn<string | undefined>;
  size?: "sm" | "md" | undefined;
  class?: ClassProp;
}

const words = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();

/** `<IconPicker value={$icon} onChange={(n) => $icon = n} />` */
export function IconPicker(props: IconPickerProps): unknown {
  const set = props.icons ?? ICONS;
  const names = Object.keys(set);
  const own = signal<string | null>(null);
  const value = (): string | null => {
    const v = props.value as unknown;
    if (v === undefined) return own();
    return (typeof v === "function" ? (v as () => string | null | undefined)() : (v as string | null)) ?? null;
  };
  const pick = (n: string | null): void => {
    const v = props.value as { set?: (x: string | null) => void } | undefined;
    if (typeof v?.set === "function") v.set(n); else if (props.value === undefined) own.set(n);
    props.onChange?.(n);
  };
  const q = signal(""), group = signal<string | null>(null);
  const groups = props.groups === false ? [] : props.groups ?? ICON_GROUPS;
  const shown = computed(() => {
    const needle = q().trim().toLowerCase();
    const g = groups.find((x) => x.id === group());
    return names.filter((n) => {
      const d = set[n] as IconDef;
      if (g && !(typeof g.match === "function" ? g.match(n, d) : g.match.test(n))) return false;
      return !needle || words(n).includes(needle) || n.toLowerCase().includes(needle) || (d.name ?? "").includes(needle) || t(words(n)).toLowerCase().includes(needle);
    });
  });
  const name = (): string => { const v = value(); return v ? words(v) : t`No icon`; };
  const trigger = [() => { const v = value(); return v && set[v] ? icon(set[v], "m-icon m-ipk-cur") : h("span", { class: "m-ipk-none", "aria-hidden": "true" }); }, h("span", { class: "m-ipk-name" }, name)];
  const panel = (close: (refocus?: boolean) => void, cls?: unknown): Element => h("div", { class: cx("m-ipk", cls as string), role: "group", "aria-label": () => val(props.label) ?? t`Icon` },
      h(SearchBox, { value: q, size: "sm", placeholder: () => val(props.placeholder) ?? t`Search icons`, label: () => t`Search icons`, debounce: 0 }),
      groups.length ? h("div", { class: "m-ipk-groups", role: "group", "aria-label": () => t`Filter` },
        groups.map((g) => h(Chip, { size: "sm", selected: () => group() === g.id, onClick: () => group.set(group.peek() === g.id ? null : g.id) }, () => val(g.label)))) : null,
      () => (shown().length
        ? h("div", { class: "m-ipk-grid", role: "listbox", "aria-label": () => val(props.label) ?? t`Icon` },
          props.none === false ? null : h(IconButton, { class: "m-ipk-item m-ipk-off", label: () => t`No icon`, pressed: () => value() === null, onClick: () => { pick(null); close(true); } }, h("span", { class: "m-ipk-none", "aria-hidden": "true" })),
          shown().map((n) => h(IconButton, { class: "m-ipk-item", icon: set[n], label: words(n), pressed: () => value() === n, onClick: () => { pick(n); close(true); } })))
        : h(Empty, { size: "sm", title: () => t`No icon matches` })),
      h("p", { class: "m-ipk-count", "aria-live": "polite" }, () => t`${shown().length} icons`)) as Element;
  if (props.inline) return panel(() => undefined, cx("m-ipk-inline", val(props.class)));
  return h(Dropdown, {
    trigger, variant: "secondary", size: props.size ?? "sm", label: () => `${val(props.label) ?? t`Icon`}: ${name()}`, placement: "bottom-start",
    class: cx("m-ipk-btn", val(props.class)), panelClass: "m-ipk-panel",
    children: (close: (refocus?: boolean) => void) => panel(close),
  });
}
