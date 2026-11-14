// CtaBand (hadi-march/landing): the "ready to start?" band near the end of a page — a rounded panel with a title, a
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
  title: MaybeFn<unknown>;
  lead?: MaybeFn<unknown> | undefined;
  actions?: readonly (SectionAction | Node)[] | undefined;
  note?: MaybeFn<unknown> | undefined;
  variant?: "gradient" | "mesh" | "glass" | "plain" | "video" | undefined;
  video?: { src: string; poster?: string | undefined } | undefined;
  align?: "center" | "start" | undefined;
  /** The decorative layers behind the copy (gradient, mesh, glass, grid, pointer light): default true; false: a bare panel. */
  backdrop?: boolean | undefined;
  /** Entrance of the panel when it scrolls into view (default "scale"): a Reveal effect, your own `{ from, to }`, or "none". */
  reveal?: RevealOptions["effect"];
  class?: ClassProp | undefined;
}

const BACKDROPS: Record<string, readonly BackdropLayer[]> = {
  gradient: ["gradient", ["noise", 0.5], ["spotlight", undefined, "hm-cta-light"]],
  mesh: ["mesh", "spotlight"],
  glass: [["dots", 0.6], "glass", "spotlight"],
  plain: [["grid", 0.6]],
};

/** `<CtaBand title="Ready to build?" lead="…" actions={[{ label: "Start free", href: "/start" }]} variant="gradient" />` */
export function CtaBand(props: CtaBandProps): Element {
  const variant = props.variant ?? "gradient";
  const copy = h(SectionHead, {
    class: "hm-cta-copy", size: "lg", align: props.align ?? "center", title: () => val(props.title),
    lead: props.lead != null ? () => val(props.lead) : undefined, actions: props.actions, note: props.note != null ? () => val(props.note) : undefined,
  });
  // the decorative layers of the variant: a recipe for the shared backdrop builder (landing/backdrop.ts)
  const layers = backdrop(props.backdrop === false ? false : BACKDROPS[variant]);
  const panel = variant === "video" && props.video
    ? h(VideoBackground, { src: props.video.src, poster: props.video.poster, tint: "brand", class: "hm-cta-panel" }, copy)
    : h("div", { class: "hm-cta-panel" }, ...layers, copy);
  return h(SiteSection, { space: "sm", class: cx("hm-cta", `hm-cta-${variant}`, val(props.class)) }, props.reveal === "none" ? panel : h(Reveal, { effect: props.reveal ?? "scale", self: true, duration: 900 }, panel)) as Element;
}
