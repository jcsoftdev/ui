# Crystal lens: degrade gracefully when the surface is near the edge of its backdrop

## Objective
The crystal lens must not paint a hard rectangular region when the backdrop around the surface is smaller than
the room the lens needs. Fix it at the root, in the glass module of `@jcsoftdev/ui`, not in the site layout.

## Problem (verified in Chromium, 2026-11-04)
On the landing `LiquidShowcase`, the "Crystal lens" pill sits at the right edge of `.show-stage`. The crystal
profile samples the backdrop up to about 268 px away (`feDisplacementMap` scale about 537) through a layer
larger than the surface (`packages/ui/src/glass/refraction.ts`, layer sizing near the `if (crystal)` sync
block). `backdropRoom()` leaves only 12-24 px of room on the right (layer inset `132px 24px 192px 264px`)
while `crystalMargin()` asks for about 264 px. Samples beyond the available backdrop return nothing, which draws
a hard rectangular boundary inside the rounded pill.

Ruled out: the layer `clip-path` is correct (matches the pill, round 36 px); removing `overflow: clip` on
`.show-stage` changes nothing. With the stage unclipped the same area samples the white page behind the photo,
which confirms the lens reads far outside the pill.

## Scope
- In: `packages/ui/src/glass/` (refraction, displacement map, helpers), its tests, the glass docs if behavior
  is documented, `CHANGELOG.md`.
- Out: site layout workarounds, other glass profiles unless the same defect exists, Compose kit parity (note it
  as a follow-up if the Compose lens has the same limit).

## Constraints
- Worktree `../ui-wt-crystal`, branch `fix/crystal-lens-edge-room` from `main` (b2b8fcd2). The main checkout has
  unrelated dirty work; do not touch it.
- Fix at the root: when per-side room is smaller than the margin the lens needs, the displacement must adapt
  (for example, clamp or rescale the amplitude per side so no sample falls outside the available backdrop)
  instead of cutting off. Interior look must stay unchanged when room is sufficient.
- Artifacts in English. Conventional Commits, no AI attribution.

## Resolved settings
- TDD: off (user global override). Tests are written after the change, in the same work unit.
- Runner: `pnpm --filter @jcsoftdev/ui` scripts: `node --test` for `test/*.test.mjs` (for example
  `test/glass-refraction.test.mjs`) and `vitest run --project glass` for `src/glass/glass.browser.test.tsx`.
- Builds: authorized in this worktree only (`pnpm --filter @jcsoftdev/ui build`, `dist` is gitignored).
- Delivery strategy: ask-on-risk. Planning heuristic only: about 400 authored changed lines per task.

## Reproduction
`pnpm --filter @jcsoftdev/ui build`, then run `astro dev` from `site/` WITHOUT the `predev` script (it runs
`sync:tokens`) on a port leased from port-registry, open `/`, section "Liquid Glass", pill "Crystal lens"
(`.show-pill` with that text, lens layer `[data-glass-lens-layer]`).

## Tasks
- [x] T1 Root fix in `refraction.ts` (and helpers): adapt crystal displacement to the room available per side.
      Verify in the browser that the rectangular boundary is gone at the stage edge and unchanged in the middle.
- [x] T2 Regression tests that fail without the fix (per-side room smaller than margin) and pass with it; changelog.

## Authorized scope
`packages/ui/src/glass/**`, `packages/ui/test/**` for glass, `packages/ui/CHANGELOG.md`, docs that describe the
lens limits, this file. No push, no PR.

## Acceptance criteria
- At the stage edge there is no hard rectangular region inside the pill; refraction fades or rescales smoothly.
- With ample room the output is unchanged (existing glass tests still pass).
- New regression test fails on the old code and passes on the new.

## Routing
Delegated writer, deep tier (design decision with unknown interactions in the displacement math). Trigger
evidence: fix spans refraction, displacement map, helpers and tests (2+ non-trivial files).

## Progress
- 2026-11-04: root cause verified, worktree created. No source written yet.
- 2026-11-04: T1+T2 done in `fa21cc3d` (`fix(ui): adapt the crystal lens to the backdrop room per side`).
  Refined root cause: `computeCrystalField` already clamped each sample into the room, but a hard clamp pins
  every sample past the room to the edge, smearing one backdrop column over a band of the surface with a crease
  where the clamp starts (the visible hard boundary). Fix: each side whose room is below the margin keeps only
  the share of the offset that lands its silhouette inside the room, eased (smoothstep) across the surface
  per axis; the hard clamp remains as a backstop and only bites in the clipped margin.

## Verification evidence
- `node --test test/glass-refraction.test.mjs`: 22/22 pass; the new smear test fails on the old source
  (21 pass, 1 fail) and passes on the new.
- `liquid.test.mjs` 8/8, `liquid-options.test.mjs` 10/10, `liquid-spring.test.mjs` 6/6;
  `vitest run --project glass`: 199/199.
- `pnpm lint`: 0 errors, 10 warnings (same 10 on the base); `pnpm typecheck`: clean.
- Byte identity: hashes of 60 maps (5 shapes x 3 refractions x 2 dispersions, unbounded and full room) are
  equal before and after. Sweep of 1080 bounded rooms: minimum Jacobian determinant 0.29 (no fold).
- Chromium (dev server, landing "Crystal lens" pill, room right 24 px): the streaked band with a hard edge on
  the right half is gone; the pill moved to the stage middle shows the plain minified lens.

## Next step
Optional: same limit check for the Compose kit lens (follow-up, out of scope). Review and delivery are the user's.
