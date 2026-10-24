/**
 * Rules of the motion entry. Every duration and easing comes from `--motion-duration` and
 * `--motion-ease`, so a theme that shortens them (or makes them linear) restyles all motion.
 * Enter and leave animate only `opacity` and `transform`; the row pulse animates a background
 * colour, which repaints but never lays out. Hidden states use `opacity`, never `visibility` or
 * `display`, so assistive tech reads the content while it animates.
 *
 * React 19 hoists and dedupes `<style href precedence>`, so every component can render this and
 * the rules are injected once, also in server HTML.
 */
const D = "var(--motion-duration,180ms)";
const E = "var(--motion-ease,cubic-bezier(.2,.8,.2,1))";

const CSS = `
@keyframes ui-motion-enter{from{opacity:0;transform:translate3d(0,var(--ui-motion-rise,6px),0)}}
@keyframes ui-motion-leave{to{opacity:0}}
@keyframes ui-motion-pulse-a{from{background-color:var(--ui-motion-highlight)}}
@keyframes ui-motion-pulse-b{from{background-color:var(--ui-motion-highlight)}}
[data-motion-stagger]{--ui-motion-step:min(calc(${D} / 4),calc(var(--ui-motion-span,calc(${D} * 1.5)) / var(--ui-motion-n,1)))}
[data-motion=wait]{opacity:0}
[data-motion=wait]:focus-within{opacity:1}
[data-motion=enter]{animation:ui-motion-enter ${D} ${E} backwards;animation-delay:calc(var(--ui-motion-delay,0ms) + var(--ui-motion-i,0) * var(--ui-motion-step,0ms))}
[data-motion-swap]{position:relative}
[data-motion-swap]>[data-motion=enter]{--ui-motion-rise:4px}
[data-motion-swap]>[data-motion-leave]{position:absolute;inset:0 0 auto;pointer-events:none;animation:ui-motion-leave ${D} ${E} forwards}
[data-motion-pulse]{--ui-motion-highlight:color-mix(in srgb,var(--accent,currentColor) 24%,transparent)}
[data-motion-pulse=a]:not(tr),tr[data-motion-pulse=a]>*{animation:ui-motion-pulse-a calc(${D} * 1.6) ${E}}
[data-motion-pulse=b]:not(tr),tr[data-motion-pulse=b]>*{animation:ui-motion-pulse-b calc(${D} * 1.6) ${E}}
.ui-count{font-variant-numeric:tabular-nums}
.ui-count-run{display:inline-grid;justify-items:end}
.ui-count-run>*{grid-area:1/1}
.ui-count-run>:first-child{visibility:hidden}
.ui-motion-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){
[data-motion]{animation:none!important;opacity:1!important}
[data-motion-swap]>[data-motion-leave]{display:none}
[data-motion-pulse]:not(tr),tr[data-motion-pulse]>*{animation:none!important}
}
`;

export function MotionStyles() {
  return (
    <style href="jcsoftdev-ui-motion" precedence="default">
      {CSS}
    </style>
  );
}
