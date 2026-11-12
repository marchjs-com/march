// CopyButton (hadi-march/ui): copies text to the clipboard and says so. Folder: src/components/actions/copy-button/.
import "./copy-button.css";
import "../button/button.css";
import "../icon-button/icon-button.css";
import { signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { toast } from "../../../ui/toast.ts";
import { val, cx, glyph, later, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { copy as copyIcon } from "../../../icons/glyphs/copy.ts";

export interface CopyButtonProps {
  text: MaybeFn<string | number | null | undefined>;
  label?: MaybeFn<string>;
  iconOnly?: boolean;
  class?: ClassProp;
  onCopy?: () => void;
}
/** Copy text to the clipboard: `<CopyButton text={() => token} label="Copy" />` */
export function CopyButton(props: CopyButtonProps): Element {
  const copied = signal(false);
  const copy = async (): Promise<void> => {
    try {
      await globalThis.navigator.clipboard.writeText(String(val(props.text) ?? ""));
      copied.set(true);
      later(() => copied.set(false), 1500);
      props.onCopy?.();
    } catch { toast(t`Could not copy to the clipboard.`, { kind: "danger" }); }
  };
  return h("button", {
    type: "button", class: () => cx(props.iconOnly ? "hm-icon-btn" : "hm-btn hm-btn-ghost hm-btn-sm", "hm-copy", copied() && "is-copied", val(props.class)),
    onClick: copy, "aria-live": "polite",
    "aria-label": () => (props.iconOnly ? (copied() ? t`Copied` : val(props.label) ?? t`Copy`) : null),
  }, () => (props.iconOnly ? glyph(copied() ? check : copyIcon) : copied() ? t`Copied` : val(props.label) ?? t`Copy`));
}
