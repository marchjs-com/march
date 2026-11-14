// CopyButton (hadi-march/ui): copies text to the clipboard and says so. Folder: src/components/actions/copy-button/.
import "./copy-button.css";
import "../button/button.css";
import "../icon-button/icon-button.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { toast } from "../../overlays/toast/index.ts";
import { val, cx, glyph, icon, later, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { colorAttr, type ColorToken } from "../../../theme/colors.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { copy as copyIcon } from "../../../icons/glyphs/copy.ts";

export interface CopyButtonProps {
  text: MaybeFn<string | number | null | undefined>;
  label?: MaybeFn<string>;
  /** Text (or accessible name when icon-only) shown after a copy. Default: "Copied" (translated). */
  copiedLabel?: MaybeFn<string | undefined>;
  iconOnly?: boolean;
  /** The copy icon: your own node / icon. A text button has no icon unless one is given (`true`: the default one). */
  icon?: unknown;
  /** The icon after a copy (default: a tick): your own node / icon, or false to keep the copy icon. */
  copiedIcon?: unknown;
  /** Colour of the button after a copy (default: success). */
  copiedColor?: ColorToken | undefined;
  /** How long the "Copied" state stays, ms (default 1500). */
  duration?: number | undefined;
  /** Text of the failure toast; false: no toast (use `onError`). */
  errorText?: MaybeFn<string | undefined> | false;
  class?: ClassProp;
  onCopy?: () => void;
  /** The clipboard refused (no permission, insecure page). */
  onError?: (error: unknown) => void;
}
/** Copy text to the clipboard: `<CopyButton text={() => token} label="Copy" />` */
export function CopyButton(props: CopyButtonProps): Element {
  const copied = signal(false);
  const copy = async (): Promise<void> => {
    try {
      await globalThis.navigator.clipboard.writeText(String(val(props.text) ?? ""));
      copied.set(true);
      later(() => copied.set(false), props.duration ?? 1500);
      props.onCopy?.();
    } catch (e) {
      if (props.errorText !== false) toast(val(props.errorText) ?? t`Could not copy to the clipboard.`, { kind: "danger" });
      props.onError?.(e);
    }
  };
  const own = (x: unknown, def: typeof check): unknown => (x == null || x === true ? glyph(def) : icon(x, "hm-copy-icon"));
  // icon-only always has an icon; a text button only when `icon` is given
  const mark = (): unknown => {
    if (!props.iconOnly && (props.icon == null || props.icon === false)) return null;
    return copied() && props.copiedIcon !== false ? own(props.copiedIcon, check) : own(props.icon === false ? null : props.icon, copyIcon);
  };
  const text = (): string => (copied() ? val(props.copiedLabel) ?? t`Copied` : val(props.label) ?? t`Copy`);
  return h("button", {
    type: "button", class: () => cx(props.iconOnly ? "hm-icon-btn" : "hm-btn hm-btn-ghost hm-btn-sm", "hm-copy", copied() && "is-copied", val(props.class)),
    onClick: copy, "aria-live": "polite", "data-hm-color": () => (copied() ? colorAttr(props.copiedColor) : null),
    "aria-label": () => (props.iconOnly ? text() : null),
  }, () => { const m = mark(); return props.iconOnly ? m : m ? [m, text()] : text(); });
}
