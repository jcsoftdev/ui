"use client";

import type { CSSProperties, ReactNode } from "react";
import { useUiStrings } from "../../i18n/index.js";
import type { AuthVariantProps } from "../auth-illustration/look.js";

const CSS = `
@keyframes ui-stm-shake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
@keyframes ui-stm-pop{40%{transform:scale(1.06)}}
.ui-stm{--stm-ink:var(--ink);--stm-soft:color-mix(in srgb,var(--ink) 66%,transparent);--stm-track:color-mix(in srgb,var(--accent) 26%,transparent);--stm-fill:var(--accent);--stm-goal:color-mix(in srgb,var(--ink) 10%,var(--surface));--stm-goal-arrow:color-mix(in srgb,var(--ink) 50%,var(--surface));--stm-knob:var(--ink);--stm-arrow:var(--surface);display:grid;gap:clamp(14px,4cqi,28px);justify-items:start;padding-block:clamp(8px,4cqi,32px);text-align:start;font-family:var(--font-sans)}
.ui-auth-art[data-panel=solid] .ui-stm{--stm-ink:var(--auth-art-ink);--stm-soft:var(--auth-art-ink);--stm-track:color-mix(in srgb,var(--auth-art-ink) 22%,transparent);--stm-fill:var(--auth-art-ink);--stm-goal:color-mix(in srgb,var(--auth-art-ink) 32%,var(--auth-art-bg));--stm-goal-arrow:var(--auth-art-ink);--stm-knob:var(--auth-art-bg);--stm-arrow:var(--auth-art-ink)}
.ui-stm-lines{display:grid;margin:0;color:var(--stm-ink);font-size:clamp(30px,12.5cqi,92px);font-weight:var(--text-page-title--font-weight,800);letter-spacing:-.035em;line-height:.98;text-wrap:balance}
.ui-stm-line{grid-area:1/1}
.ui-stm-mask{display:inline-block;overflow:clip;padding-bottom:.08em;vertical-align:top}
.ui-stm-word{display:inline-block;transform:translateY(0);transition:transform .7s cubic-bezier(.2,.8,.2,1);transition-delay:calc(var(--i) * 55ms)}
.ui-stm-line[data-line=done] .ui-stm-word{transform:translateY(140%)}
.ui-auth-art[data-state=success] .ui-stm-line[data-line=main] .ui-stm-word{transform:translateY(-140%);transition-delay:calc(var(--i) * 40ms)}
.ui-auth-art[data-state=success] .ui-stm-line[data-line=done] .ui-stm-word{transform:translateY(0);transition-delay:calc(.25s + var(--i) * 70ms)}
.ui-stm-enter .ui-stm-word{animation:ui-stm-rise .8s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(.1s + var(--i) * 70ms)}
@keyframes ui-stm-rise{from{transform:translateY(140%)}}
.ui-stm-caption{margin:0;max-width:34ch;color:var(--stm-soft);font-size:clamp(14px,3.6cqi,19px);line-height:1.45}
.ui-stm-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.ui-stm-pill{font-size:clamp(15px,4.4cqi,26px);--pad:.3em;--knob:2.1em;position:relative;display:block;overflow:hidden;width:clamp(140px,40cqi,260px);height:calc(var(--knob) + var(--pad) * 2);border-radius:999px;background:var(--stm-track)}
.ui-stm-fill{position:absolute;inset:0;border-radius:inherit;background:var(--stm-fill);transform:scaleX(var(--p));transform-origin:0 50%;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.ui-stm-knob{position:absolute;top:var(--pad);right:var(--pad);display:grid;place-items:center;width:var(--knob);height:var(--knob);border-radius:999px;background:var(--stm-knob);color:var(--stm-goal-arrow);isolation:isolate}
.ui-stm-knob::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--stm-goal);transition:opacity .35s linear}
.ui-stm-pill[data-ready] .ui-stm-knob{color:var(--stm-arrow)}
.ui-stm-pill[data-ready] .ui-stm-knob::before{opacity:0}
.ui-stm-knob svg{width:46%;height:46%}
.ui-auth-art[data-state=success] .ui-stm-pill{animation:ui-stm-pop .5s cubic-bezier(.34,1.5,.5,1) .35s}
.ui-auth-art[data-state=error] .ui-stm-pill{animation:ui-stm-shake .5s cubic-bezier(.2,.7,.2,1)}
.ui-auth-art[data-state=error] .ui-stm-fill{background:var(--danger)}
@media (prefers-reduced-motion:reduce){
.ui-stm *,.ui-auth-art[data-state] .ui-stm *{animation:none!important;transition:none!important}
}
`;

function Words({
  text,
  line,
  hidden,
}: {
  text: ReactNode;
  line: "main" | "done";
  /** The line is visually gone, so it is gone for assistive technology too. */
  hidden: boolean;
}) {
  const words = typeof text === "string" ? text.split(/\s+/).filter(Boolean) : [text];
  return (
    <span className="ui-stm-line" data-line={line} aria-hidden={hidden || undefined}>
      {words.map((word, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: words repeat, their order is their identity
        <span key={i}>
          <span className="ui-stm-mask">
            <span className="ui-stm-word" style={{ "--i": i } as CSSProperties}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

/**
 * Kinetic type in the spirit of a product statement: the headline rises word by word and gives way
 * to a short "signed in" line on success. Under it a pill is a progress meter, not a control: it
 * fills toward the arrow at its end as the form fills, the arrow turns solid once the form is
 * complete, and the pill pops on success. The text is real content, so this look is not hidden from assistive
 * technology; `headline`, `caption` and `action` come from `AuthIllustration`.
 */
export function Statement({ state, progress, headline, caption, action }: AuthVariantProps) {
  const strings = useUiStrings();
  const signedIn = state === "success";
  const p = signedIn ? 1 : progress;
  return (
    <div className="ui-stm">
      <style href="jcsoftdev-ui-auth-statement" precedence="default">
        {CSS}
      </style>
      <p className="ui-stm-lines ui-stm-enter">
        <Words text={headline ?? strings.welcomeBack} line="main" hidden={signedIn} />
        <Words text={strings.signedIn} line="done" hidden={!signedIn} />
      </p>
      {caption != null ? (
        <p
          className="ui-stm-caption"
          aria-hidden={signedIn || undefined}
          style={signedIn ? { visibility: "hidden" } : undefined}
        >
          {caption}
        </p>
      ) : null}
      <div className="ui-stm-row">
        <span
          className="ui-stm-pill"
          aria-hidden="true"
          data-ready={p >= 1 || undefined}
          style={{ "--p": p } as CSSProperties}
        >
          <span className="ui-stm-fill" />
          <span className="ui-stm-knob">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              aria-hidden="true"
            >
              <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </span>
        {action}
      </div>
    </div>
  );
}

Statement.variant = "statement";
Statement.text = true;
