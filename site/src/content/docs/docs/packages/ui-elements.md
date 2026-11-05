---
title: "@jcsoftdev/ui-elements"
description: The kit as native custom elements, with no framework and no Tailwind. One entry per element, precompiled styles from the design tokens, behaviour from ui-core.
section: Packages
---

`@jcsoftdev/ui-elements` is the jcsoftdev UI kit as native custom elements: no framework, no Tailwind. Styles are precompiled per component from `@jcsoftdev/ui-tokens`, and behaviour comes from [`@jcsoftdev/ui-core`](/docs/packages/ui-core). Each element is its own entry, so a page pays only for the elements it registers.

Use it when the page is not a React app. In React, use [`@jcsoftdev/ui`](/docs/getting-started) instead.

## Install

```sh
pnpm add @jcsoftdev/ui-elements
```

The elements read the design tokens, so load `@jcsoftdev/ui-tokens/styles/tokens.css` (or your own [`createTheme`](/docs/theming/theme-generator) output).

## Usage

```js
import "@jcsoftdev/ui-tokens/styles/tokens.css"; // design tokens (or your createTheme output)
import { defineButton } from "@jcsoftdev/ui-elements/button";
import { defineCheckbox } from "@jcsoftdev/ui-elements/checkbox";

defineButton(); // <ui-button>
defineCheckbox({ prefix: "acme" }); // <acme-checkbox>
```

`define()` from the package root registers every element at once.

## Elements

| Entry           | Elements                                                                  |
| --------------- | ------------------------------------------------------------------------- |
| `./button`      | `ui-button`                                                               |
| `./input`       | `ui-input` (wraps a native `<input>`)                                     |
| `./checkbox`    | `ui-checkbox`                                                             |
| `./switch`      | `ui-switch`                                                               |
| `./radio-group` | `ui-radio-group` + `ui-radio`                                             |
| `./dialog`      | `ui-dialog` on native `<dialog>.showModal()`                              |
| `./popover`     | `ui-popover` on the Popover API                                           |
| `./tooltip`     | `ui-tooltip for="id"`                                                     |
| `./tabs`        | `ui-tabs` + `ui-tab-list`, `ui-tab`, `ui-tab-panel`                       |
| `./toast`       | `ui-toaster` live region + `toast()`, `toast.success`, `toast.error`      |

The form controls are form-associated: they submit with their `name`, take part in `reset`, `disabled` fieldsets and constraint validation, and expose their role and state through `ElementInternals`. Attributes, DOM mode (shadow or light) and the Liquid Glass attributes (`material="liquid"`, `lens`, ...) are in the README.

## Reference

Attribute tables and CSS entries (`@jcsoftdev/ui-elements/css/*`): [packages/ui-elements on GitHub](https://github.com/jcsoftdev/ui/tree/main/packages/ui-elements). Accessibility notes shared with the React kit are in [Accessibility](/docs/accessibility).
