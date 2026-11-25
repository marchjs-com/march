// Looks: ready-made styles (filters) built from ordinary ops, so a picked look is an editable edit list, not a black
// box. `look(id, strength)` returns a look's ops at a strength (each op's mix), `randomLook(seed)` invents a harmonious
// one. Labels are English; components translate them.
import { defOf, opOf, type ImageOp } from "./op.ts";
import { curves } from "./ops/curves.ts";
import { splitTone } from "./ops/split-tone.ts";
import { colorBalance } from "./ops/color-balance.ts";
import { bw } from "./ops/bw.ts";
import { grain } from "./ops/grain.ts";
import { vignette } from "./ops/vignette.ts";
import { clarity } from "./ops/clarity.ts";
import { saturation } from "./ops/saturation.ts";
import { vibrance } from "./ops/vibrance.ts";
import { contrast } from "./ops/contrast.ts";
import { temperature } from "./ops/temperature.ts";
import { tint } from "./ops/tint.ts";
import { exposure } from "./ops/exposure.ts";
import { highlights } from "./ops/highlights.ts";
import { shadows } from "./ops/shadows.ts";
import { blacks } from "./ops/blacks.ts";

/** Op values of any params type as the engine's list type. */
const list = (...ops: ImageOp<object>[]): ImageOp[] => ops as ImageOp[];

/** A named style: a short list of ops. */
export interface Look {
  id: string;
  /** English name (components translate it). */
  label: string;
  ops: ImageOp[];
}

/** The built-in looks. */
export const LOOKS: Look[] = [
  { id: "vintage", label: "Vintage", ops: list(curves({ rgb: [[0, 0.08], [0.5, 0.5], [1, 0.93]] }), splitTone({ highlightHue: 42, highlightSaturation: 28, shadowHue: 190, shadowSaturation: 14 }), saturation(-22), vignette(-25), grain(18)) },
  { id: "film", label: "Film", ops: list(curves({ rgb: [[0, 0.05], [0.25, 0.22], [0.75, 0.8], [1, 0.97]] }), colorBalance({ shadows: [-8, 0, 10], highlights: [8, 0, -8] }), saturation(-10), grain(22)) },
  { id: "sepia", label: "Sepia", ops: list(bw({ tintHue: 35, tintAmount: 55 }), contrast(10), vignette(-15)) },
  { id: "cool", label: "Cool", ops: list(temperature(-28), tint(4), splitTone({ shadowHue: 215, shadowSaturation: 18 }), vibrance(10)) },
  { id: "warm", label: "Warm", ops: list(temperature(28), vibrance(14), highlights(-10), splitTone({ highlightHue: 38, highlightSaturation: 15 })) },
  { id: "matte", label: "Matte", ops: list(curves({ rgb: [[0, 0.12], [0.25, 0.29], [0.75, 0.78], [1, 0.95]] }), saturation(-15), contrast(-8)) },
  { id: "high-contrast", label: "High contrast", ops: list(contrast(45), blacks(-20), clarity(25), vibrance(15)) },
  { id: "cinematic", label: "Cinematic", ops: list(splitTone({ highlightHue: 32, highlightSaturation: 38, shadowHue: 188, shadowSaturation: 40, balance: 10 }), contrast(18), saturation(-12), curves({ rgb: [[0, 0.04], [0.5, 0.5], [1, 0.97]] }), vignette(-20)) },
  { id: "night", label: "Night", ops: list(exposure(-0.6), temperature(-45), saturation(-35), contrast(15), colorBalance({ shadows: [-10, 0, 20] }), vignette(-30)) },
  { id: "pastel", label: "Pastel", ops: list(exposure(0.3), contrast(-30), saturation(-25), splitTone({ highlightHue: 330, highlightSaturation: 16, shadowHue: 180, shadowSaturation: 12 })) },
  { id: "faded", label: "Faded", ops: list(curves({ rgb: [[0, 0.15], [1, 0.9]] }), saturation(-30), contrast(-15)) },
  { id: "drama", label: "Drama", ops: list(clarity(50), contrast(30), highlights(-40), shadows(20), saturation(-20), vignette(-35)) },
  { id: "noir", label: "Noir", ops: list(bw({ red: 120, orange: 110, yellow: 90, blue: 60 }), contrast(45), clarity(30), vignette(-40), grain(15)) },
];

/** A copy of an op (its implementation attached) with a mix. */
function withMix(op: ImageOp, mix: number): ImageOp {
  const def = defOf(op), copy: ImageOp = def ? opOf(def, op.params) : { type: op.type, params: { ...op.params } };
  const m = Math.max(0, Math.min(1, mix)) * (op.mix ?? 1);
  if (m < 1) copy.mix = m;
  return copy;
}

/** A look's ops at `strength` 0–1 (each op's mix), ready to add to an edit; [] for an unknown id. */
export function look(id: string, strength = 1): ImageOp[] {
  const l = LOOKS.find((x) => x.id === id);
  return l ? l.ops.map((op) => withMix(op, strength)) : [];
}

/** Small deterministic random numbers (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random but harmonious look (complementary split tone, gentle tone and colour moves): the same seed, the same look. */
export function randomLook(seed: number): Look {
  const r = rng(seed), between = (a: number, b: number): number => Math.round(a + (b - a) * r());
  const base = between(0, 359), opposite = (base + 180 + between(-25, 25)) % 360;
  const ops: ImageOp<object>[] = [
    splitTone({ highlightHue: base, highlightSaturation: between(10, 35), shadowHue: opposite, shadowSaturation: between(10, 35), balance: between(-30, 30) }),
    contrast(between(-20, 30)),
    saturation(between(-35, 15)),
  ];
  if (r() < 0.5) ops.push(temperature(between(-25, 25)));
  if (r() < 0.4) { const lift = between(3, 14) / 100; ops.push(curves({ rgb: [[0, lift], [1, 1 - lift / 2]] })); }
  if (r() < 0.5) ops.push(vignette(between(-35, -10)));
  else if (r() < 0.5) ops.push(grain({ amount: between(10, 30), seed }));
  return { id: `random-${seed}`, label: "Surprise", ops: list(...ops.slice(0, 6)) };
}
