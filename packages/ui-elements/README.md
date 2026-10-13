# @jcsoftdev/ui-elements

The jcsoftdev UI kit as native custom elements: no framework, no Tailwind. Styles are precompiled
per component from `@jcsoftdev/ui-tokens`, and behaviour comes from `@jcsoftdev/ui-core`. Each
element is its own entry, so a page pays only for the elements it registers.

```js
import "@jcsoftdev/ui-tokens/styles/tokens.css"; // design tokens (or your createTheme output)
import { defineButton } from "@jcsoftdev/ui-elements/button";
import { defineCheckbox } from "@jcsoftdev/ui-elements/checkbox";

defineButton(); // <ui-button>
defineCheckbox({ prefix: "acme" }); // <acme-checkbox>
```

`define()` from the package root registers every element at once.

| Entry | Elements | DOM |
| --- | --- | --- |
| `./button` | `ui-button` (`type="submit|reset|button"`, `variant`, `size`, `loading`) | shadow |
| `./input` | `ui-input` (wraps a native `<input>`) | shadow |
| `./checkbox` | `ui-checkbox` (`checked`, `indeterminate`, `required`) | shadow |
| `./switch` | `ui-switch` | shadow |
| `./radio-group` | `ui-radio-group` + `ui-radio`, arrow keys with selection-follows-focus | light + shadow |

The form controls are form-associated: they submit with their `name`, take part in `reset`,
`disabled` fieldsets and constraint validation (`required`), and expose their role and state to
assistive technology through `ElementInternals`.

## Liquid Glass

`material="liquid"` (and `lens`, `liquid-preset`, `liquid-refraction`, `liquid-frost`,
`liquid-profile`, `liquid-dispersion`, `liquid-specular`, `liquid-motion`) on `ui-button` turns it into the
same Liquid Glass as the React kit. Nothing liquid ships with an element: the material code is
fetched with `import()` the first time a surface asks for it, and the engine then loads only the
features the resolved configuration needs (see `@jcsoftdev/ui-core`). `lens="off"` keeps the frosted
material without the refraction engine.

## CSS

Each component's stylesheet is also published as plain CSS under `@jcsoftdev/ui-elements/css/*`
for inspection or overriding. Component variables are prefixed `--ui-*`; everything else is a token
from `@jcsoftdev/ui-tokens`.
