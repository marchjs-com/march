# StereoVu

The stereo VU-meter pair of a tape deck or a mixing console: two needle VU meters side by side on one panel, left and
right, each with a peak light that flashes when its channel goes over a level. The meters are Gauge `variant="vu"`
(a dB scale that crowds towards the top, as a real VU meter's does, and needles with 300 ms VU ballistics on the motion
engine); the panel feeds them the left and right levels of a live sound (`source`, see march/audio) or two numbers
(`value`). It reads only while it is on screen.

```tsx
const song = audioSource(audioEl)
<StereoVu source={song} />
<StereoVu source={mic} reference={0.126} panel="dark" peak={2} />            // 0 VU = −18 dBFS, as in a studio
<StereoVu value={[$left, $right]} peakHold={0} onPeak={(ch) => warn(ch)} />   // latched lights, reset by a press
<StereoVu source={song} panel="wood" size={180} needle="spring" caption="dB" />
```

## Props

| Prop | |
|---|---|
| `source` | A live sound: an AudioSource or what makes one ("mic", "demo", an `<audio>`, a stream, a number accessor). The needles show its left and right levels. |
| `value` | Levels 0–1 instead: `[left, right]`, or one number for both (it may be live). |
| `reference` | The level 0–1 that reads 0 VU. Default 0.5 (−6 dBFS); 0.126 is −18 dBFS, the usual studio line-up. |
| `peak` | The VU dB where a peak light flashes; `false`: no lights. Default +1. |
| `peakHold` | How long a light stays lit (ms); `0` latches it until it is pressed. Default 1200. |
| `redline` | Where the red zone starts (VU dB); `false`: none. Default 0. |
| `needle` | `"vu"` (default), `"spring"` or `"none"`. |
| `caption` | Text on each dial. Default "VU"; `false`: none. |
| `labels` / `channelNames` | Letters on the panel (["L", "R"]) and spoken channel names (["left", "right"]). |
| `label` / `peakLabel` | Accessible name of the panel ("Stereo VU") and of a peak light's button ("Reset peak"). |
| `panel` | `"metal"` (default), `"dark"` or `"wood"`. |
| `size` | Width of each meter in px. Default 220. |
| `color` | Theme color token of the needles. |
| `parts` | `{ panel, labels, lights, caption, ticks, glass }` on or off. |
| `motion` | `false` (or `"none"`): the needles stand on the value at once. Reduced motion does the same. |
| `onPeak` / `onPeakReset` | A light came on / was pressed (0 = left, 1 = right). |
| `class` | Extra class on the root. |

Class hooks: `m-svu` (root; `m-svu-metal|dark|wood`, `m-svu-bare`, `m-svu-noglass`), `m-svu-ch` (`is-left`,
`is-right`), `m-svu-meter` (the Gauge: every `m-gauge-*` hook inside), `m-svu-foot`, `m-svu-label`, `m-svu-light`
(`is-on`). CSS variables: `--m-svu-w`, `--m-svu-pad`, `--m-svu-ink`, `--m-svu-screw`.

## Accessibility

- The panel is a `group` named "Stereo VU"; each dial is a `meter` named "Stereo VU, left" / "Stereo VU, right" with
  its value in dB, updated at most four times a second.
- Each peak light is a button (`aria-pressed` while lit) named "Reset peak, left": Enter or Space turns it off.
- The pair always reads left then right, also in a right-to-left page (the channels are physical sides).
- Reduced motion: a live source reads twice a second and the needles jump instead of swinging.

## Composed of

Gauge (`variant="vu"`, one per channel), IconButton holding a StatusDot (each peak light).
