// EditorFrame (march/ui): the frame of an editor — a border with a focus ring around a head bar (toolbar, search,
// tabs, status), the editing area and a foot bar (counts, hints). MarkdownEditor, RichTextEditor and TreeEditor are
// drawn in it; your own editor gets the same look. The two bars are PanelHeaders: each can be left out, shown by a
// condition, or given its own attributes.
import "./editor-frame.css";
import { h } from "../../../dom/h.ts";
import { cx, val, rest, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import { type ColorToken } from "../../../theme/colors.ts";
import { PanelHeader, type PanelHeaderProps } from "../../layout/panel-header/index.ts";

export interface EditorFrameProps {
  /** Content of the head bar: a toolbar, a search box (a node or an accessor). @tr Üst çubuğun içeriği: araç çubuğu, arama kutusu (düğüm ya da erişimci). */
  head?: unknown;
  /** End side of the head bar: view tabs, status, undo / redo. @tr Üst çubuğun bitiş tarafı: görünüm sekmeleri, durum, geri al / yinele. */
  actions?: MaybeFn<unknown>;
  /** The head bar: shown when `head` or `actions` is given (default); `false` (or an accessor) hides it. @tr Üst çubuk: `head` ya da `actions` verilince görünür (varsayılan); `false` (ya da erişimci) gizler. */
  showHead?: MaybeFn<boolean | undefined>;
  /** Other props of the head bar (PanelHeader): `sticky`, `class`, `tone`, `divider`, `size`, `aria-*`. @tr Üst çubuğun (PanelHeader) diğer özellikleri: `sticky`, `class`, `tone`, `divider`, `size`, `aria-*`. */
  headProps?: Partial<PanelHeaderProps> | undefined;
  /** Content of the foot bar: counts, hints (a node or an accessor). @tr Alt çubuğun içeriği: sayımlar, ipuçları (düğüm ya da erişimci). */
  foot?: unknown;
  /** The foot bar: shown when `foot` is given (default); `false` (or an accessor) hides it. @tr Alt çubuk: `foot` verilince görünür (varsayılan); `false` (ya da erişimci) gizler. */
  showFoot?: MaybeFn<boolean | undefined>;
  /** Other props of the foot bar (PanelHeader): `divider`, `class`, `actions`, `aria-live`. @tr Alt çubuğun (PanelHeader) diğer özellikleri: `divider`, `class`, `actions`, `aria-live`. */
  footProps?: Partial<PanelHeaderProps> | undefined;
  /** Dims the frame. @tr Çerçeveyi soluklaştırır. */
  disabled?: MaybeFn<boolean | undefined>;
  /** Marks the frame `is-readonly` (the editor styles what that means). @tr Çerçeveyi `is-readonly` olarak işaretler (bunun anlamını düzenleyici biçimlendirir). */
  readonly?: MaybeFn<boolean | undefined>;
  /** The focus ring around the frame while something inside has focus (default true). @tr İçeride bir şey odaktayken çerçevenin çevresindeki odak halkası (varsayılan true). */
  ring?: MaybeFn<boolean | undefined>;
  /** Extra classes on the frame. @tr Çerçeveye eklenen sınıflar. */
  class?: ClassProp;
  /** The editing area (and anything after it: panels, pop-ups). @tr Düzenleme alanı (ve ondan sonraki her şey: paneller, açılır öğeler). */
  children?: unknown;
  /** Other attributes go to the frame: `style`, `data-*`, `id`, `ref`, listeners. */
  [attr: string]: unknown;
}

const USED = ["head", "actions", "showHead", "headProps", "foot", "showFoot", "footProps", "disabled", "readonly", "ring", "color"];

/** `<EditorFrame head={<FormatToolbar onTool={exec} />} foot={<span>120 words</span>}><textarea /></EditorFrame>` */
export function EditorFrame(props: EditorFrameProps): Element {
  const bar = (as: "div" | "footer", cls: string, more: Partial<PanelHeaderProps> | undefined, own: Partial<PanelHeaderProps>): Element =>
    h(PanelHeader, { as, size: "sm", ...own, ...more, class: () => cx(cls, val(more?.class)) }) as Element;
  const head = (): unknown => (val(props.showHead) === false || (props.head == null && props.actions == null && props.showHead == null) ? null
    : bar("div", "m-editor-head", props.headProps, { tone: "muted", divider: true, children: props.head, actions: props.actions }));
  const foot = (): unknown => (val(props.showFoot) === false || (props.foot == null && props.showFoot == null) ? null
    : bar("footer", "m-editor-foot", props.footProps, { children: props.foot }));
  return h("div", {
    ...rest(props, USED),
    class: () => cx("m-editor-frame", val(props.disabled) && "is-disabled", val(props.readonly) && "is-readonly", val(props.ring) === false && "is-plain", val(props.class)),
  }, head, props.children, foot);
}
