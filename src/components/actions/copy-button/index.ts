// CopyButton (march/ui): copies text to the clipboard and says so. Folder: src/components/actions/copy-button/.
import "./copy-button.css";
import { signal, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { toast } from "../../overlays/toast/index.ts";
import { val, cx, later, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { withColor, type ColorToken } from "../../../theme/colors.ts";
import { Button } from "../button/index.ts";
import { IconButton } from "../icon-button/index.ts";
import { check } from "../../../icons/glyphs/check.ts";
import { copy as copyIcon } from "../../../icons/glyphs/copy.ts";

export interface CopyButtonProps {
  /** What is copied (read at click time). @tr Kopyalanan değer (tıklama anında okunur). */
  text: MaybeFn<string | number | null | undefined>;
  /** Button text, or the accessible name when icon-only (default "Copy", translated). @tr Düğme metni ya da yalnız ikonken erişilebilir ad (varsayılan "Copy", çevrilir). */
  label?: MaybeFn<string>;
  /** Text (or accessible name when icon-only) shown after a copy. Default: "Copied" (translated). @tr Kopyalamadan sonra gösterilen metin (yalnız ikonken erişilebilir ad). Varsayılan: "Copied" (çevrilir). */
  copiedLabel?: MaybeFn<string | undefined>;
  /** An icon button without visible text (default false). @tr Görünür metni olmayan ikon düğmesi (varsayılan false). */
  iconOnly?: boolean;
  /** The copy icon: your own node / icon. A text button has no icon unless one is given (`true`: the default one). @tr Kopyala ikonu: kendi düğümün / ikonun. Metinli düğmede ikon yalnız verilirse olur (`true`: varsayılan ikon). */
  icon?: unknown;
  /** The icon after a copy (default: a tick): your own node / icon, or false to keep the copy icon. @tr Kopyalamadan sonraki ikon (varsayılan: tik): kendi düğümün / ikonun ya da kopyala ikonunu korumak için false. */
  copiedIcon?: unknown;
  /** Colour of the button after a copy (default: success). @tr Kopyalamadan sonra düğmenin rengi (varsayılan: success). */
  copiedColor?: ColorToken | undefined;
  /** How long the "Copied" state stays, ms (default 1500). @tr "Copied" durumunun ne kadar kaldığı, ms (varsayılan 1500). */
  duration?: number | undefined;
  /** Text of the failure toast; false: no toast (use `onError`). @tr Hata bildiriminin metni; false: bildirim yok (`onError` kullan). */
  errorText?: MaybeFn<string | undefined> | false;
  /** Extra classes on the button. @tr Düğmeye eklenen sınıflar. */
  class?: ClassProp;
  /** Called after a successful copy. @tr Başarılı bir kopyalamadan sonra çağrılır. */
  onCopy?: () => void;
  /** The clipboard refused (no permission, insecure page). @tr Pano reddetti (izin yok, güvensiz sayfa). */
  onError?: (error: unknown) => void;
}
// a live prop for h(Component, …): it becomes a getter
const live = reactive as <T>(fn: () => T) => T;

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
  // icon-only always has an icon; a text button only when `icon` is given
  const mark = (): unknown => {
    if (!props.iconOnly && (props.icon == null || props.icon === false)) return null;
    return copied() && props.copiedIcon !== false ? ownIcon(props.copiedIcon ?? undefined, check, "m-copy-icon") : ownIcon(props.icon === false || props.icon == null ? undefined : props.icon, copyIcon, "m-copy-icon");
  };
  const text = (): string => (copied() ? val(props.copiedLabel) ?? t`Copied` : val(props.label) ?? t`Copy`);
  const shared = {
    class: () => cx("m-copy", copied() && "is-copied", val(props.class)), onClick: copy, "aria-live": "polite", icon: mark,
  };
  // the copied colour while the label says so (m:color on the button is the colour the rest of the time)
  return withColor(props.iconOnly ? h(IconButton, { ...shared, label: text, title: false }) : h(Button, { ...shared, variant: "ghost", size: "sm" }, text), () => (copied() ? props.copiedColor : undefined)) as Element;
}
