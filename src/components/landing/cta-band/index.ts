// CtaBand (march/landing): the "ready to start?" band near the end of a page — a rounded panel with a title, a
// lead and actions over a themed background: gradient (brand colours), mesh, glass, plain or a video. A light follows
// the pointer; the panel rises in when it scrolls into view.
import "./cta-band.css";
import { h } from "../../../dom/h.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Reveal, type RevealOptions } from "../reveal/index.ts";
import { SiteSection } from "../site-section/index.ts";
import { VideoBackground } from "../video-background/index.ts";
import { SectionHead, type SectionAction } from "../section-head/index.ts";
import { backdrop, type BackdropLayer } from "../backdrop.ts";

export interface CtaBandProps {
  /** Heading of the band. @tr Bandın başlığı. */
  title: MaybeFn<unknown>;
  /** Short text under the title. @tr Başlığın altındaki kısa metin. */
  lead?: MaybeFn<unknown> | undefined;
  /** Buttons (action objects or nodes); the first is primary. @tr Düğmeler (eylem nesneleri ya da düğümler); ilki birincildir. */
  actions?: readonly (SectionAction | Node)[] | undefined;
  /** Small line under the actions (e.g. "No card needed"). @tr Eylemlerin altındaki küçük satır (örneğin "Kart gerekmez"). */
  note?: MaybeFn<unknown> | undefined;
  /** Background: gradient (default), mesh, glass, plain or video. @tr Arka plan: gradient (varsayılan), mesh, glass, plain ya da video. */
  variant?: "gradient" | "mesh" | "glass" | "plain" | "video" | undefined;
  /** Video of the `video` variant: `{ src, poster? }`. @tr `video` görünümünün videosu: `{ src, poster? }`. */
  video?: { src: string; poster?: string | undefined } | undefined;
  /** Alignment of the copy: center (default) or start. @tr Metnin hizası: center (varsayılan) ya da start. */
  align?: "center" | "start" | undefined;
  /** The decorative layers behind the copy (gradient, mesh, glass, grid, pointer light): default true; false: a bare panel. @tr Metnin arkasındaki süs katmanları (gradient, mesh, glass, ızgara, işaretçi ışığı): varsayılan true; false: yalın bir panel. */
  backdrop?: boolean | undefined;
  /** Entrance of the panel when it scrolls into view (default "scale"): a Reveal effect, your own `{ from, to }`, or "none". @tr Panel görünüme kaydığında girişi (varsayılan "scale"): bir Reveal efekti, kendi `{ from, to }` değeriniz ya da "none". */
  reveal?: RevealOptions["effect"];
  /** Extra CSS class on the section (`.m-cta`). @tr Bölüme (`.m-cta`) eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
}

const BACKDROPS: Record<string, readonly BackdropLayer[]> = {
  gradient: ["gradient", ["noise", 0.5], ["spotlight", undefined, "m-cta-light"]],
  mesh: ["mesh", "spotlight"],
  glass: [["dots", 0.6], "glass", "spotlight"],
  plain: [["grid", 0.6]],
};

/** `<CtaBand title="Ready to build?" lead="…" actions={[{ label: "Start free", href: "/start" }]} variant="gradient" />` */
export function CtaBand(props: CtaBandProps): Element {
  const variant = props.variant ?? "gradient";
  const copy = h(SectionHead, {
    class: "m-cta-copy", size: "lg", align: props.align ?? "center", title: () => val(props.title),
    lead: props.lead != null ? () => val(props.lead) : undefined, actions: props.actions, note: props.note != null ? () => val(props.note) : undefined,
  });
  // the decorative layers of the variant: a recipe for the shared backdrop builder (landing/backdrop.ts)
  const layers = backdrop(props.backdrop === false ? false : BACKDROPS[variant]);
  const panel = variant === "video" && props.video
    ? h(VideoBackground, { src: props.video.src, poster: props.video.poster, tint: "brand", class: "m-cta-panel" }, copy)
    : h("div", { class: "m-cta-panel" }, ...layers, copy);
  return h(SiteSection, { space: "sm", class: cx("m-cta", `m-cta-${variant}`, val(props.class)) }, props.reveal === "none" ? panel : h(Reveal, { effect: props.reveal ?? "scale", self: true, duration: 900 }, panel)) as Element;
}
