// Loader and the boot loader. (hadi-march/ui; split from display.ts so each component is its own module and chunk).
import "./loader.css";
import "../spinner/spinner.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";

export interface LoaderProps { text?: MaybeFn<string> | undefined; overlay?: boolean; class?: ClassProp }
/** Full-area spinner: `<Loader text="Loading users…" />` */
export function Loader(props: LoaderProps = {}): Element {
  return h("div", { class: () => cx("hm-loader", props.overlay && "hm-loader-overlay", val(props.class)), role: "status", "aria-live": "polite" },
    h("span", { class: "hm-loading hm-spin-lg", "aria-hidden": "true" }),
    h("span", { class: props.text != null ? "hm-loader-text" : "hm-sr-only" }, () => val(props.text) ?? t`Loading`));
}

/** Boot loader: the app's index.html shows a static `#hm-boot` element; call `bootLoader.done()` once the app rendered. */
export const bootLoader = {
  done({ id = "hm-boot", fade = 250 }: { id?: string; fade?: number } = {}): boolean {
    const el = globalThis.document?.getElementById(id);
    if (!el) return false;
    el.classList.add("hm-boot-done");
    el.setAttribute("aria-hidden", "true");
    setTimeout(() => el.remove(), fade);
    return true;
  },
};
