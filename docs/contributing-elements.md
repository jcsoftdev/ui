# Adding a `ui-*` element

How a new component lands in `@jcsoftdev/ui-elements` (and, when it needs one, a behaviour in
`@jcsoftdev/ui-core`). Every element is its own entry, discovered from its folder, so a batch of
elements never edits a shared list and parallel batches do not conflict.

## 1. Scaffold

```sh
pnpm --filter @jcsoftdev/ui-elements new <name> [--light] [--form] [--material]
```

- `<name>` is kebab-case: `date-picker` becomes `<ui-date-picker>`, `defineDatePicker()`, the entry
  `@jcsoftdev/ui-elements/date-picker` and the class `UiDatePicker`.
- Default is a **shadow-DOM leaf**: the host is the control, and role and state go through
  `ElementInternals`. Use `--light` for a **light-DOM composite** whose parts are children
  (`ui-tabs`, `ui-dialog`). Composites style themselves with `[data-ui="<name>"]` selectors adopted
  into the root node.
- `--form` builds on `FormElement` (`src/internal/form.ts`). It provides `name`, `value`, `disabled`
  (including from a disabled fieldset), `required`, validity, reset and state restore. You implement
  `render()` and call `commit(value)` on a user change. Override `validate()` for more rules.
  Checkbox-like controls extend `ToggleElement` instead.
- `--material` adds `material="liquid"` support (see section 6).

The scaffold writes four files:

| File | What goes in it |
| --- | --- |
| `src/<name>/<name>.ts` | the element and `define<Name>()`, the only required export |
| `src/<name>/<name>.css` | component CSS, compiled at build to `<name>.css.ts` (generated, not committed) and `dist/css/<name>.css` |
| `src/<name>/size.json` | `{ "maxGzip": null }`, the size budget |
| `test/<name>.browser.test.ts` | Chromium tests |

Nothing else needs registering. These all pick up the new folder automatically:

- the `./*` export pattern (`dist/<name>/<name>.js`);
- the generated `src/index.ts` (`define()` registers everything);
- `check:size`, `check:treeshake`, `check:pack` and the SSR test.

Sub-parts go in the same file and are registered by the same `define<Name>()`, for example
`defineTabs()` also registers `ui-tab`, `ui-tab-list` and `ui-tab-panel`. Find them with
`isPart(element, "tab")`, so a custom prefix keeps working. Code shared by several elements goes in
`src/internal/` and is never an entry.

## 2. Rules for the element

- **SSR-safe.** Extend `ElementBase` and touch no DOM at module scope. `define*()` is a no-op without
  `customElements`.
- **Native first.** Use `<dialog>.showModal()`, the Popover API (`popover`, `popovertarget`), Invoker
  Commands (`onCommand(host, cb)` from `internal/base.ts`, which includes a polyfill), `inert`, and
  form association. Fall back to ui-core (`focus`, `dismiss`) through a dynamic `import()`, so
  engines with native support never download the fallback.
- **Behaviour comes from `@jcsoftdev/ui-core`.** Use `roving`, `focus`, `dismiss`, `popper`,
  `typeahead` and `state`. A behaviour that does not exist yet is added to ui-core first, in its own
  batch, as a framework-free function that returns a cleanup. It gets unit tests and its own
  subpath export.
- **CSS only from tokens.** Every `var(--x)` must be a token in `@jcsoftdev/ui-tokens`
  `styles/tokens.css` or a component variable `--ui-<name>-*`; the build fails otherwise. Port the
  look from the React kit's Tailwind classes. Use `data-*` and attribute selectors, never classes a
  consumer might reuse.
- **Pay for what you use.** Variants are attributes styled by the element's own CSS. Optional
  features (liquid, heavy sub-features, fallbacks, locale data) are dynamic imports. An element
  entry must never statically import another element's entry. Share through `src/internal/`.
- **Events** bubble and are composed: `emit(host, "change", detail)`. Use the native names (`input`,
  `change`, `open`, `close`, `cancel` is cancelable). Public methods mirror native ones (`show()`,
  `close()`, `checkValidity()`).
- Document the element in a JSDoc block on the class: what it is, its ARIA pattern, attributes,
  events. That block is the API reference.

## 3. Accessibility checklist

- [ ] Role and accessible name are correct in the **real AX tree**: `ax(role, name)` in tests reads
      Chromium's tree over CDP. Playwright's `getByRole` does not see `ElementInternals` roles.
- [ ] Every state is exposed: checked, selected, expanded, disabled, invalid, required, busy,
      orientation.
- [ ] The keyboard follows the WAI-ARIA APG pattern: Tab order, one tab stop for composites (roving),
      arrows, Home/End, Enter/Space, Escape for overlays and typeahead where the pattern has it.
- [ ] Focus is visible (`:focus-visible` with the `--focus-ring-*` tokens). Overlays move focus in and
      return it to the opener on close.
- [ ] Ids for `aria-labelledby`, `-describedby` and `-controls` come from `ensureId()`, and
      references stay in one root.
- [ ] Motion respects `prefers-reduced-motion`, and the colour pairs come from tokens that pass AA.
- [ ] Touch targets keep the token sizes (`--control-height*`).

## 4. Tests

Chromium (vitest browser, `test/*.browser.test.ts`) is the default, because custom elements need a
real engine. Follow the existing files:

- `mount(html)` and `ax(role, name)` from `test/setup.ts`. Call `define<Name>()` in `beforeAll` and
  clear `document.body` in `afterEach`.
- Cover the ARIA output, the keyboard, form participation (`FormData`, `form.reset()`, a disabled
  fieldset, `required`) for form elements, the events, and a custom prefix.
- Pure logic (layout math, parsers) goes in `@jcsoftdev/ui-core` with node unit tests. When a React
  implementation exists, test against it value for value, as `ui-core/test/liquid.test.ts` does.
- Run, from `packages/ui-elements`: `pnpm lint`, `pnpm typecheck`, `pnpm test` (build plus SSR),
  `pnpm test:browser`, `pnpm check:treeshake` and `pnpm check:pack`. Then run `pnpm check:size` from
  the repository root.

## 5. Size budget

After `pnpm build`, run `node scripts/check-size.mjs` from the repository root. A new element fails
with `no budget yet; measured N B, set "maxGzip": M`. Put `M` in `src/<name>/size.json`; it is the
measured size plus 5%, rounded up to 50 B. A later increase needs a reason in the PR. The budget
measures the eager graph: the entry plus its static imports. Lazy chunks are free until they are
used.

`check:treeshake` asserts, for every element:

- it exports `define<Name>()` and has a `size.json`;
- no liquid module loads eagerly;
- it pulls in no other element's entry.

## 6. Liquid opt-in

An element whose surface can be Liquid Glass (buttons, cards, overlays, bars):

```ts
static observedAttributes = [...MATERIAL_ATTRIBUTES];
readonly #material = new Material(this, () => surfaceElement, () => this.shadowRoot ?? undefined);
connectedCallback() { this.#material.sync(); }
disconnectedCallback() { this.#material.stop(); }
attributeChangedCallback(name) { if (MATERIAL_ATTRIBUTES.includes(name)) this.#material.sync(); }
```

- `material="liquid" | "liquid-clear"`, `lens="off"`, `liquid-preset`, `liquid-refraction`,
  `liquid-frost`, `liquid-profile`, `liquid-dispersion`, `liquid-specular`, `liquid-motion`,
  `liquid-interactive` and `liquid-radius` are handled for you.
- `Material` imports `internal/liquid.js` only when `material` starts with `liquid`. That module
  adopts the liquid CSS (generated from ui-tokens) and calls ui-core's `attachLiquid`, which loads
  only the engine features the resolved configuration needs.
- Pass the shadow root as the layer root when the surface is the host of a shadow tree, as
  `ui-button` does, so the crystal layer renders inside it.
- Non-liquid use stays free: test that a solid element fetches nothing
  (`test/material.browser.test.ts`).

## 7. Commit

Use one Conventional Commit per work unit, with its tests: `feat(ui-elements): add ui-<name>`. A new
core behaviour is `feat(ui-core): add <behaviour>`. Add no AI attribution.
