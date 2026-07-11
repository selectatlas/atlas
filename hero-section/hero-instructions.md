# Concentric Rings Hero — Claude Code Build Instructions

Build a new landing hero as a single client component. Do not touch other routes.

**Stack:** Next.js App Router, TypeScript, Tailwind installed. Use styled-jsx inside the component so no extra config is needed.

---

## Concept

Concentric rings of image tiles orbit slowly around the centre. A radial CSS mask hides the middle so tiles only show around the rim. The headline and buttons sit on a separate static layer above the rings.

---

## Files

- `components/Hero.tsx` — the component
- Render `Hero` at the top of `app/page.tsx`
- Tiles live in `public/hero` as `01.jpg` upward

---

## Layer structure

Nest exactly like this to avoid transform conflicts.

```
section.hero
  > div.stage            position absolute inset-0, holds the radial mask
    > div.ring-center    absolute top/left 50%, a zero-size centring point
      > div.ring         one per ring, the only element that rotates
        > div.slot       rotate(--a) translateX(--r) to place a tile on the rim
          > div.card     translate(-50%,-50%) rotate(--t minus --a) sets tilt, keeps position
            > div.spin   counter-rotates so tiles hold their angle while orbiting
              > img.tile
  > div.fade             bottom gradient into the paper background
  > div.content          wordmark, h1, two pill buttons, z-index above the rings
```

---

## Rings

Define one config array and derive everything from it.

```ts
const RINGS = [
  { r: 36, n: 10, dir:  1, dur: 160 },
  { r: 48, n: 14, dir: -1, dur: 200 },
  { r: 60, n: 17, dir:  1, dur: 240 },
];
```

- `r` is radius in vmin, `n` is tile count, `dir` is rotation direction, `dur` is speed in seconds.
- `n` scales with `r` so the gap between tiles stays roughly equal across rings.
- Each ring is its own rotating element. Set `--turn` (dir times 360deg) and `--dur` on it, and let its tiles inherit both.
- Offset each ring by half a step so tiles do not line up on the same spokes. `step = 360 / n`, `offset = step * 0.5 * ringIndex`.

---

## Per tile

- Angle `a = (360 / n) * j + offset` for even spacing.
- Radius `r =` the ring radius, fixed, no jitter.
- Tilt `t =` random ±26 deg, a varied lean held steady while orbiting.
- Use a deterministic pseudo-random for tilt so it stays stable across renders.

```
rand(i, seed) = fract(sin(i * 127.1 + seed * 311.7) * 43758.5453)
```

---

## Tiles

- Uniform size for every tile. Use CSS vars: `--tile clamp(52px, 5.4vw, 92px)`, `--ar 1.15` (height over width).
- `border-radius: 18px`, `object-fit: cover`, soft shadow `0 10px 26px rgba(0,0,0,0.07)`.

---

## Mask

On `.stage`, use a circle so the rings stay even.

```css
-webkit-mask: radial-gradient(circle closest-side, transparent var(--reveal), #000 72%);
mask: radial-gradient(circle closest-side, transparent var(--reveal), #000 72%);
```

`--reveal: 34%`.

---

## Animation

Two keyframes driven by the inherited `--turn` so direction and speed vary per ring.

```css
@keyframes orbit   { to { transform: rotate(var(--turn)); } }
@keyframes counter { to { transform: rotate(calc(var(--turn) * -1)); } }
```

- `.ring` uses `animation: orbit var(--dur) linear infinite`.
- `.spin` uses `animation: counter var(--dur) linear infinite`.
- Respect `prefers-reduced-motion`: disable both animations.

---

## Tokens

```
--paper  #f7f5f1
--ink    #171717
--reveal 34%
--tile   clamp(52px, 5.4vw, 92px)
--ar     1.15
```

---

## Content

- Small wordmark, `h1` with a two-line headline, two pill buttons (primary solid ink, secondary outline).
- Keep the content layer at `z-index: 10` above the rings.

---

## Images

Build an `IMAGES` array at the top of the file, length equal to the sum of ring counts, mapping to `/hero/01.jpg` upward, so assets swap in one place.

---

## Finish

Confirm the page builds cleanly, then stop. Do not add the nav or search bar yet, that is a separate component.

---

## Asset and fit notes

- **Assets:** tiles around 300px on the long edge, mixed subjects, muted tones with a few vivid accents. The layout crops every tile to the same box, so source dimensions do not need to match.
- **Vertical fit:** on wide monitors the outer ring at 60vmin grazes the top and bottom, which mirrors the reference. For all three rings fully inside the viewport, use radii 30, 40, 50 and `--reveal` 28 percent.

---

## Tuning knobs

- **Ring size:** the `r` values. Higher pushes tiles toward the edges.
- **Ring spacing:** keep `r` values evenly spaced for equal gaps between rings.
- **Even gaps within a ring:** set `n` near `radius / 3.5`.
- **Centre clearance:** `--reveal` sets the clear zone for the headline.
- **Tile size:** `--tile` controls all tiles at once.
- **Tilt spread:** the multiplier on `t`. It maps to twice the max angle, so 52 gives ±26 deg. Use 40 for ±20, 70 for ±35.
- **Corner rounding:** `border-radius`, 18px default.
- **Motion:** set every `dir` the same and every `dur` equal to lock all rings as one disc.
