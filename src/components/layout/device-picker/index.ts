// DevicePicker (march/layout): choose a device to preview on — dozens of phones, tablets and desktop screens (the
// DevicePreview catalog), each with its silhouette, size and pixel ratio; search, groups, portrait / landscape, and your
// own devices (name, width × height, pixel ratio, touch), saved in this browser.
//   <DevicePicker value={$device} landscape={$land} fit />          // "" is "fit the panel" (with `fit`)
import "./device-picker.css";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { signal, computed, untrack, type Signal } from "../../../core/reactive.ts";
import { cx, val, icon, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { model, type ControlProps } from "../../../forms/util.ts";
import { Field } from "../../../forms/field.ts";
import { SearchBox } from "../../forms/search-box/index.ts";
import { Segmented } from "../../forms/segmented/index.ts";
import { TextInput } from "../../forms/text-input/index.ts";
import { NumberInput } from "../../forms/number-input/index.ts";
import { Toggle } from "../../forms/toggle/index.ts";
import { Button } from "../../actions/button/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { ListRow } from "../../data/list-row/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { plus } from "../../../icons/glyphs/plus.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import { maximize } from "../../../icons/glyphs/maximize.ts";
import { allDevices, addDevice, removeDevice, isTouch, dprOf, type DeviceSpec, type DeviceKind } from "../device-preview/devices.ts";

messages("tr", {
  "Devices": "Cihazlar", "Search devices": "Cihaz ara", "All": "Tümü", "Phones": "Telefon", "Tablets": "Tablet", "Desktop": "Masaüstü", "Mine": "Benim",
  "Portrait": "Dikey", "Landscape": "Yatay", "Fit the panel": "Panele sığdır", "Fills the space it has": "Bulunduğu yeri doldurur",
  "Your own device": "Kendi cihazın", "Name": "Ad", "Width": "Genişlik", "Height": "Yükseklik", "Pixel ratio": "Piksel oranı", "Kind": "Tür",
  "Touch screen": "Dokunmatik ekran", "Save": "Kaydet", "Cancel": "Vazgeç", "Remove {0}": "{0} cihazını sil", "No device matches": "Eşleşen cihaz yok",
  "Phone": "Telefon", "Tablet": "Tablet", "Screen": "Ekran", "touch": "dokunmatik", "My device": "Cihazım",
});

export type DevicePickerGroup = "all" | DeviceKind | "mine";
export interface DevicePickerProps extends ControlProps<string> {
  /** Portrait / landscape (a signal keeps it); the picker shows its switch when given. @tr Dikey / yatay (bir sinyal tutar); verilince seçici anahtarını gösterir. */
  landscape?: Signal<boolean> | undefined;
  /** Offer "Fit the panel" first (its value is ""): true, or your own text. @tr Başta "Panele sığdır" seçeneği (değeri ""): true ya da kendi metnin. */
  fit?: MaybeFn<boolean | string | undefined>;
  /** The devices (default: the whole catalog and your own devices). @tr Cihazlar (varsayılan: bütün katalog ve kendi cihazların). */
  devices?: MaybeFn<readonly DeviceSpec[] | undefined>;
  /** The group shown first (default "all"). @tr İlk gösterilen grup (varsayılan "all"). */
  group?: Signal<DevicePickerGroup> | DevicePickerGroup | undefined;
  /** The search field (default true). @tr Arama alanı (varsayılan true). */
  search?: MaybeFn<boolean | undefined>;
  /** The "your own device" form (default true): it saves the device in this browser. @tr "Kendi cihazın" formu (varsayılan true): cihazı bu tarayıcıya kaydeder. */
  create?: MaybeFn<boolean | undefined>;
  /** Accessible name of the list (default "Devices"). @tr Listenin erişilebilir adı (varsayılan "Devices"). */
  label?: MaybeFn<string | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** A small drawing of the device: its proportions, corners and camera. */
export function deviceSilhouette(d: DeviceSpec, landscape = false): Element {
  const w = landscape ? d.height : d.width, hh = landscape ? d.width : d.height, k = 30 / Math.max(w, hh);
  return h("span", { class: cx("m-dpick-shape", `is-${d.kind ?? "phone"}`, landscape && "is-landscape"), "aria-hidden": "true",
    style: { "--w": `${Math.max(8, w * k)}px`, "--h": `${Math.max(8, hh * k)}px`, "--r": `${Math.min(6, (d.radius ?? 20) * k * 1.4)}px` } });
}
const sizeText = (d: DeviceSpec, land: boolean): string => `${land ? d.height : d.width} × ${land ? d.width : d.height} · ${dprOf(d)}x`;

/** Choose a device (see the module comment). */
export function DevicePicker(props: DevicePickerProps): Element {
  const [get, set] = model<string>(props, "");
  const land = props.landscape;
  const g0 = props.group;
  const group: Signal<DevicePickerGroup> = typeof g0 === "function" ? g0 : signal<DevicePickerGroup>(g0 ?? "all");
  const q = signal("");
  const making = signal(false);
  const list = (): readonly DeviceSpec[] => val(props.devices) ?? allDevices();
  const match = (d: DeviceSpec): boolean => {
    const s = q().trim().toLocaleLowerCase("tr");
    if (s && !`${d.name} ${d.width}x${d.height} ${d.width} ${d.height}`.toLocaleLowerCase("tr").includes(s)) return false;
    const g = group();
    return g === "all" || (g === "mine" ? !!d.own : (d.kind ?? "phone") === g && !d.own);
  };
  const shown = computed(() => list().filter(match));
  const groups = (): { value: DevicePickerGroup; label: string }[] => [
    { value: "all", label: t`All` }, { value: "phone", label: t`Phones` }, { value: "tablet", label: t`Tablets` }, { value: "desktop", label: t`Desktop` },
    ...(list().some((d) => d.own) ? [{ value: "mine" as const, label: t`Mine` }] : []),
  ];
  const isLand = (): boolean => !!land?.();
  const fitText = (): string | null => { const f = val(props.fit); return f ? (typeof f === "string" ? f : t`Fit the panel`) : null; };
  const pick = (id: string): void => set(id);

  const row = (d: DeviceSpec): Element => h(ListRow, {
    as: "button", size: "sm", class: "m-dpick-item", selected: () => get() === d.id, onClick: () => pick(d.id ?? ""),
    lead: () => deviceSilhouette(d, isLand()), title: d.name, sub: () => `${sizeText(d, isLand())}${isTouch(d) ? ` · ${t`touch`}` : ""}`,
    trail: d.own ? h(IconButton, { icon: xIcon, size: "xs", variant: "ghost", label: t`Remove ${d.name}`, onClick: (e: MouseEvent) => { e.stopPropagation(); if (get() === d.id) set(""); removeDevice(d.id ?? ""); } }) : null,
  }) as Element;

  // your own device
  const name = signal(""), w = signal<number | null>(400), hh = signal<number | null>(860), dpr = signal<number | null>(3), kind = signal<DeviceKind>("phone"), touch = signal<boolean | null>(true);
  const form = (): Element => h("div", { class: "m-dpick-form" },
    h(Field, { label: () => t`Name` }, h(TextInput, { value: name, placeholder: t`My device`, size: "sm" })),
    h("div", { class: "m-dpick-form-row" },
      h(Field, { label: () => t`Width` }, h(NumberInput, { value: w, min: 120, max: 7680, step: 1, decimals: 0, size: "sm", suffix: "px" })),
      h(Field, { label: () => t`Height` }, h(NumberInput, { value: hh, min: 120, max: 7680, step: 1, decimals: 0, size: "sm", suffix: "px" })),
      h(Field, { label: () => t`Pixel ratio` }, h(NumberInput, { value: dpr, min: 1, max: 5, step: 0.25, decimals: 2, size: "sm", suffix: "x" }))),
    h(Field, { label: () => t`Kind` }, h(Segmented, { value: kind, size: "sm", options: () => [{ value: "phone", label: t`Phone` }, { value: "tablet", label: t`Tablet` }, { value: "desktop", label: t`Desktop` }, { value: "screen", label: t`Screen` }],
      onChange: (k: unknown) => touch.set(k === "phone" || k === "tablet") })),
    h(Toggle, { value: touch, label: () => t`Touch screen` }),
    h("div", { class: "m-dpick-form-row is-end" },
      h(Button, { size: "sm", variant: "ghost", onClick: () => making.set(false) }, () => t`Cancel`),
      h(Button, { size: "sm", variant: "primary", disabled: () => !(w() && hh()), onClick: () => {
        const k = kind.peek();
        const id = addDevice({ name: name.peek().trim() || t`My device`, width: w.peek() ?? 400, height: hh.peek() ?? 860, dpr: dpr.peek() ?? 1, kind: k, touch: !!touch.peek(),
          radius: k === "phone" ? 36 : k === "tablet" ? 18 : k === "desktop" ? 10 : 0, camera: k === "phone" ? "punch" : "none" });
        making.set(false); group.set("mine"); pick(id);
      } }, () => t`Save`)));

  return h("div", { class: () => cx("m-dpick", val(props.class)) },
    h("div", { class: "m-dpick-top" },
      () => (val(props.search) === false ? null : untrack(() => h(SearchBox, { value: q, size: "sm", label: () => t`Search devices`, placeholder: () => t`Search devices`, debounce: 0 }))),
      land ? h(Segmented, { size: "sm", indicator: "slide" as const, get value() { return land!() ? "l" : "p"; }, onChange: (v: unknown) => land.set(v === "l"), options: () => [{ value: "p", label: t`Portrait` }, { value: "l", label: t`Landscape` }] }) : null),
    h(Segmented, { class: "m-dpick-groups", size: "sm", indicator: "slide" as const, value: group, options: groups }),
    h("div", { class: "m-dpick-list", role: "list", "aria-label": () => val(props.label) ?? t`Devices` },
      () => (fitText() && group() === "all" && !q() ? untrack(() => h(ListRow, { as: "button", size: "sm", class: "m-dpick-item is-fit", selected: () => get() === "", onClick: () => pick(""),
        lead: h("span", { class: "m-dpick-fit", "aria-hidden": "true" }, icon(maximize)), title: fitText, sub: () => t`Fills the space it has` })) : null),
      () => { const ds = shown(); return ds.length ? untrack(() => ds.map(row)) : untrack(() => h(Empty, { size: "sm", title: () => t`No device matches` })); }),
    () => (val(props.create) === false ? null : making() ? untrack(form)
      : untrack(() => h(Button, { size: "sm", variant: "ghost", class: "m-dpick-add", icon: plus, onClick: () => making.set(true) }, () => t`Your own device`))),
  );
}
