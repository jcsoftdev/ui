"use client";

import type { CSSProperties } from "react";
import {
  type AuthState,
  keystroke,
  SLAB_COUNT,
  slabPlacement,
  slabSpread,
  sparkVectors,
} from "../auth-illustration/model.js";
import { PORTAL_GLYPHS } from "../internal/portal-glyphs.js";

/** Rules of the slabs look: colours per slab, depth faces, entrance, parallax, hop and cheer. */
const CSS = `
@keyframes ui-auth-drop{0%{opacity:0;transform:translateY(-180px)}45%{opacity:1}}
@keyframes ui-auth-shadow-in{from{opacity:0;transform:scale(.35)}}
@keyframes ui-auth-bob{50%{transform:translateY(-7px)}}
@keyframes ui-auth-hop-0{40%{transform:translateY(-11px)}}
@keyframes ui-auth-hop-1{40%{transform:translateY(-11px)}}
@keyframes ui-auth-cheer{35%{transform:translateY(-18px)}70%{transform:translateY(3px)}}
.ui-auth-slab-tone-0{--top:var(--accent);--glyph-a:var(--surface);--glyph-b:var(--ink);--glyph-c:var(--accent);--dots:color-mix(in srgb,black 30%,transparent)}
.ui-auth-slab-tone-1{--top:var(--surface);--glyph-a:var(--accent);--glyph-b:var(--ink);--glyph-c:var(--surface);--dots:color-mix(in srgb,black 30%,transparent)}
.ui-auth-slab-tone-2{--top:color-mix(in srgb,var(--ink) 86%,var(--surface));--glyph-a:var(--accent);--glyph-b:var(--surface);--glyph-c:var(--surface);--dots:color-mix(in srgb,white 20%,transparent)}
.ui-auth-art[data-panel=solid] .ui-auth-slab-tone-0{--top:var(--auth-art-ink);--glyph-a:var(--auth-art-bg);--glyph-b:var(--auth-art-ink);--glyph-c:var(--ua-tint);--dots:color-mix(in srgb,var(--auth-art-bg) 30%,transparent)}
.ui-auth-art[data-panel=solid] .ui-auth-slab-tone-1{--top:var(--ua-tint);--glyph-a:var(--auth-art-ink);--glyph-b:var(--auth-art-ink);--glyph-c:var(--ua-tint);--dots:color-mix(in srgb,var(--auth-art-ink) 35%,transparent)}
.ui-auth-art[data-panel=solid] .ui-auth-slab-tone-2{--top:var(--ua-mid);--glyph-a:var(--ua-tint);--glyph-b:var(--auth-art-ink);--glyph-c:var(--ua-mid);--dots:color-mix(in srgb,var(--auth-art-ink) 35%,transparent)}
.ui-auth-art[data-panel=solid] .ui-auth-inlay{stroke:color-mix(in srgb,var(--auth-art-ink) 22%,transparent)}
.ui-auth-slab{--glyph-line:var(--accent);--left:color-mix(in srgb,var(--top) 82%,black);--right:color-mix(in srgb,var(--top) 66%,black)}
.ui-auth-art[data-panel=solid] .ui-auth-slab-tone-0{--glyph-line:var(--auth-art-ink)}
.ui-auth-art[data-panel=solid] .ui-auth-slab-tone-2{--glyph-line:var(--ua-tint)}
.ui-auth-art[data-state=error] .ui-auth-slab{--edge:color-mix(in srgb,var(--danger) 70%,var(--ua-edge))}
.ui-auth-pos{transform:translate(calc(var(--x) * 1px),calc(var(--y) * 1px));transition:transform .85s var(--ua-bounce)}
.ui-auth-par{transform:translate(calc(var(--px,0) * (5px + var(--i) * 3px)),calc(var(--py,0) * (4px + var(--i) * 2px)));transition:transform .6s var(--ua-glide)}
.ui-auth-lift{transform:translateY(calc(var(--lift) * -1px));transition:transform .85s var(--ua-bounce)}
.ui-auth-enter{animation:ui-auth-drop .9s var(--ua-land) backwards;animation-delay:calc(.15s + var(--i) * .14s)}
.ui-auth-hop-0{animation:ui-auth-hop-0 .32s var(--ua-glide)}
.ui-auth-hop-1{animation:ui-auth-hop-1 .32s var(--ua-glide)}
.ui-auth-art[data-state=success] .ui-auth-hop{animation:ui-auth-cheer .5s var(--ua-glide) backwards;animation-delay:calc(.75s + var(--i) * .07s)}
.ui-auth-bob{animation:ui-auth-bob 4.6s ease-in-out infinite;animation-delay:calc(var(--i) * -1.4s)}
.ui-auth-face-top{fill:var(--top)}
.ui-auth-face-left{fill:var(--left)}
.ui-auth-face-right{fill:var(--right)}
.ui-auth-edge{stroke:var(--edge,var(--ua-edge));stroke-width:2.2;stroke-linejoin:round}
.ui-auth-dots{fill:var(--dots)}
.ui-auth-shadow{fill:var(--ua-shadow);transform-box:fill-box;transform-origin:center;opacity:calc(1 - var(--lift) / 150);transition:opacity .85s var(--ua-glide);animation:ui-auth-shadow-in .9s var(--ua-land) backwards;animation-delay:calc(.15s + var(--i) * .14s)}
.ui-auth-inlay{fill:none;stroke:color-mix(in srgb,var(--ink) 14%,transparent);stroke-width:2}
@media (prefers-reduced-motion:reduce){
.ui-auth-enter,.ui-auth-bob,.ui-auth-art[data-state] .ui-auth-hop,.ui-auth-hop-0,.ui-auth-hop-1,.ui-auth-shadow{animation:none}
.ui-auth-pos,.ui-auth-lift,.ui-auth-shadow{transition:none}
.ui-auth-par{transform:none;transition:none}
}
`;

const THICKNESS = 22;
const TOP = "M0 0 L86.6 50 L0 100 L-86.6 50Z";
const LEFT = `M-86.6 50 L0 100 L0 ${100 + THICKNESS} L-86.6 ${50 + THICKNESS}Z`;
const RIGHT = `M0 100 L86.6 50 L86.6 ${50 + THICKNESS} L0 ${100 + THICKNESS}Z`;
const SPARK = "M0-11 L3-3 L11 0 L3 3 L0 11 L-3 3 L-11 0 L-3-3Z";
const SPARKS = sparkVectors();

function Slab({
  index,
  spread,
  activeIndex,
  dotsId,
  hop,
}: {
  index: number;
  spread: number;
  activeIndex: number;
  dotsId: string;
  hop: 0 | 1 | null;
}) {
  const live = slabPlacement(index, spread, activeIndex);
  const vars = {
    "--i": index,
    "--x": live.x,
    "--y": live.y,
    "--lift": live.lift,
  } as CSSProperties;
  const dots = `url(#${dotsId})`;
  return (
    <g className={`ui-auth-pos ui-auth-slab ui-auth-slab-tone-${index}`} style={vars}>
      <g transform={`translate(24 ${THICKNESS + 22})`}>
        <path className="ui-auth-shadow" d={TOP} />
      </g>
      <g className="ui-auth-par">
        <g className="ui-auth-lift">
          <g className="ui-auth-enter">
            <g className={hop === null ? "ui-auth-hop" : `ui-auth-hop ui-auth-hop-${hop}`}>
              <g className="ui-auth-bob">
                <path className="ui-auth-face-left ui-auth-edge" d={LEFT} />
                <path className="ui-auth-face-right ui-auth-edge" d={RIGHT} />
                <path d={LEFT} fill={dots} />
                <path d={RIGHT} fill={dots} />
                <path className="ui-auth-face-top ui-auth-edge" d={TOP} />
                <g transform="matrix(0.866 0.5 -0.866 0.5 0 0)">
                  <rect className="ui-auth-inlay" x="9" y="9" width="82" height="82" rx="8" />
                  {PORTAL_GLYPHS[index]}
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </g>
  );
}

export interface SlabsProps {
  state: AuthState;
  progress: number;
  activeIndex: number;
  /** Unique within the page; names the halftone pattern. */
  uid: string;
}

/** Three isometric portal slabs that float apart at rest and assemble as the form fills. */
export function Slabs({ state, progress, activeIndex, uid }: SlabsProps) {
  const spread = slabSpread(state, progress);
  const dotsId = `${uid}-dots`;
  // The last keystroke's hop class stays on through every state: a CSS animation restarts only
  // when its class changes, so an error settling back to password, or a refocus, never hops.
  const tick = keystroke(progress, SLAB_COUNT);
  return (
    <>
      <style href="jcsoftdev-ui-auth-slabs" precedence="default">
        {CSS}
      </style>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: the wrapper names the illustration or hides it */}
      <svg
        viewBox="40 60 560 440"
        focusable="false"
        style={{ "--spread": spread } as CSSProperties}
      >
        <defs>
          <pattern id={dotsId} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle className="ui-auth-dots" cx="2.5" cy="2.5" r="1" />
          </pattern>
        </defs>
        {Array.from({ length: SLAB_COUNT }, (_, index) => (
          <Slab
            // biome-ignore lint/suspicious/noArrayIndexKey: the three slabs are fixed
            key={index}
            index={index}
            spread={spread}
            activeIndex={activeIndex}
            dotsId={dotsId}
            hop={tick.count > 0 && tick.target === index ? tick.phase : null}
          />
        ))}
        {state === "success" ? (
          <g>
            {SPARKS.map((spark, n) => (
              <g key={`${spark.dx}:${spark.dy}`} transform="translate(320 250)">
                {n % 2 ? (
                  <circle
                    className="ui-auth-spark"
                    data-tone={n % 4}
                    r="5"
                    style={{ "--dx": `${spark.dx}px`, "--dy": `${spark.dy}px` } as CSSProperties}
                  />
                ) : (
                  <path
                    className="ui-auth-spark"
                    data-tone={n % 4}
                    d={SPARK}
                    style={{ "--dx": `${spark.dx}px`, "--dy": `${spark.dy}px` } as CSSProperties}
                  />
                )}
              </g>
            ))}
          </g>
        ) : null}
      </svg>
    </>
  );
}

Slabs.variant = "slabs";
