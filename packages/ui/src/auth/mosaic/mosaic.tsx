"use client";

import type { CSSProperties } from "react";
import type { AuthVariantProps } from "../auth-illustration/look.js";
import {
  isoBox,
  isoPoint,
  keystroke,
  MOSAIC_GLYPH_TILES,
  MOSAIC_SIZES,
  mosaicFilled,
  mosaicGlint,
  mosaicTiles,
} from "../auth-illustration/model.js";
import { PORTAL_GLYPHS } from "../internal/portal-glyphs.js";

/** Side of the tiled floor, the platform's margin and thickness, and the tiles' depth, in iso units. */
const FLOOR = 260;
const MARGIN = 12;
const BASE_H = 26;
const TILE_H = 14;
const GAP = 3;
const VIEW = { x: -270, y: -215, w: 540, h: 400 } as const;
const CENTER_Y = VIEW.y + VIEW.h / 2;

const PLATFORM = isoBox(FLOOR + MARGIN * 2, FLOOR + MARGIN * 2, BASE_H);
const SHADOW = isoBox(FLOOR + MARGIN * 2 + 30, FLOOR + MARGIN * 2 + 30, 0).top;

/** Everything above the platform's two front edges: tile sides below the floor stay hidden. */
const CLIP = (() => {
  const half = FLOOR / 2 + MARGIN;
  const left = isoPoint(-half, half, BASE_H);
  const front = isoPoint(half, half, BASE_H);
  const right = isoPoint(half, -half, BASE_H);
  return `M${left.x} ${left.y}L${front.x} ${front.y}L${right.x} ${right.y}L${right.x} ${VIEW.y}L${left.x} ${VIEW.y}Z`;
})();

/** The tiled floor seen from above, raised a little so lifted tiles stay inside it. */
const FLOOR_TOP = isoBox(FLOOR + MARGIN * 2, FLOOR + MARGIN * 2, BASE_H + 10).top;
/**
 * A soft horizontal band, parked just above the floor: on this floor a diagonal of tiles is a
 * screen row, so moving it 375px down sweeps the tiles in order.
 */
const BAND = { x: -280, y: -251, w: 560, h: 72 } as const;
/** The idle sheen and the error sweep. */
const BANDS = ["sheen", "alarm"] as const;

const GRIDS = MOSAIC_SIZES.map((n) => {
  const size = FLOOR / n;
  const face = size - GAP;
  const shape = isoBox(face, face, TILE_H);
  const inset = face * 0.07;
  const corner = isoPoint(-face / 2 + inset, -face / 2 + inset, TILE_H);
  const k = (face - inset * 2) / 100;
  const glyphTransform = `translate(${corner.x} ${corner.y}) matrix(${0.866 * k} ${0.5 * k} ${-0.866 * k} ${0.5 * k} 0 0)`;
  const glyphs = MOSAIC_GLYPH_TILES[n];
  const tiles = mosaicTiles(n).map((tile) => {
    const at = isoPoint(
      -FLOOR / 2 + (tile.col + 0.5) * size,
      -FLOOR / 2 + (tile.row + 0.5) * size,
      BASE_H - TILE_H,
    );
    const glyph = glyphs.findIndex(([row, col]) => row === tile.row && col === tile.col);
    const top = isoPoint(0, 0, TILE_H);
    return {
      ...tile,
      at,
      glyph,
      tx: Math.round(((at.x + top.x) / (VIEW.w / 2)) * 1000) / 1000,
      ty: Math.round(((at.y + top.y - CENTER_Y) / (VIEW.h / 2)) * 1000) / 1000,
    };
  });
  return { n, shape, glyphTransform, tiles };
});

/**
 * Only the floor on screen animates. The other two sizes stay in the markup for the container
 * queries, and Chrome still runs animations inside a hidden SVG group, so a hidden grid names no
 * animation: the visible one sets the names through custom properties (an unset one leaves the
 * `animation` declaration invalid, which means none).
 */
const ON = '.ui-msc-grid[data-n="';
const SHOW =
  "display:inline;--b:ui-msc-bob;--r:ui-msc-ripple;--g0:ui-msc-glint-0;--g1:ui-msc-glint-1";

const CSS = `
@keyframes ui-msc-glint-0{35%{transform:translateY(-9px)}}
@keyframes ui-msc-glint-1{35%{transform:translateY(-9px)}}
@keyframes ui-msc-sheen{58%{transform:none}86%,to{transform:translateY(375px)}}
@keyframes ui-msc-sweep{to{transform:translateY(375px)}}
@keyframes ui-msc-ripple{40%{transform:translateY(-12px)}75%{transform:translateY(2px)}}
@keyframes ui-msc-bob{50%{transform:translateY(-5px)}}
@keyframes ui-msc-rise{from{opacity:0;transform:translateY(40px)}}
.ui-msc{scale:1.12;transform-origin:50% 60%;--msc-base:color-mix(in srgb,var(--ink) 12%,var(--surface));--msc-tile:var(--surface);--msc-lit:var(--accent);--msc-active:color-mix(in srgb,var(--ink) 86%,var(--surface));--msc-glow:color-mix(in srgb,var(--accent-2) 70%,white);--msc-grout:color-mix(in srgb,var(--ink) 22%,transparent);--glyph-line:var(--accent)}
.ui-auth-art[data-panel=solid] .ui-msc{--msc-base:var(--ua-tint);--msc-tile:color-mix(in srgb,white 55%,var(--auth-art-bg));--msc-lit:var(--ua-mid);--msc-active:var(--auth-art-ink);--msc-glow:white;--msc-grout:color-mix(in srgb,var(--auth-art-ink) 28%,transparent);--glyph-line:var(--auth-art-ink)}
.ui-msc-grid{display:none}
@container art (width<24rem){${ON}4"]{${SHOW}}}
@container art (24rem<=width<34rem){.ui-msc{scale:.88}${ON}5"]{${SHOW}}}
@container art (width>=34rem){.ui-msc{scale:.9}${ON}6"]{${SHOW}}}
.ui-msc-stage{animation:ui-msc-rise .9s var(--ua-land) backwards .1s}
.ui-msc-shadow{fill:var(--ua-shadow)}
.ui-msc-base-top{fill:var(--msc-base)}
.ui-msc-base-left{fill:color-mix(in srgb,var(--msc-base) 82%,black)}
.ui-msc-base-right{fill:color-mix(in srgb,var(--msc-base) 66%,black)}
.ui-msc-dots{fill:color-mix(in srgb,black 28%,transparent)}
.ui-msc-edge{stroke:var(--msc-edge,var(--ua-edge));stroke-width:2.2;stroke-linejoin:round}
.ui-auth-art[data-state=error] .ui-msc{--msc-edge:color-mix(in srgb,var(--danger) 70%,var(--ua-edge))}
.ui-msc-tile{--top:var(--msc-tile);--glow:max(0,1 - (max(var(--px,9) - var(--tx),var(--tx) - var(--px,9)) + max(var(--py,9) - var(--ty),var(--ty) - var(--py,9))) * 2.6)}
.ui-msc-tile[data-lit]{--top:var(--msc-lit)}
.ui-msc-tile[data-active]{--top:var(--msc-active)}
.ui-msc-lift{transform:translateY(calc((var(--lit) * -8 - var(--glow) * 5 - var(--act) * 14) * 1px));transition:transform .55s var(--ua-bounce);transition-delay:calc(var(--d) * 28ms)}
.ui-msc-tile-top{fill:var(--msc-tile);stroke:var(--msc-grout);stroke-width:1.2;stroke-linejoin:round}
.ui-msc-tile[data-active] .ui-msc-tile-top{fill:var(--msc-active)}
.ui-msc-litface{fill:var(--msc-lit);opacity:var(--lit);transition:opacity .35s linear;transition-delay:calc(var(--d) * 28ms)}
.ui-msc-tile[data-active] .ui-msc-litface{opacity:0}
.ui-msc-tile-left{fill:color-mix(in srgb,var(--top) 78%,black)}
.ui-msc-side{opacity:max(var(--lit),var(--act));transition:opacity .2s linear;transition-delay:calc(var(--d) * 28ms)}
.ui-msc-tile-right{fill:color-mix(in srgb,var(--top) 62%,black)}
.ui-msc-tile[data-lit] .ui-msc-litface,.ui-msc-tile[data-active] .ui-msc-tile-top,.ui-msc-tile:is([data-lit],[data-active]) .ui-msc-side{stroke:var(--ua-edge);stroke-width:1.6;stroke-linejoin:round}
.ui-msc-glow{fill:var(--msc-glow);opacity:calc(var(--glow) * .7);transition:opacity .25s linear}
.ui-msc-sheen-stop{stop-color:white}
.ui-msc-alarm-stop{stop-color:var(--danger)}
.ui-msc-sheen{opacity:.5;animation:ui-msc-sheen 5s ease-in-out infinite}
.ui-auth-art[data-state=success] .ui-msc-sheen{opacity:.9;animation:ui-msc-sweep 1.1s .25s var(--ua-glide) backwards}
.ui-msc-alarm{opacity:.85}
.ui-auth-art[data-state=error] .ui-msc-alarm{animation:ui-msc-sweep .8s var(--ua-glide) both}
.ui-msc-bob{animation:var(--b) 3.2s ease-in-out infinite}
.ui-msc-glint-0{animation:var(--g0) .4s var(--ua-glide)}
.ui-msc-glint-1{animation:var(--g1) .4s var(--ua-glide)}
.ui-auth-art[data-state=success] .ui-msc-pop{animation:var(--r) .6s var(--ua-glide) backwards;animation-delay:calc(.25s + var(--ring) * 75ms)}
.ui-msc-glyph{--glyph-a:color-mix(in srgb,var(--ua-edge) 30%,var(--msc-tile));--glyph-b:color-mix(in srgb,var(--ua-edge) 30%,var(--msc-tile));--glyph-c:var(--msc-tile);--glyph-line:var(--msc-tile)}
.ui-msc-tile[data-lit] .ui-msc-glyph{--glyph-a:color-mix(in srgb,var(--msc-lit) 55%,black);--glyph-b:color-mix(in srgb,var(--msc-lit) 55%,black);--glyph-c:var(--msc-lit);--glyph-line:var(--msc-lit)}
.ui-msc-tile[data-active] .ui-msc-glyph{--glyph-a:var(--msc-lit);--glyph-b:var(--msc-tile);--glyph-c:var(--msc-active);--glyph-line:var(--msc-tile)}
.ui-auth-art[data-panel=solid] .ui-msc-tile[data-active] .ui-msc-glyph{--glyph-a:var(--ua-tint);--glyph-b:var(--ua-tint);--glyph-c:var(--auth-art-ink)}
@media (prefers-reduced-motion:reduce){
.ui-msc *{animation:none!important}
.ui-auth-art[data-state=error] .ui-msc-alarm{opacity:.5;transform:translateY(916px) scaleY(4.4)}
.ui-msc-lift,.ui-msc-litface,.ui-msc-side{transition:none}
}
`;

/**
 * A living floor of isometric tiles on a platform. The tiles light diagonally as the form fills,
 * glint on each keystroke and glow under the pointer, and a soft sheen crosses the floor now and
 * then; an error sweeps a red band across it and success ripples out from the centre. Three tiles carry the portal glyphs and the active one
 * stands raised. Its container picks a 4, 5 or 6 tile wide floor.
 */
export function Mosaic({ state, progress, activeIndex, uid }: AuthVariantProps) {
  const dots = `url(#${uid}-mosaic-dots)`;
  // The glint class of the last keystroke stays on through every state, so leaving an error does
  // not replay it (a CSS animation restarts only when its class changes).
  const tick = keystroke(progress);
  return (
    <>
      <style href="jcsoftdev-ui-auth-mosaic" precedence="default">
        {CSS}
      </style>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: the wrapper names the illustration or hides it */}
      <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} focusable="false" className="ui-msc">
        <defs>
          <pattern id={`${uid}-mosaic-dots`} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle className="ui-msc-dots" cx="2.5" cy="2.5" r="1" />
          </pattern>
          <clipPath id={`${uid}-mosaic-clip`}>
            <path d={CLIP} />
          </clipPath>
          <clipPath id={`${uid}-mosaic-floor`}>
            <path d={FLOOR_TOP} />
          </clipPath>
          {BANDS.map((band) => (
            <linearGradient key={band} id={`${uid}-mosaic-${band}`} x1="0" y1="0" x2="0" y2="1">
              <stop className={`ui-msc-${band}-stop`} offset="0" stopOpacity="0" />
              <stop className={`ui-msc-${band}-stop`} offset=".5" stopOpacity="1" />
              <stop className={`ui-msc-${band}-stop`} offset="1" stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        <g className="ui-msc-stage">
          <path className="ui-msc-shadow" d={SHADOW} transform="translate(16 18)" />
          <path className="ui-msc-base-left ui-msc-edge" d={PLATFORM.left} />
          <path className="ui-msc-base-right ui-msc-edge" d={PLATFORM.right} />
          <path d={PLATFORM.left} fill={dots} />
          <path d={PLATFORM.right} fill={dots} />
          <path className="ui-msc-base-top ui-msc-edge" d={PLATFORM.top} />
          <g clipPath={`url(#${uid}-mosaic-clip)`}>
            {GRIDS.map(({ n, shape, glyphTransform, tiles }) => {
              const lit = mosaicFilled(state, progress, n);
              const glint = mosaicGlint(tick.count, n);
              return (
                <g key={n} className="ui-msc-grid" data-n={n}>
                  {tiles.map((tile, k) => {
                    const on = tile.diagonal < lit;
                    const active = tile.glyph >= 0 && tile.glyph === activeIndex;
                    const vars = {
                      "--d": tile.diagonal,
                      "--ring": tile.ring,
                      "--lit": on ? 1 : 0,
                      "--act": active ? 1 : 0,
                      "--tx": tile.tx,
                      "--ty": tile.ty,
                    } as CSSProperties;
                    const pop =
                      k === glint ? `ui-msc-pop ui-msc-glint-${tick.phase}` : "ui-msc-pop";
                    return (
                      <g
                        key={`${tile.row}:${tile.col}`}
                        className="ui-msc-tile"
                        data-lit={on || undefined}
                        data-active={active || undefined}
                        style={vars}
                        transform={`translate(${tile.at.x} ${tile.at.y})`}
                      >
                        <g className="ui-msc-lift">
                          <g className={pop}>
                            <g className={active ? "ui-msc-bob" : undefined}>
                              <path className="ui-msc-side ui-msc-tile-left" d={shape.left} />
                              <path className="ui-msc-side ui-msc-tile-right" d={shape.right} />
                              <path className="ui-msc-tile-top" d={shape.top} />
                              <path className="ui-msc-litface" d={shape.top} />
                              <path className="ui-msc-glow" d={shape.top} />
                              {tile.glyph >= 0 ? (
                                <g className="ui-msc-glyph" transform={glyphTransform}>
                                  {PORTAL_GLYPHS[tile.glyph]}
                                </g>
                              ) : null}
                            </g>
                          </g>
                        </g>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </g>
          <g clipPath={`url(#${uid}-mosaic-floor)`}>
            {BANDS.map((band) => (
              <rect
                key={band}
                className={`ui-msc-band ui-msc-${band}`}
                fill={`url(#${uid}-mosaic-${band})`}
                x={BAND.x}
                y={BAND.y}
                width={BAND.w}
                height={BAND.h}
              />
            ))}
          </g>
        </g>
      </svg>
    </>
  );
}

Mosaic.variant = "mosaic";
