"use client";

import type { CSSProperties } from "react";

const RINGS = [
  { r: 36, n: 10, dir: 1, dur: 160 },
  { r: 48, n: 14, dir: -1, dur: 200 },
  { r: 60, n: 17, dir: 1, dur: 240 },
] as const;

const TILE_COUNT = RINGS.reduce((sum, ring) => sum + ring.n, 0);
const HERO_IMAGE_COUNT = 13;
const MAX_TILE_ROTATION = 15;
const HERO_IMAGES: string[] = Array.from(
  { length: HERO_IMAGE_COUNT },
  (_, i) => `/hero/${String(i + 1).padStart(2, "0")}.jpg`,
);
const IMAGES: string[] = Array.from(
  { length: TILE_COUNT },
  (_, i) => HERO_IMAGES[i % HERO_IMAGES.length],
);

const rand = (i: number, seed: number) => {
  let value = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(seed + 1, 0x85ebca6b);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x100000000;
};

const deg = (value: number) => `${value.toFixed(4)}deg`;

type Tile = {
  src: string;
  positionAngle: number;
  radius: number;
  rotation: number;
};

type RingGroup = {
  turn: number;
  duration: number;
  tiles: Tile[];
};

const buildRings = (): RingGroup[] => {
  let imageIndex = 0;

  return RINGS.map((ring, ringIndex) => {
    const step = 360 / ring.n;
    const offset = step * 0.5 * ringIndex;
    const tiles = Array.from({ length: ring.n }, (_, tileIndex) => {
      const tile: Tile = {
        src: IMAGES[imageIndex],
        positionAngle: step * tileIndex + offset,
        radius: ring.r,
        rotation: (rand(imageIndex, 3) - 0.5) * MAX_TILE_ROTATION * 2,
      };

      imageIndex += 1;
      return tile;
    });

    return {
      turn: ring.dir * 360,
      duration: ring.dur,
      tiles,
    };
  });
};

const cssVars = (vars: Record<string, string>): CSSProperties =>
  vars as CSSProperties;

export default function Hero() {
  const rings = buildRings();

  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="stage" aria-hidden="true">
        <div className="ring-center">
          {rings.map((ring, ringIndex) => (
            <div
              className="ring"
              key={ringIndex}
              style={cssVars({
                "--turn": deg(ring.turn),
                "--dur": `${ring.duration}s`,
              })}
            >
              {ring.tiles.map((tile, tileIndex) => (
                <div
                  className="slot"
                  key={tileIndex}
                  style={cssVars({
                    "--position-angle": deg(tile.positionAngle),
                    "--radius": `${tile.radius}vmin`,
                  })}
                >
                  <div
                    className="card"
                    style={cssVars({
                      "--position-angle": deg(tile.positionAngle),
                      "--rotation": deg(tile.rotation),
                    })}
                  >
                    <div className="spin">
                      <img className="tile" src={tile.src} alt="" loading="lazy" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="fade" aria-hidden="true" />

      <div className="content">
        <span className="wordmark">CASTD</span>
        <h1 id="hero-title">
          Your space
          <br />
          for talent
        </h1>
        <div className="actions">
          <a className="btn btn-primary" href="/signup">
            Sign up
          </a>
          <a className="btn btn-ghost" href="/login">
            Sign in
          </a>
        </div>
      </div>

    </section>
  );
}
