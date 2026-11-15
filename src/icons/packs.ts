// hadi-march/icons/packs — icons by name from any icon set: icon("tabler:chart-bar"), <Icon name="lucide:user" />.
//   import { registerIconPack, icon, Icon } from "hadi-march/icons/packs";
//   import lucide from "hadi-march/icons/lucide/pack";      // or your own: { id, name, license, resolve(name) }
//   registerIconPack(lucide);
//   <Icon name="lucide:user" />   <Icon name="user" />   (no prefix: the March set)
//   <Button icon={icon("tabler:chart-bar")}>…</Button>    (any icon prop)
// A pack's icons load on first use (its resolve may return a promise); icon() is reactive and draws nothing until the
// icon is there. For the smallest bundles import single icons instead: import { user } from "hadi-march/icons/lucide".
// Packs are made with `march icons add <pack>` (cli/icons.js): open-source sets converted to March's format, each with
// its license. Nothing here is part of the start-up code: <Icon> from hadi-march/icons stays as small as it was.
import { signal, type Signal } from "../core/reactive.ts";
import { Icon as BaseIcon, type IconProps } from "./index.ts";
import type { IconDef } from "./svg.ts";

export { packPaint, packIcon, type PackIconDef } from "./pack-paint.ts";

/** An icon set: where icons come from and what they are drawn like. */
export interface IconPack {
  /** Prefix in names ("lucide" → "lucide:user"). */
  id: string;
  name: string;
  /** SPDX license id (MIT, ISC, Apache-2.0, CC0-1.0…). */
  license: string;
  /** viewBox of the set (informational; each icon carries its own). */
  viewBox?: string;
  /** "stroke" (outlined, currentColor stroke) or "fill" (currentColor fill). */
  mode?: "stroke" | "fill";
  count?: number;
  version?: string;
  source?: string;
  home?: string;
  /** Icon by its name in the set ("arrow-left"); a promise when the set loads lazily. */
  resolve(name: string): IconDef | undefined | Promise<IconDef | undefined>;
}

const packs = new Map<string, IconPack>();
/** Bumped on every registration: icon() of a pack registered later asks again. */
const registered = signal(0);
const cache = new Map<string, Signal<IconDef | undefined>>();
const blanks = new Map<string, IconDef>();
/** What icon() returns while a pack loads (or for an unknown name): an icon with no shapes. */
const blank = (ref: string): IconDef => blanks.get(ref) ?? (blanks.set(ref, Object.freeze({ name: ref, d: [] })), blanks.get(ref)!);

/** Split "lucide:user" → ["lucide", "user"]; no prefix → the March set. */
export const parseIconRef = (ref: string): [pack: string, name: string] => {
  const i = ref.indexOf(":");
  return i < 0 ? ["march", ref] : [ref.slice(0, i), ref.slice(i + 1)];
};

/** Add an icon set; icon("id:…") and <Icon name="id:…"> use it. Returns a function that removes it again. */
export function registerIconPack(pack: IconPack): () => void {
  packs.set(pack.id, pack);
  for (const [ref, s] of cache) if (parseIconRef(ref)[0] === pack.id && !s.peek()) cache.delete(ref);
  registered.set(registered.peek() + 1);
  return () => { if (packs.get(pack.id) === pack) { packs.delete(pack.id); registered.set(registered.peek() + 1); } };
}

/** Registered packs (the March set first). */
export const iconPacks = (): IconPack[] => [...packs.values()];

/** The pack with this id, if registered. */
export const iconPack = (id: string): IconPack | undefined => packs.get(id);

/**
 * Icon by name: "user" (March), "lucide:user", "tabler:chart-bar" — usable in any icon prop. Reactive: read in a
 * component or effect, it updates when a lazily loaded pack arrives; until then (and for an unknown name) it is an
 * icon without shapes. loadIcon() tells whether a name exists.
 */
export function icon(ref: string | undefined): IconDef {
  if (!ref) return blank("");
  let s = cache.get(ref);
  if (!s) {
    const [id, name] = parseIconRef(ref);
    const pack = packs.get(id);
    if (!pack) { registered(); return blank(ref); } // not registered (yet): asked again when a pack is
    const done = signal<IconDef | undefined>(undefined);
    cache.set(ref, (s = done));
    const r = pack.resolve(name);
    if (r && typeof (r as Promise<IconDef>).then === "function") (r as Promise<IconDef | undefined>).then((d) => done.set(d), () => done.set(undefined));
    else done.set(r as IconDef | undefined);
  }
  return s() ?? blank(ref);
}

/** Icon by name, waiting for a lazily loaded pack; undefined when the pack or the name does not exist. */
export function loadIcon(ref: string): Promise<IconDef | undefined> {
  const [id, name] = parseIconRef(ref);
  return Promise.resolve(packs.get(id)?.resolve(name));
}

export interface NamedIconProps extends Omit<IconProps, "of"> {
  /** The icon to draw; `name` is used when it is not given. @tr Çizilecek ikon; verilmezse `name` kullanılır. */
  of?: IconDef | undefined;
  /** "user" (March) or "pack:name" ("lucide:user"), from a registered pack. @tr "user" (March) ya da kayıtlı bir paketten "pack:name" ("lucide:user"). */
  name?: string | undefined;
}

/** `<Icon name="lucide:user" size="lg" />` — <Icon> from hadi-march/icons plus `name`; props may be live. */
export function Icon(props: NamedIconProps): SVGSVGElement {
  return BaseIcon({
    get of() { return props.of ?? icon(props.name); },
    get size() { return props.size; },
    get label() { return props.label; },
    get class() { return props.class; },
  } as IconProps);
}

const camel = (n: string): string => n.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : "")).replace(/^[A-Z]/, (c) => c.toLowerCase());

// the March set: names as written in the set ("arrow-left") or as exported ("arrowLeft"); its catalog loads on use
registerIconPack({
  id: "march", name: "March", license: "MIT", viewBox: "0 0 24 24", mode: "stroke",
  resolve: (n) => import("./catalog.ts").then((m) => m.ICONS[camel(n)]),
});
