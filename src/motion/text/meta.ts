// Catalog of hadi-march/motion/text: every animation with its family and the shared options it reads. Tools, docs and
// the showcase use it (a test checks that every exported animation is listed). Not imported by the animations.
export type TextFamily = "enter" | "loop" | "decorate" | "content" | "interactive";
/** Shared options an animation reads (the rest have no effect on it). */
export type TextOptionKey = "by" | "duration" | "stagger" | "easing";
export interface TextAnimMeta {
  name: string;
  family: TextFamily;
  options: readonly TextOptionKey[];
  /** Text that shows it best ("|" separates the words of a cycle). */
  sample?: string;
}

const ALL: readonly TextOptionKey[] = ["by", "duration", "stagger", "easing"];
const LINE: readonly TextOptionKey[] = ["duration", "stagger", "easing"];
const TIME: readonly TextOptionKey[] = ["duration"];
const NONE: readonly TextOptionKey[] = [];
const fam = (family: TextFamily, options: readonly TextOptionKey[], names: string): TextAnimMeta[] => names.split(" ").map((n) => {
  const [name, sample] = n.split("=") as [string, string | undefined];
  return { name, family, options, ...(sample ? { sample: sample.replace(/_/g, " ") } : {}) };
});

/** Every text animation with its family (enter, exit, loop, decorate, change, interactive), split mode and cost. */
export const TEXT_ANIMATIONS: readonly TextAnimMeta[] = [
  ...fam("enter", ALL, "fade dissolve blurIn rise drop slideIn pop zoomIn flip rotateIn swing elastic bounceIn tilt perspective skewIn splitReveal maskReveal wipe cascade spin jelly trackIn implode explode inkBleed pixelate glitch shake"),
  ...fam("loop", ALL, "wave bounce jitter float pulse rainbow neon breathe glow shimmer"),
  ...fam("decorate", LINE, "highlight underline strike gradientSweep strokeDraw"),
  ...fam("content", TIME, "typewriter scramble decode matrix splitFlap=KALKIŞ_09:45 counter=₺12.500 odometer=2026"),
  ...fam("content", NONE, "typeLoop=hızlı|küçük|erişilebilir wordCycle=hızlı|küçük|erişilebilir morph=Merhaba|Hello|مرحبا"),
  ...fam("interactive", NONE, "magnetic repel"),
];
