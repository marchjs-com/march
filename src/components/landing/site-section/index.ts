// SiteSection (hadi-march/landing): the frame of every website block — width, vertical rhythm, a tone (plain, muted,
// inverse, brand) and an optional heading group (eyebrow, title, lead) that enters with Reveal. Blocks put their
// content inside; pages stack sections.
import "./site-section.css";
import { h } from "../../../dom/h.ts";
import { cx, val, uid, type ClassProp, type MaybeFn } from "../../../ui/util.ts";
import type { RevealOptions } from "../reveal/index.ts";
import { SectionHead } from "../section-head/index.ts";
import { type ColorToken } from "../../../theme/colors.ts";

export type SectionTone = "plain" | "muted" | "inverse" | "brand";
export interface SiteSectionProps {
  /** Small line above the title. @tr Başlığın üstündeki küçük satır. */
  eyebrow?: MaybeFn<unknown> | undefined;
  /** Heading of the section. @tr Bölümün başlığı. */
  title?: MaybeFn<unknown> | undefined;
  /** Text under the title. @tr Başlığın altındaki metin. */
  lead?: MaybeFn<unknown> | undefined;
  /** Heading alignment (default center). @tr Başlığın hizası (varsayılan center). */
  align?: "center" | "start" | undefined;
  /** Background: plain (default), muted, inverse or brand. @tr Arka plan: plain (varsayılan), muted, inverse ya da brand. */
  tone?: SectionTone | undefined;
  /** Content width: narrow 46rem · default 72rem · wide 84rem · full (edge to edge). @tr İçerik genişliği: narrow 46rem · default 72rem · wide 84rem · full (kenardan kenara). */
  width?: "narrow" | "default" | "wide" | "full" | undefined;
  /** Vertical padding (default md). @tr Dikey iç boşluk (varsayılan md). */
  space?: "none" | "sm" | "md" | "lg" | undefined;
  /** Heading level for the title (default 2). @tr Başlığın düzeyi (varsayılan 2). */
  level?: 1 | 2 | 3 | undefined;
  /** Entrance of the heading group: Reveal options, or false for none (default: up, one after another). @tr Başlık grubunun girişi: Reveal seçenekleri ya da hiç giriş olmaması için false (varsayılan: up, art arda). */
  reveal?: RevealOptions | false | undefined;
  /** Id of the section (for anchor links). @tr Bölümün kimliği (çapa bağlantıları için). */
  id?: string | undefined;
  /** Extra CSS class on the section. @tr Bölüme eklenen ek CSS sınıfı. */
  class?: ClassProp | undefined;
  /** Content of the section. @tr Bölümün içeriği. */
  children?: unknown | undefined;
  [attr: string]: unknown;
}

/** `<SiteSection eyebrow="Features" title="Everything you need" lead="…">…</SiteSection>` */
export function SiteSection(props: SiteSectionProps): Element {
  const { eyebrow, title, lead, align, tone, width, space, level, reveal, class: c, children, ...attrs } = props;
  const hid = title != null ? uid("m-ss") : null;
  // the heading group is the shared SectionHead (it enters with Reveal; `reveal={false}` keeps it still)
  const head = title != null || eyebrow != null || lead != null
    ? h(SectionHead, { class: "m-ss-head", eyebrow, title, as: `h${level ?? 2}` as "h2", titleId: hid ?? undefined, lead, align: align ?? "center", reveal: reveal === false ? { effect: "none" } : reveal ?? true })
    : null;
  return h("section", { ...attrs, "aria-labelledby": hid, class: () => cx("m-ss", `m-ss-${tone ?? "plain"}`, `m-ss-w-${width ?? "default"}`, `m-ss-s-${space ?? "md"}`, val(c)) },
    h("div", { class: "m-ss-inner" }, head, children));
}
