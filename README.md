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
| `packages/ui` | The published `@jcsoftdev/ui` library (with Storybook). |
| `site` | Astro + Starlight landing and docs, generated from the library source. Deployed as a container to ui.jcsoftdev.com. |
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

Bump the version in `packages/ui/package.json`, commit, then push a tag `v<version>`. The `release` workflow verifies the tag matches the package version and publishes to npm with provenance.

## License

MIT (c) 2026 jcsoftdev
