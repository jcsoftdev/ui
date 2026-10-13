# @jcsoftdev/ui-core

Framework-agnostic behaviour for the jcsoftdev UI platform: the logic behind the React kit's
primitives, as plain functions over DOM elements. Zero runtime dependencies, ESM only,
`sideEffects: false`, and nothing touches the DOM at import time (safe to import during SSR).

| Entry | What it does |
| --- | --- |
| `@jcsoftdev/ui-core/focus` | `createFocusScope` (move in, trap Tab, return focus), `getTabbables` |
| `@jcsoftdev/ui-core/roving` | `createRovingFocus` (one tab stop, arrow keys), `getRovingIntent` |
| `@jcsoftdev/ui-core/popper` | `computePlacement` (flip, shift, arrow; pure), `autoPosition` |
| `@jcsoftdev/ui-core/dismiss` | `createDismissLayer` (Escape, outside press/focus, stacking) |
| `@jcsoftdev/ui-core/typeahead` | `createTypeahead`, `nextTypeaheadIndex` |
| `@jcsoftdev/ui-core/state` | `createControllable` (controlled/uncontrolled value) |

Every function that attaches behaviour returns its cleanup.

## Liquid Glass, per feature

The Liquid Glass engine of the React kit, framework-neutral and split so a consumer pays only for
what it uses. `attachLiquid` writes the `--liquid-*` variables at once and imports the rest lazily,
from the resolved configuration (options, scope and theme alike):

| Tier | Loaded when | gzip (eager) |
| --- | --- | --- |
| base frosted material | always (`attachLiquid`, options, support probe) | ~2.8 kB |
| + refraction lens | the surface can refract (Chromium, no reduced transparency/contrast/motion) | +5.0 kB |
| + specular rim light | resolved `specular.intensity` > 0 (the default) | +1.4 kB |
| + motion (springs) | resolved `motion` is not `false` (the default) | +2.9 kB |
| + dispersion | resolved `dispersion` > 0 on a surface up to 100,000 px² | +0.3 kB |
| + crystal lens | resolved `profile` is `crystal` | +2.7 kB |

```ts
import { attachLiquid } from "@jcsoftdev/ui-core/liquid";
import { crystal } from "@jcsoftdev/ui-core/liquid/presets/crystal";

const stop = attachLiquid(surface, { preset: crystal, radius: 28 });
// later: stop() restores the element
```

The surface needs the liquid material CSS (shipped by `@jcsoftdev/ui-elements`, or the React
kit's `liquid` utilities); pass `auto: true` to follow its `--glass-lens` flag. `lens: false`
keeps the base frosted material only. Presets (`clear`, `regular`, `thick`, `crystal`) are data
modules. The maths, the filter graph and the parameters are the React kit's (pinned by parity
tests that run both engines side by side).

```ts
import { createDismissLayer } from "@jcsoftdev/ui-core/dismiss";
import { createFocusScope } from "@jcsoftdev/ui-core/focus";

const release = createFocusScope(panel);
const stop = createDismissLayer(panel, { onDismiss: () => close() });
function close() {
  stop();
  release();
}
```

MIT, by jcsoftdev.
