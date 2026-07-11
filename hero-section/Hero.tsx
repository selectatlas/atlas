"use client";

import { useMemo } from "react";

// Concentric rings. Counts scale with radius so the gap between tiles stays
// roughly equal on every ring. dir alternates rotation direction, dur is speed in seconds.
const RINGS = [
  { r: 36, n: 10, dir: 1, dur: 160 },
  { r: 48, n: 14, dir: -1, dur: 200 },
  { r: 60, n: 17, dir: 1, dur: 240 },
];

// One image per tile. Total must be >= sum of ring counts (here 41).
const TILE_COUNT = RINGS.reduce((sum, ring) => sum + ring.n, 0);
const IMAGES: string[] = Array.from(
  { length: TILE_COUNT },
  (_, i) => `/hero/${String(i + 1).padStart(2, "0")}.jpg`
);

// Deterministic pseudo-random so tilt stays stable across renders.
const rand = (i: number, seed: number) => {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Tile = { src: string; a: number; r: number; t: number };
type RingGroup = { turn: number; dur: number; tiles: Tile[] };

export default function Hero() {
  const rings = useMemo<RingGroup[]>(() => {
    let gi = 0;
    return RINGS.map((ring, ri) => {
      const step = 360 / ring.n;
      const offset = step * 0.5 * ri; // interleave rings so tiles do not line up radially
      const tiles: Tile[] = Array.from({ length: ring.n }, (_, j) => {
        const tile: Tile = {
          src: IMAGES[gi],
          a: step * j + offset,
          r: ring.r,
          t: (rand(gi, 3) - 0.5) * 52, // varied tilt, ±26 deg
        };
        gi++;
        return tile;
      });
      return { turn: ring.dir * 360, dur: ring.dur, tiles };
    });
  }, []);

  return (
    <section className="hero">
      <div className="stage" aria-hidden="true">
        <div className="ring-center">
          {rings.map((ring, ri) => (
            <div
              key={ri}
              className="ring"
              style={{ "--turn": `${ring.turn}deg`, "--dur": `${ring.dur}s` } as React.CSSProperties}
            >
              {ring.tiles.map((tile, j) => (
                <div
                  key={j}
                  className="slot"
                  style={{ "--a": `${tile.a}deg`, "--r": `${tile.r}vmin` } as React.CSSProperties}
                >
                  <div
                    className="card"
                    style={{ "--a": `${tile.a}deg`, "--t": `${tile.t}deg` } as React.CSSProperties}
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
        <h1>
          Your space
          <br />
          for talent
        </h1>
        <div className="actions">
          <a className="btn btn-primary" href="/start">
            Sign up
          </a>
          <a className="btn btn-ghost" href="/app">
            Get the app
          </a>
        </div>
      </div>

      <style jsx>{`
        .hero {
          --paper: #f7f5f1;
          --ink: #171717;
          --reveal: 34%;
          --tile: clamp(52px, 5.4vw, 92px);
          --ar: 1.15;

          position: relative;
          min-height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: var(--paper);
        }

        .stage {
          position: absolute;
          inset: 0;
          pointer-events: none;
          -webkit-mask: radial-gradient(circle closest-side, transparent var(--reveal), #000 72%);
          mask: radial-gradient(circle closest-side, transparent var(--reveal), #000 72%);
        }

        .ring-center {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
        }

        .ring {
          position: absolute;
          left: 0;
          top: 0;
          width: 0;
          height: 0;
          animation: orbit var(--dur) linear infinite;
        }

        .slot {
          position: absolute;
          left: 0;
          top: 0;
          transform: rotate(var(--a)) translateX(var(--r));
        }

        .card {
          position: absolute;
          transform: translate(-50%, -50%) rotate(calc(var(--t) - var(--a)));
        }

        .spin {
          animation: counter var(--dur) linear infinite;
        }

        .tile {
          display: block;
          width: var(--tile);
          height: calc(var(--tile) * var(--ar));
          object-fit: cover;
          border-radius: 18px;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.07);
        }

        @keyframes orbit {
          to {
            transform: rotate(var(--turn));
          }
        }
        @keyframes counter {
          to {
            transform: rotate(calc(var(--turn) * -1));
          }
        }

        .fade {
          position: absolute;
          inset-inline: 0;
          bottom: 0;
          height: 240px;
          pointer-events: none;
          background: linear-gradient(
            transparent,
            rgba(247, 245, 241, 0.55) 38%,
            var(--paper) 84%
          );
        }

        .content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          text-align: center;
        }

        .wordmark {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.34em;
          color: var(--ink);
        }

        h1 {
          margin: 0;
          font-weight: 400;
          font-size: clamp(42px, 6.4vw, 74px);
          line-height: 0.98;
          letter-spacing: -0.03em;
          color: var(--ink);
          text-wrap: pretty;
        }

        .actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .btn {
          height: 56px;
          padding: 0 30px;
          border-radius: 999px;
          font-size: 17px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }
        .btn-primary {
          background: var(--ink);
          color: var(--paper);
        }
        .btn-primary:hover {
          background: #333;
        }
        .btn-ghost {
          background: transparent;
          color: var(--ink);
          border-color: rgba(0, 0, 0, 0.16);
        }
        .btn-ghost:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        @media (prefers-reduced-motion: reduce) {
          .ring,
          .spin {
            animation: none;
          }
        }
      `}</style>
    </section>
  );
}
