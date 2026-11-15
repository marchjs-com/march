// StoryProgress (hadi-march/ui): the segmented bars on top of a story: a line Progress in segments. Earlier segments are
// full, later ones empty and the current one fills over `duration` on the motion engine (an essential animation: it
// keeps time with reduced motion too, and "pause all" / the global speed apply). Pausing holds the fill; onDone fires
// when it is full.
import { live } from "../../../forms/util.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { val, cx, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import { Progress } from "../../feedback/progress/index.ts";
import "./story-progress.css";

export interface StoryProgressProps {
  /** Number of segments (stories). @tr Parça (hikâye) sayısı. */
  count: MaybeFn<number>;
  /** Current segment (0-based). @tr Şu anki parça (0'dan başlar). */
  index: MaybeFn<number>;
  /** Fill time of the current segment (ms). Default 6000. @tr Şu anki parçanın dolma süresi (ms). Varsayılan 6000. */
  duration?: MaybeFn<number | undefined>;
  /** Stops the fill (held finger, open menu). @tr Dolmayı durdurur (basılı parmak, açık menü). */
  paused?: MaybeFn<boolean | undefined>;
  /** Restarts the current fill when it changes (the story id): the same index in another group starts over. @tr Değişince şu anki dolmayı yeniden başlatır (hikâye id'si): başka bir gruptaki aynı sıra baştan başlar. */
  run?: MaybeFn<unknown>;
  /** Called when the current segment is full. @tr Şu anki parça dolunca çağrılır. */
  onDone?: (() => void) | undefined;
  /** Your own screen-reader text: `(index, count) => "…"` (index 0-based). Default "Story 2 of 5". @tr Kendi ekran okuyucu metniniz: `(index, count) => "…"` (index 0'dan başlar). Varsayılan "Hikâye 2 / 5". */
  label?: ((index: number, count: number) => string) | undefined;
  /** Fill color. Default: white on the photo. @tr Dolgu rengi. Varsayılan: fotoğraf üstünde beyaz. */
  color?: MaybeFn<ColorToken | undefined>;
  /** Extra class on the root. @tr Köke eklenen sınıf. */
  class?: ClassProp;
}

/** `<StoryProgress count={items.length} index={$i} run={item.id} paused={$hold} onDone={next} />` */
export function StoryProgress(props: StoryProgressProps): Element {
  // a segmented line Progress over media: the part at `index` fills over `duration`
  return h(Progress, {
    variant: "line", inverse: true, class: () => cx("m-story-progress", val(props.class)),
    segments: () => val(props.count), value: () => val(props.index), duration: () => val(props.duration) ?? 6000,
    paused: () => val(props.paused), run: () => val(props.run), onDone: () => props.onDone?.(),
    valueText: (index: number, count: number) => (props.label ? props.label(index, count) : t`Story ${index + 1} of ${count}`),
    ariaLabel: () => t`Stories`, color: live(() => val(props.color)),
  }) as Element;
}
