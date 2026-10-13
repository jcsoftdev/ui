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
