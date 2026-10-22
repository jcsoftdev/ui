/**
 * Rules every look shares (the `.ui-auth-art` wrapper, the portal glyphs, the spark burst, the error shake).
 * Each look carries the rest of its own rules, so an app only ships the looks it renders. Every colour is derived from the theme tokens with `color-mix`,
 * so dark mode and every `data-accent` apply without extra code. React 19 hoists and dedupes
 * `<style href precedence>`, so rendering this from several components injects the rules once.
 *
 * Only the look's root `<svg>` (a direct child of `.ui-auth-art`) is sized and shaken here: icons
 * nested inside a look, like the statement's arrow, keep their own size and motion.
 */
const CSS = `
@keyframes ui-auth-spark{0%{opacity:0;transform:scale(.3) rotate(0)}12%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1.1) rotate(120deg)}}
@keyframes ui-auth-shake{20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}
@keyframes ui-auth-rise{from{opacity:0;transform:translateY(18px)}}
.ui-auth-rise{animation:ui-auth-rise .7s .25s var(--motion-ease,cubic-bezier(.2,.7,.2,1)) backwards}
.ui-auth-art{--ua-edge:color-mix(in srgb,var(--ink) 88%,var(--surface));--ua-shadow:color-mix(in srgb,black 14%,transparent);--ua-spark-0:var(--accent);--ua-spark-1:var(--accent-2);--ua-spark-2:var(--accent-soft);--ua-spark-3:var(--ink);--ua-bounce:cubic-bezier(.34,1.5,.5,1);--ua-land:cubic-bezier(.2,.9,.25,1.15);--ua-glide:cubic-bezier(.2,.7,.2,1)}
.ui-auth-art[data-panel=solid]{--ua-edge:var(--auth-art-ink);--ua-tint:color-mix(in srgb,var(--auth-art-bg) 22%,white);--ua-mid:color-mix(in srgb,var(--auth-art-ink) 30%,var(--auth-art-bg));--ua-shadow:color-mix(in srgb,var(--auth-art-ink) 22%,transparent);--ua-spark-0:var(--auth-art-ink);--ua-spark-1:var(--ua-tint);--ua-spark-2:color-mix(in srgb,var(--auth-art-ink) 55%,var(--auth-art-bg));--ua-spark-3:var(--auth-art-ink)}
.ui-auth-art>svg{display:block;width:100%;height:auto;max-height:var(--auth-art-max-h,none);overflow:visible}
.ui-auth-art[data-state=error]>svg{animation:ui-auth-shake .5s var(--ua-glide)}
.ui-auth-g{stroke-width:3;stroke-linejoin:round;stroke:var(--glyph-b)}
.ui-auth-ga{fill:var(--glyph-a)}
.ui-auth-gc{fill:var(--glyph-c)}
.ui-auth-gline{fill:none}
.ui-auth-spark{fill:var(--ua-spark-0);opacity:0;transform-box:fill-box;transform-origin:center;animation:ui-auth-spark 1s .75s cubic-bezier(.1,.7,.3,1) both}
.ui-auth-spark[data-tone="1"]{fill:var(--ua-spark-1)}
.ui-auth-spark[data-tone="2"]{fill:var(--ua-spark-2)}
.ui-auth-spark[data-tone="3"]{fill:var(--ua-spark-3)}
@media (prefers-reduced-motion:reduce){
.ui-auth-rise,.ui-auth-art[data-state=error]>svg{animation:none}
.ui-auth-spark{animation:none;opacity:1;transform:translate(calc(var(--dx) * .62),calc(var(--dy) * .62))}
}
`;

export function AuthStyles() {
  return (
    <style href="jcsoftdev-ui-auth-styles" precedence="default">
      {CSS}
    </style>
  );
}
