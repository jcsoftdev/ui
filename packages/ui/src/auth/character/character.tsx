"use client";

import type { CSSProperties } from "react";
import type { AuthVariantProps } from "../auth-illustration/look.js";
import { BOARD_LIGHTS, boardLit, keystroke } from "../auth-illustration/model.js";
import { PORTAL_GLYPHS } from "../internal/portal-glyphs.js";

const CSS = `
@keyframes ui-chr-bob{50%{transform:translateY(-12px)}}
@keyframes ui-chr-pulse{50%{transform:scale(.8);opacity:.6}}
@keyframes ui-chr-blink{0%,93%,100%{transform:scaleY(0)}96%{transform:scaleY(1)}}
@keyframes ui-chr-nod-0{40%{transform:rotate(-5deg) translateY(2px)}}
@keyframes ui-chr-nod-1{40%{transform:rotate(5deg) translateY(2px)}}
@keyframes ui-chr-shake{15%,55%{transform:translateX(-7px) rotate(-4deg)}35%,75%{transform:translateX(7px) rotate(4deg)}}
@keyframes ui-chr-hop{0%{transform:translateY(0)}18%{transform:translateY(8px) scaleY(.94)}48%{transform:translateY(-58px)}74%{transform:translateY(4px)}100%{transform:translateY(0)}}
@keyframes ui-chr-hop-shadow{48%{transform:scale(.55);opacity:.35}}
@keyframes ui-chr-boost{0%,12%{opacity:0;transform:scaleY(.2)}30%{opacity:1;transform:scaleY(1.25)}62%{opacity:1;transform:scaleY(.9)}100%{opacity:0;transform:scaleY(.3)}}
@keyframes ui-chr-flicker{50%{transform:scaleY(.7)}}
@keyframes ui-chr-drift{50%{transform:translate(10px,-8px)}}
@keyframes ui-chr-in{from{opacity:0;transform:translateY(36px) scale(.92)}}
.ui-chr{--side:1;--line:color-mix(in srgb,black 80%,var(--accent));--skin:color-mix(in srgb,white 90%,var(--accent));--hoodie:var(--accent);--pack:color-mix(in srgb,var(--ink) 22%,color-mix(in srgb,black 62%,var(--accent)));--hair:color-mix(in srgb,var(--ink) 22%,color-mix(in srgb,black 72%,var(--accent)));--pants:color-mix(in srgb,black 45%,var(--accent));--deck:color-mix(in srgb,var(--ink) 22%,color-mix(in srgb,black 70%,var(--accent)));--lamp:color-mix(in srgb,white 30%,var(--accent-2));--lamp-off:color-mix(in srgb,white 18%,var(--deck));--blush:color-mix(in srgb,var(--danger) 30%,white);--flame:var(--accent-2);--decor:color-mix(in srgb,var(--accent) 45%,transparent);overflow:visible}
.ui-auth-art[data-panel=solid] .ui-chr{--hoodie:color-mix(in srgb,var(--auth-art-ink) 34%,var(--auth-art-bg));--decor:color-mix(in srgb,var(--auth-art-ink) 18%,transparent);--flame:var(--ua-tint)}
:where([data-layout=split-reverse]) .ui-chr{--side:-1}
.ui-chr-line{stroke:var(--line);stroke-width:3;stroke-linejoin:round;stroke-linecap:round}
.ui-chr-fill-skin{fill:var(--skin)}.ui-chr-fill-hoodie{fill:var(--hoodie)}.ui-chr-fill-pack{fill:var(--pack)}.ui-chr-fill-hair{fill:var(--hair)}.ui-chr-fill-pants{fill:var(--pants)}.ui-chr-fill-deck{fill:var(--deck)}.ui-chr-fill-line{fill:var(--line)}
.ui-chr-dots{fill:color-mix(in srgb,black 30%,transparent)}
.ui-chr-shine{fill:white;opacity:.7}
.ui-chr-blush{fill:var(--blush);opacity:.75}
.ui-chr-in{animation:ui-chr-in .9s var(--ua-land) backwards .1s}
.ui-chr-shadow{fill:var(--ua-shadow);transform-box:fill-box;transform-origin:center;animation:ui-chr-pulse 3.2s ease-in-out infinite}
.ui-chr-bob{animation:ui-chr-bob 3.2s ease-in-out infinite}
.ui-chr-par{transform:translate(calc(var(--px,0) * 6px),calc(var(--py,0) * 3px));transition:transform .6s var(--ua-glide)}
.ui-chr-hop,.ui-chr-head,.ui-chr-nod,.ui-chr-turn,.ui-chr-arm,.ui-chr-brow,.ui-chr-flame,.ui-chr-lid{transform-box:view-box}
.ui-chr-head,.ui-chr-nod{transform-origin:200px 200px}
.ui-chr-turn{transition:transform .45s var(--ua-bounce)}
.ui-chr-nod-0{animation:ui-chr-nod-0 .34s var(--ua-glide)}
.ui-chr-nod-1{animation:ui-chr-nod-1 .34s var(--ua-glide)}
.ui-chr-eyes{transform:translate(calc(var(--ex,var(--px,0)) * 6px),calc(var(--ey,var(--py,0)) * 4px));transition:transform .3s var(--ua-glide)}
.ui-auth-art[data-state=typing] .ui-chr-eyes{--ex:calc(var(--side) * 1.1);--ey:.9}
.ui-auth-art[data-state=password] .ui-chr-turn{transform:translateX(calc(var(--side) * -6px)) rotate(calc(var(--side) * -6deg))}
.ui-chr-lid{transform-box:fill-box;transform-origin:50% 0;transform:scaleY(0);animation:ui-chr-blink 4.6s infinite}
.ui-chr-lid rect{fill:var(--skin)}
.ui-auth-art[data-state=password] .ui-chr-lid{animation:none;transform:scaleY(1);transition:transform .18s ease-out}
.ui-chr-brow{transition:transform .35s var(--ua-bounce)}
.ui-auth-art[data-state=error] .ui-chr-brow-l{transform:translateY(3px) rotate(16deg);transform-box:fill-box;transform-origin:center}
.ui-auth-art[data-state=error] .ui-chr-brow-r{transform:translateY(3px) rotate(-16deg);transform-box:fill-box;transform-origin:center}
.ui-auth-art[data-state=success] .ui-chr-brow{transform:translateY(-4px)}
.ui-chr-mouth{opacity:0;transition:opacity .2s linear}
.ui-auth-art:is([data-state=idle],[data-state=typing]) .ui-chr-mouth-smile,.ui-auth-art[data-state=password] .ui-chr-mouth-hush,.ui-auth-art[data-state=error] .ui-chr-mouth-wobble,.ui-auth-art[data-state=success] .ui-chr-mouth-grin{opacity:1}
.ui-chr-sweat{fill:color-mix(in srgb,white 55%,var(--accent-2));opacity:0;transform:translateY(-6px);transition:opacity .2s linear,transform .5s var(--ua-glide)}
.ui-auth-art[data-state=error] .ui-chr-sweat{opacity:1;transform:none}
.ui-chr-arm{transition:transform .5s var(--ua-bounce)}
.ui-chr-arm-l{transform-origin:158px 214px}.ui-chr-arm-r{transform-origin:242px 214px}
.ui-auth-art[data-state=password] .ui-chr-arm-l{transform:rotate(-170deg)}
.ui-auth-art[data-state=password] .ui-chr-arm-r{transform:rotate(170deg)}
.ui-auth-art[data-state=success] .ui-chr-arm-l{transform:rotate(138deg)}
.ui-auth-art[data-state=success] .ui-chr-arm-r{transform:rotate(-138deg)}
.ui-auth-art[data-state=error] .ui-chr-arm-l{transform:rotate(-18deg)}
.ui-auth-art[data-state=error] .ui-chr-arm-r{transform:rotate(18deg)}
.ui-auth-art[data-state=error] .ui-chr-head{animation:ui-chr-shake .6s var(--ua-glide)}
.ui-auth-art[data-state=success] .ui-chr-hop{animation:ui-chr-hop 1s var(--ua-glide) .1s}
.ui-auth-art[data-state=success] .ui-chr-shadow-hop{animation:ui-chr-hop-shadow 1s var(--ua-glide) .1s;transform-box:fill-box;transform-origin:center}
.ui-chr-lamp{fill:var(--lamp-off);transition:opacity .3s linear}
.ui-chr-lamp-on{fill:var(--lamp);opacity:var(--on);transition:opacity .3s linear;transition-delay:calc(var(--i) * 60ms)}
.ui-auth-art[data-state=error] .ui-chr-lamp-on{fill:var(--danger)}
.ui-chr-flame{fill:var(--flame);transform-box:fill-box;transform-origin:50% 0;opacity:0}
.ui-chr-flame-idle{opacity:.55;animation:ui-chr-flicker .5s ease-in-out infinite;transform:scaleY(.55)}
.ui-auth-art[data-state=success] .ui-chr-flame-boost{animation:ui-chr-boost 1.1s var(--ua-glide) .1s}
.ui-chr-decor{display:none;fill:var(--decor)}
.ui-chr-drift{transform-box:fill-box;animation:ui-chr-drift 7s ease-in-out infinite;animation-delay:calc(var(--i) * -2.3s)}
@container art (min-width:24rem){.ui-chr-decor{display:inline}}
.ui-auth-art[data-state=success] .ui-auth-spark{animation-delay:.45s}
@media (prefers-reduced-motion:reduce){
.ui-chr *,.ui-auth-art[data-state] .ui-chr *{animation:none!important;transition:none!important}
.ui-chr-par,.ui-chr-eyes{transform:none}
.ui-chr-flame-idle{transform:scaleY(.55)}
}
`;

/** Lamps along the deck, left to right. */
const LAMPS = Array.from({ length: BOARD_LIGHTS }, (_, i) => 132 + i * 30);

const SPARKS = [
  { dx: "-70px", dy: "-60px", star: true },
  { dx: "60px", dy: "-80px", star: false },
  { dx: "86px", dy: "-20px", star: true },
  { dx: "-90px", dy: "-10px", star: false },
  { dx: "10px", dy: "-104px", star: true },
] as const;

function Arm({ side }: { side: "l" | "r" }) {
  const d = side === "l" ? "M158 216 Q142 244 148 268" : "M242 216 Q258 244 252 268";
  const hand = side === "l" ? { cx: 148, cy: 272 } : { cx: 252, cy: 272 };
  return (
    <g className={`ui-chr-arm ui-chr-arm-${side}`}>
      <path d={d} fill="none" stroke="var(--line)" strokeWidth="25" strokeLinecap="round" />
      <path d={d} fill="none" stroke="var(--hoodie)" strokeWidth="19" strokeLinecap="round" />
      <circle className="ui-chr-fill-skin ui-chr-line" cx={hand.cx} cy={hand.cy} r="10.5" />
    </g>
  );
}

/**
 * A student with a backpack riding a hover board over a pulsing shadow, for the art panel. They bob,
 * blink and follow the pointer; while the form is typed into they look toward it and nod per
 * keystroke, for the password they cover their eyes, on an error they shake their head and on
 * success they hop with a boost. The deck lamps fill with progress and the chest badge carries the
 * active portal's glyph.
 */
export function Character({ state, progress, activeIndex, uid }: AuthVariantProps) {
  const dots = `url(#${uid}-chr-dots)`;
  // The nod sits on its own element, apart from the error head shake, and its class stays on
  // through every state: a CSS animation restarts only when its class changes, so leaving an
  // error does not replay the last nod.
  const tick = keystroke(progress);
  const nod = tick.count > 0 ? `ui-chr-nod ui-chr-nod-${tick.phase}` : "ui-chr-nod";
  const lit = boardLit(state, progress);
  return (
    <>
      <style href="jcsoftdev-ui-auth-character" precedence="default">
        {CSS}
      </style>
      {/* The view box leaves room above the head for the success hop, so it never leaves the frame. */}
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: the wrapper names the illustration or hides it */}
      <svg viewBox="40 8 320 432" focusable="false" className="ui-chr">
        <defs>
          <pattern id={`${uid}-chr-dots`} width="5" height="5" patternUnits="userSpaceOnUse">
            <circle className="ui-chr-dots" cx="2.5" cy="2.5" r="1" />
          </pattern>
        </defs>
        <g className="ui-chr-decor">
          {[
            { x: 84, y: 130, s: 1.2 },
            { x: 312, y: 104, s: 0.8 },
            { x: 318, y: 290, s: 1 },
            { x: 76, y: 300, s: 0.7 },
          ].map((star, i) => (
            <g key={star.x} transform={`translate(${star.x} ${star.y}) scale(${star.s})`}>
              <path
                className="ui-chr-drift"
                style={{ "--i": i } as CSSProperties}
                d="M0 -14 Q2 -2 14 0 Q2 2 0 14 Q-2 2 -14 0 Q-2 -2 0 -14 Z"
              />
            </g>
          ))}
        </g>
        <g className="ui-chr-in">
          <g className="ui-chr-shadow-hop">
            <ellipse className="ui-chr-shadow" cx="200" cy="414" rx="92" ry="11" />
          </g>
          <g className="ui-chr-par">
            <g className="ui-chr-hop">
              <g className="ui-chr-bob">
                {/* board */}
                {[150, 250].map((x) => (
                  <g key={x}>
                    <path
                      className="ui-chr-flame ui-chr-flame-idle"
                      d={`M${x - 8} 360 Q${x} 392 ${x + 8} 360 Z`}
                    />
                    <path
                      className="ui-chr-flame ui-chr-flame-boost"
                      d={`M${x - 11} 360 Q${x - 4} 420 ${x} 432 Q${x + 4} 420 ${x + 11} 360 Z`}
                    />
                    <rect
                      className="ui-chr-fill-deck ui-chr-line"
                      x={x - 14}
                      y="344"
                      width="28"
                      height="18"
                      rx="6"
                    />
                  </g>
                ))}
                <rect
                  className="ui-chr-fill-deck ui-chr-line"
                  x="104"
                  y="326"
                  width="192"
                  height="22"
                  rx="11"
                />
                <rect x="104" y="326" width="192" height="22" rx="11" fill={dots} />
                {LAMPS.map((x, i) => (
                  <g key={x}>
                    <rect className="ui-chr-lamp" x={x} y="334" width="16" height="6" rx="3" />
                    <rect
                      className="ui-chr-lamp-on"
                      style={{ "--i": i, "--on": i < lit ? 1 : 0 } as CSSProperties}
                      x={x}
                      y="334"
                      width="16"
                      height="6"
                      rx="3"
                    />
                  </g>
                ))}
                {/* legs and shoes */}
                <rect
                  className="ui-chr-fill-pants ui-chr-line"
                  x="174"
                  y="276"
                  width="22"
                  height="44"
                  rx="8"
                />
                <rect
                  className="ui-chr-fill-pants ui-chr-line"
                  x="204"
                  y="276"
                  width="22"
                  height="44"
                  rx="8"
                />
                <path
                  className="ui-chr-fill-skin ui-chr-line"
                  d="M170 314 h28 v9 q0 5 -5 5 h-28 q-6 0 -6 -6 q0 -8 11 -8 Z"
                />
                <path
                  className="ui-chr-fill-skin ui-chr-line"
                  d="M230 314 h-28 v9 q0 5 5 5 h28 q6 0 6 -6 q0 -8 -11 -8 Z"
                />
                {/* backpack, body, straps and badge */}
                <rect
                  className="ui-chr-fill-pack ui-chr-line"
                  x="134"
                  y="204"
                  width="132"
                  height="76"
                  rx="24"
                />
                <rect x="134" y="204" width="132" height="76" rx="24" fill={dots} />
                <path
                  className="ui-chr-fill-hoodie ui-chr-line"
                  d="M160 208 Q200 190 240 208 L252 278 Q200 296 148 278 Z"
                />
                <path d="M226 202 Q244 210 252 278 Q240 284 228 286 Z" fill={dots} />
                <path className="ui-chr-line" fill="none" d="M170 206 Q166 236 172 270" />
                <path className="ui-chr-line" fill="none" d="M230 206 Q234 236 228 270" />
                <circle className="ui-chr-fill-skin ui-chr-line" cx="200" cy="246" r="17" />
                <g
                  transform="translate(188 234) scale(.24)"
                  style={
                    {
                      "--glyph-a": "var(--hoodie)",
                      "--glyph-b": "var(--line)",
                      "--glyph-c": "var(--skin)",
                      "--glyph-line": "var(--line)",
                    } as CSSProperties
                  }
                >
                  {PORTAL_GLYPHS[activeIndex] ?? PORTAL_GLYPHS[0]}
                </g>
                {/* head */}
                <g className="ui-chr-head">
                  <g className={nod}>
                    <g className="ui-chr-turn">
                      <circle className="ui-chr-fill-skin ui-chr-line" cx="200" cy="148" r="54" />
                      <path
                        className="ui-chr-fill-hair ui-chr-line"
                        d="M146 146 Q144 92 200 92 Q258 92 254 148 Q240 122 214 120 Q206 132 186 126 Q164 124 146 146 Z"
                      />
                      <path d="M216 96 Q250 104 254 146 Q242 124 220 120 Z" fill={dots} />
                      <circle className="ui-chr-blush" cx="168" cy="172" r="9" />
                      <circle className="ui-chr-blush" cx="232" cy="172" r="9" />
                      <g className="ui-chr-brow ui-chr-brow-l">
                        <path className="ui-chr-line" fill="none" d="M172 136 q10 -6 20 -2" />
                      </g>
                      <g className="ui-chr-brow ui-chr-brow-r">
                        <path className="ui-chr-line" fill="none" d="M208 134 q10 -4 20 2" />
                      </g>
                      <g className="ui-chr-eyes">
                        {[182, 218].map((x) => (
                          <g key={x}>
                            <ellipse className="ui-chr-fill-line" cx={x} cy="156" rx="6" ry="8" />
                            <circle className="ui-chr-shine" cx={x + 2} cy="152" r="2.2" />
                          </g>
                        ))}
                      </g>
                      {[182, 218].map((x) => (
                        <g key={x} className="ui-chr-lid">
                          <rect x={x - 9} y="146" width="18" height="18" />
                          <path className="ui-chr-line" fill="none" d={`M${x - 8} 164 q8 5 16 0`} />
                        </g>
                      ))}
                      <path
                        className="ui-chr-mouth ui-chr-mouth-smile ui-chr-line"
                        fill="none"
                        d="M190 178 q10 8 20 0"
                      />
                      <path
                        className="ui-chr-mouth ui-chr-mouth-hush ui-chr-line"
                        fill="none"
                        d="M194 180 h12"
                      />
                      <path
                        className="ui-chr-mouth ui-chr-mouth-wobble ui-chr-line"
                        fill="none"
                        d="M188 182 q4 -5 8 0 t8 0 t8 0"
                      />
                      <path
                        className="ui-chr-mouth ui-chr-mouth-grin ui-chr-fill-line ui-chr-line"
                        d="M186 174 h28 q0 18 -14 18 q-14 0 -14 -18 Z"
                      />
                      <path
                        className="ui-chr-sweat ui-chr-line"
                        strokeWidth="2"
                        d="M246 118 q8 12 0 16 q-8 -4 0 -16 Z"
                      />
                    </g>
                  </g>
                </g>
                <Arm side="l" />
                <Arm side="r" />
              </g>
            </g>
          </g>
          {state === "success" ? (
            <g transform="translate(200 210)">
              {SPARKS.map((spark) => (
                <g
                  key={`${spark.dx}${spark.dy}`}
                  className="ui-auth-spark"
                  style={{ "--dx": spark.dx, "--dy": spark.dy } as CSSProperties}
                >
                  {spark.star ? (
                    <path
                      d="M0 -9 L2.5 -2.5 L9 0 L2.5 2.5 L0 9 L-2.5 2.5 L-9 0 L-2.5 -2.5 Z"
                      fill="var(--ua-spark-0)"
                      stroke="var(--line)"
                      strokeWidth="1.6"
                    />
                  ) : (
                    <circle r="5" fill="var(--ua-spark-1)" stroke="var(--line)" strokeWidth="1.6" />
                  )}
                </g>
              ))}
            </g>
          ) : null}
        </g>
      </svg>
    </>
  );
}

Character.variant = "character";
