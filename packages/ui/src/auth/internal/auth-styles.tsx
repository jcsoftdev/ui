/**
 * Rules of the sign-in illustration. Every colour is derived from the theme tokens with `color-mix`,
 * so dark mode and every `data-accent` apply without extra code. React 19 hoists and dedupes
 * `<style href precedence>`, so rendering this from several components injects the rules once.
 */
const CSS = `
@keyframes ui-auth-drop{from{opacity:0;transform:translateY(-160px)}}
@keyframes ui-auth-bob{50%{transform:translateY(-7px)}}
@keyframes ui-auth-spark{0%{opacity:1;transform:scale(.4) rotate(0)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.2) rotate(90deg)}}
@keyframes ui-auth-shake{20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}
@keyframes ui-auth-rise{from{opacity:0;transform:translateY(18px)}}
.ui-auth-art{--ua-edge:color-mix(in srgb,var(--ink) 88%,var(--surface));--ua-spring:var(--motion-ease,cubic-bezier(.2,.8,.2,1))}
.ui-auth-art svg{display:block;width:100%;height:auto;overflow:visible}
.ui-auth-art[data-state=error] svg{animation:ui-auth-shake .5s var(--ua-spring)}
.ui-auth-slab-tone-0{--top:var(--accent);--glyph-a:var(--surface);--glyph-b:var(--ink);--glyph-c:var(--accent);--dots:color-mix(in srgb,black 30%,transparent)}
.ui-auth-slab-tone-1{--top:var(--surface);--glyph-a:var(--accent);--glyph-b:var(--ink);--glyph-c:var(--surface);--dots:color-mix(in srgb,black 30%,transparent)}
.ui-auth-slab-tone-2{--top:color-mix(in srgb,var(--ink) 86%,var(--surface));--glyph-a:var(--accent);--glyph-b:var(--surface);--glyph-c:var(--surface);--dots:color-mix(in srgb,white 20%,transparent)}
.ui-auth-slab{--left:color-mix(in srgb,var(--top) 82%,black);--right:color-mix(in srgb,var(--top) 66%,black)}
.ui-auth-art[data-state=error] .ui-auth-slab{--edge:color-mix(in srgb,var(--danger) 70%,var(--ua-edge))}
.ui-auth-enter{animation:ui-auth-drop .9s var(--ua-spring) backwards;animation-delay:calc(var(--i) * .14s)}
.ui-auth-pos{transform:translate(calc(var(--x) * 1px),calc(var(--y) * 1px));transition:transform .85s var(--ua-spring)}
.ui-auth-lift{transform:translateY(calc(var(--lift) * -1px));transition:transform .85s var(--ua-spring)}
.ui-auth-bob{animation:ui-auth-bob 4.6s ease-in-out infinite;animation-delay:calc(var(--i) * -1.4s)}
.ui-auth-face-top{fill:var(--top)}
.ui-auth-face-left{fill:var(--left)}
.ui-auth-face-right{fill:var(--right)}
.ui-auth-edge{stroke:var(--edge,var(--ua-edge));stroke-width:2.2;stroke-linejoin:round}
.ui-auth-dots{fill:var(--dots)}
.ui-auth-shadow{fill:color-mix(in srgb,var(--ink) 16%,transparent)}
.ui-auth-inlay{fill:none;stroke:color-mix(in srgb,var(--ink) 14%,transparent);stroke-width:2}
.ui-auth-g{stroke-width:3;stroke-linejoin:round;stroke:var(--glyph-b)}
.ui-auth-ga{fill:var(--glyph-a)}
.ui-auth-gc{fill:var(--glyph-c)}
.ui-auth-gline{fill:none}
.ui-auth-spark{fill:var(--accent);opacity:0;transform-box:view-box;animation:ui-auth-spark 1s cubic-bezier(.1,.7,.3,1) forwards}
.ui-auth-spark:nth-child(3n+1){fill:var(--ink)}
@media (prefers-reduced-motion:reduce){
.ui-auth-art[data-state=error] svg,.ui-auth-enter,.ui-auth-bob,.ui-auth-spark{animation:none}
.ui-auth-pos{transform:translate(calc(var(--x0) * 1px),calc(var(--y0) * 1px));transition:none}
.ui-auth-lift{transform:none;transition:none}
}
`;

export function AuthStyles() {
  return (
    <style href="jcsoftdev-ui-auth-styles" precedence="default">
      {CSS}
    </style>
  );
}
