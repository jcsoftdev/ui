---
title: "@jcsoftdev/ui-core"
description: Framework-agnostic behaviour primitives (focus, roving focus, popper, dismiss, typeahead, controllable state and the Liquid Glass engine) as plain functions over DOM elements.
section: Packages
---

`@jcsoftdev/ui-core` is the logic behind the React kit's primitives, extracted as plain functions over DOM elements. It has zero runtime dependencies, is ESM only, declares `sideEffects: false`, and touches nothing at import time, so it is safe to import during SSR. Every function that attaches behaviour returns its cleanup.

It is also the behaviour layer of [`@jcsoftdev/ui-elements`](/docs/packages/ui-elements).

## Install

```sh
pnpm add @jcsoftdev/ui-core
```

## Entries

Each entry is its own subpath, so you bundle only what you import.

| Entry                          | What it does                                                       |
| ------------------------------ | ------------------------------------------------------------------ |
| `@jcsoftdev/ui-core/focus`     | `createFocusScope` (move in, trap Tab, return focus), `getTabbables` |
| `@jcsoftdev/ui-core/roving`    | `createRovingFocus` (one tab stop, arrow keys), `getRovingIntent`  |
| `@jcsoftdev/ui-core/popper`    | `computePlacement` (flip, shift, arrow; pure), `autoPosition`      |
| `@jcsoftdev/ui-core/dismiss`   | `createDismissLayer` (Escape, outside press/focus, stacking)       |
| `@jcsoftdev/ui-core/typeahead` | `createTypeahead`, `nextTypeaheadIndex`                            |
| `@jcsoftdev/ui-core/state`     | `createControllable` (controlled/uncontrolled value)               |

## Usage

Trap focus in a panel and dismiss it on Escape or an outside press:

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

## Liquid Glass

`@jcsoftdev/ui-core/liquid` is the framework-neutral Liquid Glass engine. `attachLiquid` writes the `--liquid-*` variables at once and lazily imports the lens, specular, motion and dispersion tiers the resolved configuration needs, so you pay only for what you use. The README lists the gzip cost of each tier. For the theming side see [Liquid Glass](/docs/glass).

```ts
import { attachLiquid } from "@jcsoftdev/ui-core/liquid";
import { crystal } from "@jcsoftdev/ui-core/liquid/presets/crystal";

const stop = attachLiquid(surface, { preset: crystal, radius: 28 });
// later: stop() restores the element
```

## Reference

Full entry list, the Liquid tier table and options: [packages/ui-core on GitHub](https://github.com/jcsoftdev/ui/tree/main/packages/ui-core).
