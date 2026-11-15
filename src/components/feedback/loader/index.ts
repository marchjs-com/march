// Loader and the boot loader. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./loader.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Spinner } from "../spinner/index.ts";

export interface LoaderProps {
  /** Visible text under the spinner; without it "Loading" is read to screen readers only. @tr Dönen göstergenin altındaki görünür metin; yoksa "Loading" yalnız ekran okuyuculara okunur. */
  text?: MaybeFn<string> | undefined;
  /** Covers the nearest positioned container (default false). @tr Konumlandırılmış en yakın kapsayıcıyı örter (varsayılan false). */
  overlay?: boolean;
  /** Extra classes on the loader. @tr Yükleyiciye eklenen sınıflar. */
  class?: ClassProp;
  /** Screen-reader text while there is no visible `text` (default "Loading", translated). @tr Görünür `text` yokken ekran okuyucu metni (varsayılan "Loading", çevrilir). */
  label?: MaybeFn<string | undefined>;
  /** The spinner: true (default), false, or your own node. @tr Dönen gösterge: true (varsayılan), false ya da kendi düğümün. */
  spinner?: boolean | Node | undefined;
  /** One theme color for the spinner ("brand-orange", "success"…). Default: the theme's spinner. @tr Dönen gösterge için tek bir tema rengi ("brand-orange", "success"…). Varsayılan: temanın göstergesi. */
  color?: ColorToken | undefined;
  /** The delayed fade-in (default true); false shows the loader at once. @tr Gecikmeli belirme (varsayılan true); false yükleyiciyi hemen gösterir. */
  fade?: boolean | undefined;
}
/** Full-area spinner: `<Loader text="Loading users…" />` */
export function Loader(props: LoaderProps = {}): Element {
  const own = props.spinner;
  const spinner = own === false ? null
    : own && own !== true ? h("span", { class: "m-loader-spinner", "aria-hidden": "true" }, own)
    : h(Spinner, { size: "lg", decorative: true, color: props.color });
  return h("div", { class: () => cx("m-loader", props.overlay && "m-loader-overlay", props.fade === false && "is-still", val(props.class)), role: "status", "aria-live": "polite" },
    spinner,
    h("span", { class: props.text != null ? "m-loader-text" : "m-sr-only" }, () => val(props.text) ?? val(props.label) ?? t`Loading`));
}

/** Boot loader: the app's index.html shows a static `#m-boot` element; call `bootLoader.done()` once the app rendered. */
export const bootLoader = {
  done({ id = "m-boot", fade = 250 }: { id?: string; fade?: number } = {}): boolean {
    const el = globalThis.document?.getElementById(id);
    if (!el) return false;
    el.classList.add("m-boot-done");
    el.setAttribute("aria-hidden", "true");
    setTimeout(() => el.remove(), fade);
    return true;
  },
};
