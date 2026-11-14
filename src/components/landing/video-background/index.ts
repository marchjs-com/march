// VideoBackground (hadi-march/landing): a muted, looping video behind content — a hero, a CTA band, a slide. Built on
// Overlay: the poster shows first and stays on save-data, 2G and reduced motion; the video plays only while visible and
// stops when it leaves the page. A tint keeps text readable; a small pause button stops the motion (WCAG 2.2.2).
import "./video-background.css";
import { h } from "../../../dom/h.ts";
import { signal } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { Overlay, quietMedia, type OverlayProps } from "../../../ui/overlay.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { play } from "../../../icons/glyphs/play.ts";
import { pause } from "../../../icons/glyphs/pause.ts";

export interface VideoBackgroundProps {
  /** Video URL (mp4 / webm). */
  src: MaybeFn<string>;
  /** Poster image: shown first, and instead of the video on save-data / reduced motion. */
  poster?: string | undefined;
  /** Text readability layer: dark (default), light, brand, none. */
  tint?: "dark" | "light" | "brand" | "none" | undefined;
  /** Tint strength 0–1 (default .45). */
  tintOpacity?: number | undefined;
  /** object-position of the video ("center", "50% 30%"). */
  position?: string | undefined;
  /** Show the pause button (default true). */
  controls?: boolean | undefined;
  /** Own icons of the pause button (an icon or a node each). */
  icons?: { play?: unknown; pause?: unknown } | undefined;
  /** Accessible names of the pause button (defaults: "Play background video", "Pause background video"). */
  labels?: { play?: string | undefined; pause?: string | undefined } | undefined;
  class?: ClassProp | undefined;
  children?: unknown | undefined;
}

/** `<VideoBackground src="/clip.webm" poster="/clip.jpg"><h1>…</h1></VideoBackground>` */
export function VideoBackground(props: VideoBackgroundProps): Element {
  const paused = signal(false);
  const tint = props.tint ?? "dark";
  const root = h("div", { class: () => cx("hm-vbg", `hm-vbg-tint-${tint}`, val(props.class)) },
    h(Overlay, { src: props.src, type: "video", poster: props.poster, position: props.position } as OverlayProps),
    tint !== "none" && h(Overlay, { effect: "vignette", class: "hm-vbg-tint", opacity: props.tintOpacity ?? 0.45 }),
    h("div", { class: "hm-vbg-content" }, props.children),
  ) as HTMLElement;
  if (props.controls !== false && !quietMedia()) {
    const toggle = (): void => {
      const v = root.querySelector("video");
      if (!v) return;
      if (v.paused) { void v.play().catch(() => undefined); paused.set(false); } else { v.pause(); paused.set(true); }
    };
    root.append(h(IconButton, {
      class: "hm-vbg-toggle", size: "sm", shape: "round", inverse: true, onClick: toggle,
      icon: () => (paused() ? props.icons?.play ?? play : props.icons?.pause ?? pause),
      label: () => (paused() ? props.labels?.play ?? t`Play background video` : props.labels?.pause ?? t`Pause background video`),
    }) as Node);
  }
  return root;
}
