# ADR 0001: Split the library into lockstep-versioned packages

- Status: accepted (user decision, 2026-10-12)
- Scope: phases P0-P2 (tokens, theme engine, release plumbing). `ui-core` and `ui-elements` follow.

## Context

`@jcsoftdev/ui` is a single React 19 + Tailwind v4 package. Its design tokens (`tokens/default.json`,
generated `styles/*.css`, `Theme.kt`, the `ui-theme` CLI) are already framework-neutral and are consumed by
the Compose kit (`packages/ui-compose`) and by the site. We want a framework-agnostic layer (custom elements
for vanilla users, shared behaviour for React) and a runtime theme generator, without breaking 0.2.x consumers.

## Decision

Four packages, one version number (lockstep), zero runtime dependencies each:

| Package | Contents | Depends on |
| --- | --- | --- |
| `@jcsoftdev/ui-tokens` | token JSON, generated CSS (`tokens.css`, `theme.css`, `tailwind.css`, `fonts.css`, `Theme.kt`), `ui-theme` CLI, `createTheme` / `toCss` / `applyTheme` | nothing |
| `@jcsoftdev/ui-core` (later) | framework-agnostic behaviour: focus management, roving focus, popper geometry, dismiss layers, state machines | nothing |
| `@jcsoftdev/ui-elements` (later) | `ui-*` custom elements (button, input, checkbox, switch, radio-group, dialog, popover, tooltip, tabs, toast) with per-component precompiled CSS | ui-core, ui-tokens |
| `@jcsoftdev/ui` | React components, rebuilt incrementally on core; keeps exporting `styles/*`, `tokens/*` and the `ui-theme` bin | react (peer) |

Rules:

1. **Back-compat.** `@jcsoftdev/ui` still ships `styles/*`, `tokens/*` and `bin/ui-theme.mjs` at the same paths
   with byte-identical CSS. `ui-tokens` is a *dev* dependency (`workspace:^`); a build step
   (`scripts/sync-tokens.mjs`) copies the assets in and bundles the CLI, so installing `@jcsoftdev/ui` pulls no
   extra package and "zero runtime dependencies" holds.
2. **Shadow DOM for leaf controls, light DOM for composites.** Leaves (button, input, checkbox, switch) own their
   styling and benefit from encapsulation. Composites (tabs, dialog content, toast region) must let authors put
   arbitrary content and ARIA relationships across children, which shadow roots make hard (see facts below).
3. **`ui-` tag prefix**, with `define(customTag)` so apps can rename or register under a different prefix and
   avoid collisions.
4. **Theme API v1**: `createTheme({ brand, accent?, neutral?, danger?, contrast: "AA" })`. WCAG 2 contrast
   ratios are guaranteed (4.5:1 text, 3:1 UI components); APCA is out of scope.
5. **Per-component precompiled CSS** for vanilla users (no Tailwind build step required). Component-level
   variables follow `--ui-<component>-<prop>` and default to semantic tokens.
6. **Native first.** Use `<dialog>.showModal()`, the Popover API and `inert` where supported; JS fallback otherwise.
7. **Size budgets** are enforced in CI (`check:size`, gzip, per entry).
8. **Release.** One `v<version>` tag publishes every enabled package in dependency order (see Release).

## Alternatives considered

- **Keep one package with subpath exports.** Simplest, but vanilla users would install React peer metadata,
  Compose/Kotlin tooling keeps living inside the React package, and size/semver pressure of one package affects all.
- **Independent versioning (changesets).** Less lockstep churn, but a token change that affects every renderer
  would need coordinated bumps and a compatibility matrix. Lockstep keeps "same version = compatible".
- **Make `@jcsoftdev/ui` depend on `ui-tokens` at runtime.** Re-exporting through a dependency breaks the
  zero-dependency promise and changes install trees for 0.2.x users; copying at build avoids both.
- **Shadow DOM everywhere / light DOM everywhere.** Everywhere-shadow breaks cross-boundary ARIA and form
  association for composites; light-only gives no style isolation for leaves and forces Tailwind or global CSS.
- **APCA instead of WCAG 2.** More perceptually accurate, but WCAG 2 is what legal/audit requirements reference today.

## Verified platform facts (checked 2026-10-12)

Sources are MDN and the WHATWG HTML spec unless stated. Baseline labels are read from MDN's Baseline banner.

### 1. Cross-shadow-root ARIA references

- **ID-reference attributes** (`aria-labelledby`, `aria-describedby`, `for`, `aria-controls`, ...) only resolve inside
  the *same* tree. MDN: "Attribute element references can only refer to other elements that are in the same DOM or
  Shadow DOM, because element ids are only valid in the scope in which they are declared."
- **Element reflection properties** (`ariaLabelledByElements`, `ariaDescribedByElements`, `ariaControlsElements`,
  `ariaActiveDescendantElement`, ...) are asymmetric:
  - From inside a shadow root to an element in an **ancestor / outer** tree: works.
  - From the light DOM (or an ancestor tree) to an element inside a **descendant** shadow root: does **not** work;
    the getter drops it. MDN: "Properties that reflect ARIA element references can target elements in the same
    scope or a parent scope. Elements in nested scopes are not accessible."
  - WHATWG HTML ("reflecting content attributes in IDL attributes" / attr-associated elements): an explicitly set
    element is only returned if it is a descendant of one of the reflecting element's shadow-including ancestors.
- `ariaLabelledByElements` is Baseline 2025 (newly available, since April 2025).
- **Reference Target** (`shadowrootreferencetarget` / `ShadowRoot.referenceTarget`) lets a host forward ID references
  that point at the host (`label for`, `aria-labelledby`, `popovertarget`, `commandfor`) to one inner element.
  Blink intent thread (2026-06-23) targets Chrome 151 after an origin trial in 133-135; Gecko has a positive
  position, WebKit no public commitment. Shipping status in stable was **not confirmed**; do not depend on it.
- **Consequence for the design:** leaf controls with a shadow root may *reach out* to labels in the outer tree via
  reflection properties (or `ElementInternals` + form association), but outer content cannot reference their
  internals. That is why composites, whose children must be referenced by ID from outside, stay in light DOM,
  and why leaf controls expose `label`/`aria-*` attributes on the host instead of relying on `for`.

Sources:
- https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Reflected_attributes
- https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaLabelledByElements
- https://html.spec.whatwg.org/multipage/common-dom-interfaces.html#reflecting-content-attributes-in-idl-attributes
- https://groups.google.com/a/chromium.org/g/Blink-dev/c/eBx3sXIfJnw (Reference Target intent; secondary source)

### 2. Declarative Shadow DOM, Popover, `:state()` and friends

| Feature | Status (MDN Baseline) |
| --- | --- |
| `<template>` | Widely available (Nov 2015) |
| `shadowrootdelegatesfocus` / `ShadowRoot.delegatesFocus` | Widely available (Nov 2021) |
| `Element.setHTMLUnsafe` (parses declarative shadow roots) | Newly available (Sep 2025) |
| Popover API (`popover`, `popovertarget`, `showPopover()`) | Newly available (Jan 2025) |
| `:state()` / `ElementInternals.states` (`CustomStateSet`) | Newly available (May 2024) |
| `<dialog>` + `showModal()` | Widely available (Mar 2022) |
| `inert` | Widely available (Apr 2023) |

Not verified (treat as unsupported until checked): a Baseline label for `shadowrootmode` itself,
`shadowrootclonable`, `shadowrootserializable`, `parseHTMLUnsafe`, and `closedby` / `requestClose()` on dialogs.

**Consequences:** `delegatesFocus` is safe to use for leaf controls. Popover, `:state()` and `setHTMLUnsafe` are
"newly available", so elements must feature-detect (`HTMLElement.prototype.hasOwnProperty("popover")`,
`CSS.supports("selector(:state(x))")`) and keep a `data-*`/attribute-based styling fallback and a JS popover fallback.
`<dialog>`/`inert` need no fallback for the evergreen target. SSR of shadow-DOM leaves via declarative shadow DOM
is an opt-in enhancement, not a requirement.

Sources:
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template
- https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/delegatesFocus
- https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTMLUnsafe
- https://developer.mozilla.org/en-US/docs/Web/API/Popover_API
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/:state
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/showModal
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert

## Release design (lockstep, multi-package)

- All public packages share one version; `scripts/release-plan.mjs` fails if they diverge or if the `v<version>`
  tag does not match.
- `.github/publish-packages.json` lists the packages that the `release` workflow publishes, in dependency order.
  It currently contains only `packages/ui`, so the workflow behaves exactly as before. A package is added to the
  list **after** its trusted publisher is configured on npmjs.com (npm OIDC trusted publishing is per package name:
  repository `jcsoftdev/ui`, workflow `release.yml`).
- Each package is packed with `pnpm pack` (which rewrites `workspace:` specifiers) and published with
  `npm publish <tarball> --provenance --access public`. Versions already on the registry are skipped, so a
  failed run can be re-run.

## Consequences

- Positive: framework-neutral tokens reused by web, Compose and vanilla elements; runtime theming with contrast
  guarantees; 0.2.x consumers unaffected.
- Negative: more packages to version and publish; the `ui` package keeps a build-time copy of token assets;
  new package names need one-time npm trusted-publisher setup by the maintainer.
