import type { CSSProperties } from "react";
import type { AuthVariantProps } from "../auth-illustration/look.js";
import {
  isoBox,
  isoPoint,
  keystroke,
  STACK_BOOKS,
  STACK_COUNTS,
  type StackBook,
  sparkVectors,
  stackPlaced,
  stackSlots,
  stackTop,
} from "../auth-illustration/model.js";
import { PORTAL_GLYPHS } from "../internal/portal-glyphs.js";

const BASE = { x: 210, y: 350 } as const;
const SLOTS = stackSlots();
const SPARKS = sparkVectors(10).map((spark) => ({ dx: spark.dx * 0.7, dy: spark.dy * 0.7 - 20 }));
const STAR = "M0-9 L2.5-2.5 L9 0 L2.5 2.5 L0 9 L-2.5 2.5 L-9 0 L-2.5-2.5Z";

const CSS = `
@keyframes ui-stk-drop{from{opacity:0;transform:translateY(-140px)}}
@keyframes ui-stk-pulse{50%{opacity:.3}}
@keyframes ui-stk-squash-0{40%{transform:scale(1.012,.975)}}
@keyframes ui-stk-squash-1{40%{transform:scale(1.012,.975)}}
@keyframes ui-stk-wobble{18%{transform:translateX(calc(var(--i) * -5px))}42%{transform:translateX(calc(var(--i) * 4px))}66%{transform:translateX(calc(var(--i) * -2px))}84%{transform:translateX(calc(var(--i) * 1px))}}
@keyframes ui-stk-rise{from{opacity:0;transform:scaleY(0)}}
@keyframes ui-stk-unfurl{from{transform:scaleX(0)}}
@keyframes ui-stk-wave{50%{transform:skewY(-5deg) scaleX(.94)}}
.ui-stk{--n:4;--shift:22px;scale:1.28;transform-origin:50% 88%;--stk-paper:color-mix(in srgb,white 90%,var(--accent));--stk-line:color-mix(in srgb,black 22%,transparent)}
.ui-auth-art[data-panel=solid] .ui-stk{--stk-paper:color-mix(in srgb,white 84%,var(--auth-art-bg))}
.ui-stk-book{--on:var(--on4);--next:var(--next4)}
.ui-stk-flag{--fx:var(--fx4);--fy:var(--fy4);transform:translate(calc(var(--fx) * 1px),calc(var(--fy) * 1px))}
.ui-stk-book[data-i="4"],.ui-stk-book[data-i="5"]{display:none}
@container art (min-width:24rem){.ui-stk{--n:5;--shift:10px;scale:1.12}.ui-stk-book{--on:var(--on5);--next:var(--next5)}.ui-stk-flag{--fx:var(--fx5);--fy:var(--fy5)}.ui-stk-book[data-i="4"]{display:inline}}
@container art (min-width:34rem){.ui-stk{--n:6;--shift:0px;scale:1}.ui-stk-book{--on:var(--on6);--next:var(--next6)}.ui-stk-flag{--fx:var(--fx6);--fy:var(--fy6)}.ui-stk-book[data-i="5"]{display:inline}}
.ui-stk-tower{transform:translateY(var(--shift))}
.ui-stk-par{transform:translate(calc(var(--px,0) * var(--i) * 2.5px),calc(var(--py,0) * var(--i) * 1px));transition:transform .6s var(--ua-glide)}
.ui-stk-flag-par{transform:translate(calc(var(--px,0) * (var(--n) - 1) * 2.5px),calc(var(--py,0) * (var(--n) - 1) * 1px));transition:transform .6s var(--ua-glide)}
.ui-stk-drop{transform:translateY(calc((1 - var(--on)) * -130px));opacity:var(--on);transition:transform .75s var(--ua-bounce),opacity .3s linear;transition-delay:calc(var(--i) * 40ms)}
.ui-stk-enter{animation:ui-stk-drop .8s var(--ua-land) backwards;animation-delay:calc(.1s + var(--i) * .09s)}
.ui-stk-ghost-wrap{opacity:var(--next);transition:opacity .3s linear}
.ui-stk-ghost{fill:none;stroke:var(--ua-edge);stroke-opacity:.5;stroke-width:1.6;stroke-dasharray:5 6;animation:ui-stk-pulse 2.4s ease-in-out infinite;animation-delay:calc(var(--i) * -.3s)}
.ui-stk-squash{transform-box:fill-box;transform-origin:50% 100%}
.ui-stk-squash-0{animation:ui-stk-squash-0 .28s var(--ua-glide)}
.ui-stk-squash-1{animation:ui-stk-squash-1 .28s var(--ua-glide)}
.ui-auth-art[data-state=error] .ui-stk-wob{animation:ui-stk-wobble .75s var(--ua-glide)}
.ui-stk-tone-0{--cover:var(--accent);--ribbon:var(--ink)}
.ui-stk-tone-1{--cover:color-mix(in srgb,var(--ink) 86%,var(--surface));--ribbon:var(--accent)}
.ui-stk-tone-2{--cover:var(--surface)}
.ui-stk-tone-3{--cover:var(--accent-2);--ribbon:var(--accent)}
.ui-auth-art[data-panel=solid] .ui-stk-tone-0{--cover:var(--auth-art-ink);--ribbon:var(--ua-tint)}
.ui-auth-art[data-panel=solid] .ui-stk-tone-1{--cover:var(--ua-tint)}
.ui-auth-art[data-panel=solid] .ui-stk-tone-2{--cover:var(--ua-mid)}
.ui-auth-art[data-panel=solid] .ui-stk-tone-3{--cover:color-mix(in srgb,var(--auth-art-ink) 55%,var(--auth-art-bg));--ribbon:var(--ua-tint)}
.ui-stk-book{--spine:color-mix(in srgb,var(--cover) 80%,black);--side:color-mix(in srgb,var(--cover) 64%,black)}
.ui-stk-cover{fill:var(--cover)}
.ui-stk-spine{fill:var(--spine)}
.ui-stk-cover-side{fill:var(--side)}
.ui-stk-pages{fill:var(--stk-paper)}
.ui-stk-line{fill:none;stroke:var(--stk-line);stroke-width:1}
.ui-stk-band{fill:none;stroke:color-mix(in srgb,var(--cover) 45%,white);stroke-width:2.2}
.ui-stk-label{fill:color-mix(in srgb,var(--stk-paper) 88%,var(--cover));stroke:var(--stk-edge,var(--ua-edge));stroke-width:1.2}
.ui-stk-inset{fill:none;stroke:color-mix(in srgb,var(--ua-edge) 20%,transparent);stroke-width:1.5}
.ui-stk-ribbon{fill:var(--ribbon,var(--accent))}
.ui-stk-edge{stroke:var(--stk-edge,var(--ua-edge));stroke-width:2;stroke-linejoin:round}
.ui-auth-art[data-state=error] .ui-stk-book{--stk-edge:color-mix(in srgb,var(--danger) 70%,var(--ua-edge))}
.ui-stk-dot{fill:color-mix(in srgb,black 28%,transparent)}
.ui-stk-shadow{fill:var(--ua-shadow)}
.ui-stk-flag{--glyph-a:var(--surface);--glyph-b:var(--ink);--glyph-c:var(--accent);--glyph-line:var(--accent);--cloth:var(--accent)}
.ui-auth-art[data-panel=solid] .ui-stk-flag{--glyph-a:var(--auth-art-bg);--glyph-b:var(--auth-art-bg);--glyph-c:var(--auth-art-ink);--glyph-line:var(--auth-art-ink);--cloth:var(--auth-art-ink)}
.ui-stk-pole{fill:none;stroke:var(--ua-edge);stroke-width:3;stroke-linecap:round;transform-box:fill-box;transform-origin:50% 100%;animation:ui-stk-rise .45s .4s var(--ua-bounce) backwards}
.ui-stk-knob{fill:var(--cloth);transform-box:fill-box;transform-origin:center;animation:ui-stk-rise .3s .8s var(--ua-bounce) backwards}
.ui-stk-cloth{fill:var(--cloth)}
.ui-stk-banner{transform-box:fill-box;transform-origin:0 50%;animation:ui-stk-unfurl .5s .7s var(--ua-bounce) backwards,ui-stk-wave 1.8s 1.3s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){
.ui-stk-enter,.ui-stk-ghost,.ui-stk-pole,.ui-stk-knob,.ui-stk-banner,.ui-auth-art[data-state] .ui-stk-wob,.ui-stk-squash-0,.ui-stk-squash-1{animation:none}
.ui-stk-drop,.ui-stk-ghost-wrap{transition:none}
.ui-stk-par,.ui-stk-flag-par{transform:none;transition:none}
}
`;

const polygon = (points: readonly { x: number; y: number }[]) =>
  `M${points.map((p) => `${p.x} ${p.y}`).join("L")}Z`;

/** Cover boards, page lines, spine bands and the title label of one book. */
function bookDetails({ w, d, h }: StackBook) {
  const [u0, u1, v0, v1] = [-w / 2, w / 2, -d / 2, d / 2];
  const board = Math.min(4, h / 5);
  const count = Math.max(2, Math.round(h / 7));
  const lines = Array.from({ length: count }, (_, k) => {
    const z = board + ((k + 1) * (h - board * 2)) / (count + 1);
    const a = isoPoint(u1, v0 + 4, z);
    const b = isoPoint(u1, v1 - 4, z);
    return `M${a.x} ${a.y}L${b.x} ${b.y}`;
  }).join("");
  const pages = polygon([
    isoPoint(u1, v0 + 3, h - board),
    isoPoint(u1, v1 - 3, h - board),
    isoPoint(u1, v1 - 3, board),
    isoPoint(u1, v0 + 3, board),
  ]);
  const bands = [u0 + 16, u1 - 16]
    .map((u) => {
      const a = isoPoint(u, v1, h - 3);
      const b = isoPoint(u, v1, 3);
      return `M${a.x} ${a.y}L${b.x} ${b.y}`;
    })
    .join("");
  const label = polygon([
    isoPoint(-w / 5, v1, h * 0.7),
    isoPoint(w / 5, v1, h * 0.7),
    isoPoint(w / 5, v1, h * 0.3),
    isoPoint(-w / 5, v1, h * 0.3),
  ]);
  const inset = polygon([
    isoPoint(u0 + 9, v0 + 9, h),
    isoPoint(u1 - 9, v0 + 9, h),
    isoPoint(u1 - 9, v1 - 9, h),
    isoPoint(u0 + 9, v1 - 9, h),
  ]);
  const ribbon = polygon([
    isoPoint(u1, v0 + 18, h),
    isoPoint(u1, v0 + 28, h),
    isoPoint(u1, v0 + 28, -14),
    isoPoint(u1, v0 + 23, -9),
    isoPoint(u1, v0 + 18, -14),
  ]);
  return { pages, lines, bands, label, inset, ribbon };
}

const SHAPES = STACK_BOOKS.map((book) => ({
  ...isoBox(book.w, book.d, book.h),
  ...bookDetails(book),
}));

/** An isometric tower of books that gains a book as the form fills and plants a flag on success. */
export function Stack({ state, progress, activeIndex, uid }: AuthVariantProps) {
  const dots = `url(#${uid}-stack-dots)`;
  const tick = keystroke(progress);
  const typing = (state === "typing" || state === "password") && tick.count > 0;
  const placed = Object.fromEntries(
    STACK_COUNTS.map((count) => [count, stackPlaced(state, progress, count)]),
  );
  const flag = Object.fromEntries(
    STACK_COUNTS.flatMap((count) => {
      const top = stackTop(count);
      return [
        [`--fx${count}`, top.x],
        [`--fy${count}`, top.y],
      ];
    }),
  );
  const foundation = STACK_BOOKS[0] as StackBook;
  const shadow = isoBox(foundation.w + 34, foundation.d + 34, 0).top;
  return (
    <>
      <style href="jcsoftdev-ui-auth-stack" precedence="default">
        {CSS}
      </style>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: the wrapper names the illustration or hides it */}
      <svg viewBox="0 30 420 450" focusable="false" className="ui-stk">
        <defs>
          <pattern id={`${uid}-stack-dots`} width="4.5" height="4.5" patternUnits="userSpaceOnUse">
            <circle className="ui-stk-dot" cx="2.25" cy="2.25" r="0.9" />
          </pattern>
        </defs>
        <g transform={`translate(${BASE.x} ${BASE.y})`}>
          <g className="ui-stk-tower">
            <path className="ui-stk-shadow" d={shadow} transform="translate(14 16)" />
            <g className={typing ? `ui-stk-squash ui-stk-squash-${tick.phase}` : "ui-stk-squash"}>
              {STACK_BOOKS.map((book, i) => {
                const shape = SHAPES[i];
                const slot = SLOTS[i];
                if (!shape || !slot) return null;
                const vars = {
                  "--i": i,
                  ...Object.fromEntries(
                    STACK_COUNTS.flatMap((count) => [
                      [`--on${count}`, i < (placed[count] ?? 0) ? 1 : 0],
                      [`--next${count}`, i === placed[count] ? 1 : 0],
                    ]),
                  ),
                } as CSSProperties;
                return (
                  <g
                    // biome-ignore lint/suspicious/noArrayIndexKey: the books are a fixed list
                    key={i}
                    className={`ui-stk-book ui-stk-tone-${book.tone}`}
                    data-i={i}
                    style={vars}
                    transform={`translate(${slot.x} ${slot.y})`}
                  >
                    <g className="ui-stk-ghost-wrap">
                      <path className="ui-stk-ghost" d={shape.top} />
                    </g>
                    <g className="ui-stk-par">
                      <g className="ui-stk-drop">
                        <g className="ui-stk-enter">
                          <g className="ui-stk-wob">
                            <path className="ui-stk-spine ui-stk-edge" d={shape.left} />
                            <path d={shape.left} fill={dots} />
                            <path className="ui-stk-band" d={shape.bands} />
                            <path className="ui-stk-label" d={shape.label} />
                            <path className="ui-stk-cover-side ui-stk-edge" d={shape.right} />
                            <path className="ui-stk-pages" d={shape.pages} />
                            <path className="ui-stk-line" d={shape.lines} />
                            {book.tone === 0 || book.tone === 3 ? (
                              <path className="ui-stk-ribbon ui-stk-edge" d={shape.ribbon} />
                            ) : null}
                            <path className="ui-stk-cover ui-stk-edge" d={shape.top} />
                            <path className="ui-stk-inset" d={shape.inset} />
                          </g>
                        </g>
                      </g>
                    </g>
                  </g>
                );
              })}
            </g>
            <g className="ui-stk-flag" style={flag as CSSProperties}>
              {state === "success" ? (
                <>
                  <g className="ui-stk-flag-par">
                    <path className="ui-stk-pole" d="M0 0V-78" />
                    <g className="ui-stk-banner-wrap" transform="translate(0 -76)">
                      <g className="ui-stk-banner">
                        <path className="ui-stk-cloth ui-stk-edge" d="M0 0H62L50 17L62 34H0Z" />
                        <g transform="translate(9 4) scale(.27)">
                          {PORTAL_GLYPHS[activeIndex] ?? null}
                        </g>
                      </g>
                    </g>
                    <circle className="ui-stk-knob ui-stk-edge" cy="-80" r="4" />
                  </g>
                  <g transform="translate(0 -60)">
                    {SPARKS.map((spark, n) => (
                      <path
                        key={`${spark.dx}:${spark.dy}`}
                        className="ui-auth-spark"
                        d={n % 2 ? STAR : "M-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0"}
                        style={
                          { "--dx": `${spark.dx}px`, "--dy": `${spark.dy}px` } as CSSProperties
                        }
                      />
                    ))}
                  </g>
                </>
              ) : null}
            </g>
          </g>
        </g>
      </svg>
    </>
  );
}

Stack.variant = "stack";
