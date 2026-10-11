# Icon source

`svg/` holds the SVG sources of every icon the library ships. They are vendored unchanged from
[Lucide](https://lucide.dev) (`lucide-react` 1.53.0, ISC license, see `LICENSE-lucide`).
`aliases.json` maps legacy Lucide names (e.g. `AlertTriangle`) to the canonical icon file.

The React components in `src/icons/` are generated from this directory:

```sh
node scripts/build-icons.mjs
```

This directory is the single source of truth for other targets (the Compose kit generates its
`ImageVector`s from the same files). To add an icon, drop its Lucide SVG in `svg/` and re-run the
generator.
