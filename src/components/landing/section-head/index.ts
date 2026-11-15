// SectionHead (hadi-march/landing): the heading group of a page section — eyebrow, title, lead, actions and a small
// note, stacked and aligned as one block. Hero, SiteSection, CtaBand, Faq, Newsletter and ProjectDetail all open with
// this group; here it is one component: alignment, title level and scale, colour, an optional entrance (Reveal).
import "./section-head.css";
import { h } from "../../../dom/h.ts";
import { untrack } from "../../../core/reactive.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { Button, type ButtonVariant } from "../../actions/button/index.ts";
import { Reveal, type RevealOptions } from "../reveal/index.ts";

/** A call to action written as data: the first is primary, the rest secondary unless `variant` says otherwise. */
export interface SectionAction { label: unknown; href?: string | undefined; onClick?: ((e: MouseEvent) => void) | undefined; variant?: ButtonVariant | undefined; icon?: unknown | undefined; iconEnd?: unknown | undefined }

export interface SectionHeadProps {
  /** Small line above the title: text (uppercase, accent colour) or your own node (a Badge, a pill). @tr Başlığın üstündeki küçük satır: metin (büyük harf, vurgu rengi) ya da kendi düğümünüz (bir Badge, bir hap). */
  eyebrow?: MaybeFn<unknown> | undefined;
  /** Makes the eyebrow a link. @tr Üst satırı bir bağlantı yapar. */
  eyebrowHref?: string | undefined;
  /** The heading. @tr Başlık. */
  title?: MaybeFn<unknown> | undefined;
  /** Heading element of the title (default "h2"). @tr Başlığın HTML öğesi (varsayılan "h2"). */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | undefined;
  /** Id of the title (aria-labelledby of the section). @tr Başlığın kimliği (bölümün aria-labelledby değeri). */
  titleId?: string | undefined;
  /** Paragraph under the title. @tr Başlığın altındaki paragraf. */
  lead?: MaybeFn<unknown> | undefined;
  /** Buttons under the lead: action objects (`{ label, href }`), your own nodes, or both. @tr Alt başlığın altındaki düğmeler: eylem nesneleri (`{ label, href }`), kendi düğümleriniz ya da ikisi birden. */
  actions?: readonly (SectionAction | Node)[] | Node | undefined;
  /** Small text under the actions ("No card needed"). @tr Eylemlerin altındaki küçük metin ("Kart gerekmez"). */
  note?: MaybeFn<unknown> | undefined;
  /** start · center (default) · end. @tr start · center (varsayılan) · end. */
  align?: MaybeFn<"start" | "center" | "end" | undefined>;
  /** Scale of the title: sm (a card, a form) · md (a section, default) · lg (a call to action) · xl (a hero). @tr Başlığın ölçeği: sm (bir kart, bir form) · md (bir bölüm, varsayılan) · lg (bir eylem çağrısı) · xl (bir hero). */
  size?: MaybeFn<"sm" | "md" | "lg" | "xl" | undefined>;
  /** Width of the block: "text" (a readable measure, default) or "full". @tr Bloğun genişliği: "text" (okunaklı bir satır uzunluğu, varsayılan) ya da "full". */
  width?: MaybeFn<"text" | "full" | undefined>;
  /** Entrance when the block scrolls into view: true (parts rise one after another), Reveal options, or false (default). @tr Blok görünüme kaydığında giriş: true (parçalar art arda yükselir), Reveal seçenekleri ya da false (varsayılan). */
  reveal?: boolean | RevealOptions | undefined;
  /** Extra CSS class on the root. @tr Köke eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
  /** More content under the note. @tr Notun altındaki ek içerik. */
  children?: unknown | undefined;
}

/** Buttons for a list of actions; nodes pass through. `size` follows the head (lg for lg / xl heads). */
export function sectionActions(actions: readonly (SectionAction | Node)[] | Node | undefined, size: "sm" | "md" | "lg" = "md"): unknown[] {
  const list = actions == null ? [] : Array.isArray(actions) ? actions as readonly (SectionAction | Node)[] : [actions as Node];
  return list.map((a, i) => {
    if ((a as Node).nodeType) return a;
    const x = a as SectionAction;
    return h(Button, { variant: x.variant ?? (i === 0 ? "primary" : "secondary"), size, href: x.href as never, onClick: x.onClick, icon: x.icon, iconEnd: x.iconEnd }, x.label);
  });
}

/** `<SectionHead eyebrow="Features" title="Everything you need" lead="…" actions={[{ label: "Start", href: "/start" }]} note="No card needed" />` */
export function SectionHead(props: SectionHeadProps): Element {
  const size = (): string => val(props.size) ?? "md";
  const cls = (): string => cx("m-section-head", `m-section-head-${size()}`, `m-section-head-${val(props.align) ?? "center"}`, val(props.width) === "full" && "m-section-head-full", val(props.class));
  const eyebrow = (): unknown => {
    const e = val(props.eyebrow);
    return typeof e === "string" || typeof e === "number" ? h("span", { class: "m-section-head-caps" }, e) : e;
  };
  const s0 = untrack(size); // buttons are built once, for the size the head starts with
  const acts = sectionActions(props.actions, s0 === "lg" || s0 === "xl" ? "lg" : s0 === "sm" ? "sm" : "md");
  const parts = [
    props.eyebrow != null ? h(props.eyebrowHref ? "a" : "p", { class: "m-section-head-eyebrow", href: props.eyebrowHref ?? null }, eyebrow) : null,
    props.title != null ? h(props.as ?? "h2", { class: "m-section-head-title", id: props.titleId }, () => val(props.title)) : null,
    props.lead != null ? h("p", { class: "m-section-head-lead" }, () => val(props.lead)) : null,
    acts.length ? h("div", { class: "m-section-head-actions" }, acts) : null,
    props.note != null ? h("p", { class: "m-section-head-note" }, () => val(props.note)) : null,
    props.children ?? null];
  const attrs = { class: cls };
  if (!props.reveal) return h("div", attrs, parts);
  return h(Reveal, { ...attrs, effect: "up", stagger: 90, ...(props.reveal === true ? {} : props.reveal) }, parts) as Element;
}
