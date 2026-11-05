# @jcsoftdev/ui

Token-driven React 19 component library with zero runtime dependencies, built on Tailwind CSS v4. The whole look comes from one tokens JSON file, with runtime presets (`data-style`, `data-density`, `data-radius`, `data-accent`, `data-theme`).

```bash
pnpm add @jcsoftdev/ui
```

- Docs, Storybook and LLM-readable index: https://ui.jcsoftdev.com
- Package README (install, CSS import, theming, subpath exports): [packages/ui/README.md](packages/ui/README.md)
- npm: https://www.npmjs.com/package/@jcsoftdev/ui

## Repository layout

| Path | What |
| --- | --- |
| [`packages/ui`](packages/ui/README.md) | `@jcsoftdev/ui`: the React 19 component library (with Storybook). |
| [`packages/ui-tokens`](packages/ui-tokens/README.md) | `@jcsoftdev/ui-tokens`: design tokens, generated CSS and the WCAG AA theme generator. |
| [`packages/ui-core`](packages/ui-core/README.md) | `@jcsoftdev/ui-core`: framework-agnostic behaviour (focus, roving focus, popper, dismiss layers). |
| [`packages/ui-elements`](packages/ui-elements/README.md) | `@jcsoftdev/ui-elements`: the kit as native `ui-*` custom elements. |
| [`packages/ui-compose`](packages/ui-compose/README.md) | Compose Multiplatform kit (Kotlin, Gradle). Versioned and released separately from the npm packages. |
| `site` | Astro + Starlight landing and docs, generated from the library source. Deployed as a container to ui.jcsoftdev.com ([site/README.md](site/README.md)). |
| [`docs`](docs/README.md) | Architecture decisions ([ADR 0001](docs/adr/0001-package-split.md)) and contributing guides. |
| [`odd`](docs/README.md#feature-planning-notes) | Feature planning notes (`odd/tasks`). |
| `deploy/site.compose.yml` | Compose file for the site image (`ghcr.io/jcsoftdev/ui-site`). |

## Development

Requires Node 22 and pnpm 9.

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm build                 # library
pnpm build:site            # docs site (needs the library built first)
pnpm --filter @jcsoftdev/ui storybook
```

## Releasing

The npm packages (`ui-tokens`, `ui-core`, `ui-elements`, `ui`) share one version. Bump it in all four `packages/*/package.json`, commit, then push a tag `v<version>`. The `release` workflow runs `scripts/release-plan.mjs`, which fails if the versions diverge or the tag does not match, then lints, tests and builds, and publishes the packages listed in `.github/publish-packages.json` (currently `packages/ui` only) to npm with provenance. Versions already on the registry are skipped, so a failed run can be re-run. See [ADR 0001](docs/adr/0001-package-split.md).

`ui-compose` is released on its own: bump `VERSION_NAME` in `packages/ui-compose/gradle.properties` and push a tag `ui-compose-v<version>`.

## License

MIT (c) 2026 jcsoftdev
