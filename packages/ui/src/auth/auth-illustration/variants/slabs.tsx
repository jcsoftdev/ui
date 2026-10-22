import type { CSSProperties } from "react";
import {
  type AuthState,
  keystroke,
  SLAB_COUNT,
  slabPlacement,
  slabSpread,
  sparkVectors,
} from "../model.js";
import { PORTAL_GLYPHS } from "./portal-glyphs.js";

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
  const assembled = slabPlacement(index, 0, -1);
  const vars = {
    "--i": index,
    "--x": live.x,
    "--y": live.y,
    "--lift": live.lift,
    "--x0": assembled.x,
    "--y0": assembled.y,
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
  const tick = keystroke(progress, SLAB_COUNT);
  const typing = (state === "typing" || state === "password") && tick.count > 0;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: the wrapper names the illustration or hides it
    <svg viewBox="40 60 560 440" focusable="false" style={{ "--spread": spread } as CSSProperties}>
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
          hop={typing && tick.target === index ? tick.phase : null}
        />
      ))}
      {state === "success" ? (
        <g>
          {SPARKS.map((spark, n) => (
            <g key={`${spark.dx}:${spark.dy}`} transform="translate(320 250)">
              {n % 2 ? (
                <circle
                  className="ui-auth-spark"
                  r="5"
                  style={{ "--dx": `${spark.dx}px`, "--dy": `${spark.dy}px` } as CSSProperties}
                />
              ) : (
                <path
                  className="ui-auth-spark"
                  d={SPARK}
                  style={{ "--dx": `${spark.dx}px`, "--dy": `${spark.dy}px` } as CSSProperties}
                />
              )}
            </g>
          ))}
        </g>
      ) : null}
    </svg>
  );
}
