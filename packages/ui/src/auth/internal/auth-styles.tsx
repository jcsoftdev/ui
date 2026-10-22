/**
 * Rules of the sign-in illustration. Every colour is derived from the theme tokens with `color-mix`,
 * so dark mode and every `data-accent` apply without extra code. React 19 hoists and dedupes
 * `<style href precedence>`, so rendering this from several components injects the rules once.
 */
const CSS = `
@keyframes ui-auth-drop{0%{opacity:0;transform:translateY(-180px)}45%{opacity:1}}
@keyframes ui-auth-shadow-in{from{opacity:0;transform:scale(.35)}}
@keyframes ui-auth-bob{50%{transform:translateY(-7px)}}
@keyframes ui-auth-hop-0{40%{transform:translateY(-11px)}}
@keyframes ui-auth-hop-1{40%{transform:translateY(-11px)}}
@keyframes ui-auth-cheer{35%{transform:translateY(-18px)}70%{transform:translateY(3px)}}
@keyframes ui-auth-spark{0%{opacity:0;transform:scale(.3) rotate(0)}12%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.1) rotate(120deg)}}
@keyframes ui-auth-shake{20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}
@keyframes ui-auth-rise{from{opacity:0;transform:translateY(18px)}}
.ui-auth-rise{animation:ui-auth-rise .7s .25s var(--motion-ease,cubic-bezier(.2,.7,.2,1)) backwards}
.ui-auth-art{--ua-edge:color-mix(in srgb,var(--ink) 88%,var(--surface));--ua-shadow:color-mix(in srgb,black 14%,transparent);--ua-spark-a:var(--accent);--ua-spark-b:var(--ink);--ua-bounce:cubic-bezier(.34,1.5,.5,1);--ua-land:cubic-bezier(.2,.9,.25,1.15);--ua-glide:cubic-bezier(.2,.7,.2,1)}
.ui-auth-art[data-panel=solid]{--ua-edge:var(--auth-art-ink);--ua-tint:color-mix(in srgb,var(--auth-art-bg) 22%,white);--ua-mid:color-mix(in srgb,var(--auth-art-ink) 30%,var(--auth-art-bg));--ua-shadow:color-mix(in srgb,var(--auth-art-ink) 22%,transparent);--ua-spark-a:var(--auth-art-ink);--ua-spark-b:var(--ua-tint)}
.ui-auth-art svg{display:block;width:100%;height:auto;overflow:visible}
.ui-auth-art[data-state=error] svg{animation:ui-auth-shake .5s var(--ua-glide)}
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
.ui-auth-g{stroke-width:3;stroke-linejoin:round;stroke:var(--glyph-b)}
.ui-auth-ga{fill:var(--glyph-a)}
.ui-auth-gc{fill:var(--glyph-c)}
.ui-auth-gline{fill:none}
.ui-auth-spark{fill:var(--ua-spark-a);opacity:0;transform-box:fill-box;transform-origin:center;animation:ui-auth-spark 1s .75s cubic-bezier(.1,.7,.3,1) both}
.ui-auth-spark:nth-child(3n+1),g:nth-child(3n+1)>.ui-auth-spark{fill:var(--ua-spark-b)}
@media (prefers-reduced-motion:reduce){
.ui-auth-art[data-state=error] svg,.ui-auth-enter,.ui-auth-bob,.ui-auth-art[data-state] .ui-auth-hop,.ui-auth-hop-0,.ui-auth-hop-1,.ui-auth-spark,.ui-auth-shadow{animation:none}
.ui-auth-pos{transform:translate(calc(var(--x0) * 1px),calc(var(--y0) * 1px));transition:none}
.ui-auth-lift,.ui-auth-par{transform:none;transition:none}
.ui-auth-shadow{opacity:1;transition:none}
}
`;

export function AuthStyles() {
  return (
    <style href="jcsoftdev-ui-auth-styles" precedence="default">
      {CSS}
    </style>
  );
}
