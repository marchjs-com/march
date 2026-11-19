// Secret (march/ui): a value with hidden parts: an API key, a card number, a phone number. `regions` says which
// characters are hidden ([start, end) by index; negative counts from the end). An eye button shows the whole value;
// `copy` adds a button that copies the real value. Folder: src/components/typography/secret/.
//
//   <Secret value={$key} />                                   // sk_l••••••••••••a9c2  (first and last 4 shown)
//   <Secret value={card} regions={[[4, 12]]} mask="*" />       // 4111********1111
//   <Secret value={$key} regions={[[8]]} maskLength={6} copy bind:revealed={$open} />
//
// While a part is hidden its characters are not in the page at all (not in the DOM, not in the accessibility tree):
// screen readers hear the shown parts and "hidden, 12 characters".
import "./secret.css";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { model } from "../../../forms/util.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { CopyButton } from "../../actions/copy-button/index.ts";
import { eye } from "../../../icons/glyphs/eye.ts";
import { eyeOff } from "../../../icons/glyphs/eyeOff.ts";
import { cx, val, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { clamp } from "../../../core/util.ts";

/** A hidden range: `[start, end]` by character index, end not included; negative counts from the end; no end = to the end. */
export type SecretRegion = readonly [start: number, end?: number];

/** Own texts of Secret (default: English, translated). */
export interface SecretLabels {
  /** Eye button while hidden (default "Show"). @tr Gizliyken göz düğmesi (varsayılan "Show"). */
  show?: string;
  /** Eye button while shown (default "Hide"). @tr Görünürken göz düğmesi (varsayılan "Hide"). */
  hide?: string;
  /** Copy button (default "Copy"). @tr Kopyala düğmesi (varsayılan "Copy"). */
  copy?: string;
  /** Copy button after copying (default "Copied"). @tr Kopyaladıktan sonra kopyala düğmesi (varsayılan "Copied"). */
  copied?: string;
  /** What a screen reader hears for a hidden part (default "hidden, {0} characters"). @tr Ekran okuyucunun gizli bir parça için duyduğu (varsayılan "hidden, {0} characters"). */
  hidden?: (count: number) => string;
}

export interface SecretProps {
  /** The value (it may be live). @tr Değer (canlı olabilir). */
  value: MaybeFn<string | null | undefined>;
  /** Hidden ranges by index: `[[4, -4]]` (default: all but the first and last 4; a value of 8 or fewer characters is hidden whole), `[[0, -4]]` (all but the last 4), `[[4, 12], [16]]`. @tr Dizinle gizli aralıklar: `[[4, -4]]` (varsayılan: ilk ve son 4 dışında hepsi; 8 ya da daha az karakterli değer tümüyle gizlenir), `[[0, -4]]` (son 4 dışında hepsi), `[[4, 12], [16]]`. */
  regions?: MaybeFn<readonly SecretRegion[] | undefined>;
  /** The character drawn for a hidden one (default "•"). @tr Gizli bir karakter yerine çizilen karakter (varsayılan "•"). */
  mask?: MaybeFn<string | undefined>;
  /** Mask characters per hidden range: a number (hides the length too) or the range's own length (default). @tr Gizli aralık başına maske karakteri: bir sayı (uzunluğu da gizler) ya da aralığın kendi uzunluğu (varsayılan). */
  maskLength?: MaybeFn<number | undefined>;
  /** Shown whole (live); with `bind:revealed` the eye button writes it back. @tr Tümüyle görünür (canlı); `bind:revealed` ile göz düğmesi değeri geri yazar. */
  revealed?: MaybeFn<boolean | undefined>;
  /** Writes `revealed` back (set by `bind:revealed`). @tr `revealed` değerini geri yazar (`bind:revealed` bunu verir). */
  setRevealed?: ((v: boolean) => void) | undefined;
  /** Called when the eye button shows or hides it. @tr Göz düğmesi değeri gösterince ya da gizleyince çağrılır. */
  onRevealChange?: ((revealed: boolean) => void) | undefined;
  /** The eye button (default true); false: the value stays as `revealed` says. @tr Göz düğmesi (varsayılan true); false: değer `revealed` neyse öyle kalır. */
  toggle?: boolean | undefined;
  /** A button that copies the real value, hidden or not (default false). @tr Gizli olsun olmasın gerçek değeri kopyalayan düğme (varsayılan false). */
  copy?: boolean | undefined;
  /** Called after the value is copied. @tr Değer kopyalandıktan sonra çağrılır. */
  onCopy?: (() => void) | undefined;
  /** Monospace text (default true). @tr Eş aralıklı yazı (varsayılan true). */
  mono?: boolean | undefined;
  /** Size of the text and its buttons: sm · md (default). @tr Metnin ve düğmelerinin boyutu: sm · md (varsayılan). */
  size?: "sm" | "md" | undefined;
  /** Own texts. @tr Kendi metinlerin. */
  labels?: SecretLabels | undefined;
  /** Extra classes on the root (`m-secret`). @tr Köke (`m-secret`) eklenen sınıflar. */
  class?: ClassProp;
}

const DEFAULT: readonly SecretRegion[] = [[4, -4]];

/** The value split into shown and hidden parts (`regions` resolved, overlaps merged). */
export function secretParts(value: string, regions: readonly SecretRegion[] = DEFAULT): { text: string; hidden: boolean }[] {
  const n = value.length;
  const at = (i: number): number => clamp(i < 0 ? n + i : i, 0, n);
  let spans = regions.map(([s, e]) => [at(s), e == null ? n : at(e)] as [number, number]).filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  // the default leaves nothing hidden in a short value: then all of it is hidden
  if (!spans.length && regions === DEFAULT && n) spans = [[0, n]];
  // overlapping or touching ranges become one
  const merged: [number, number][] = [];
  for (const [s, e] of spans) { const last = merged[merged.length - 1]; if (last && s <= last[1]) last[1] = Math.max(last[1], e); else merged.push([s, e]); }
  const out: { text: string; hidden: boolean }[] = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: value.slice(pos, s), hidden: false });
    out.push({ text: value.slice(s, e), hidden: true });
    pos = e;
  }
  if (pos < n) out.push({ text: value.slice(pos), hidden: false });
  return out;
}

/** A value with hidden parts and an eye button to show it: API keys, card numbers. The hidden characters are never in the DOM. */
export function Secret(props: SecretProps): Element {
  const [revealed, setRevealed] = model<boolean>(props, false, "revealed");
  const L = (): SecretLabels => props.labels ?? {};
  const value = (): string => String(val(props.value) ?? "");
  const text = (): unknown => {
    const v = value();
    if (revealed()) return h("span", { class: "m-secret-shown" }, v);
    const mask = val(props.mask) || "•", len = val(props.maskLength);
    return secretParts(v, val(props.regions) ?? DEFAULT).map((p) => (p.hidden
      ? h("span", { class: "m-secret-mask" },
        h("span", { "aria-hidden": "true" }, mask.repeat(len ?? p.text.length)),
        h("span", { class: "m-sr-only" }, L().hidden?.(p.text.length) ?? t`hidden, ${p.text.length} characters`))
      : h("span", { class: "m-secret-shown" }, p.text)));
  };
  const sm = props.size === "sm";
  const flip = (): void => { const on = !revealed(); setRevealed(on); props.onRevealChange?.(on); };
  return h("span", { class: () => cx("m-secret", props.mono !== false && "m-secret-mono", sm && "m-secret-sm", revealed() && "is-revealed", val(props.class)) },
    h("span", { class: "m-secret-text" }, text),
    props.toggle === false ? null : h(IconButton, {
      class: "m-secret-eye", size: sm ? "xs" : "sm", pressed: revealed, icon: () => (revealed() ? eyeOff : eye),
      label: () => (revealed() ? L().hide ?? t`Hide` : L().show ?? t`Show`), onClick: flip,
    }),
    props.copy ? h(CopyButton, {
      class: "m-secret-copy", text: value, iconOnly: true, label: () => L().copy ?? t`Copy`, copiedLabel: () => L().copied ?? t`Copied`, onCopy: props.onCopy,
    }) : null);
}
