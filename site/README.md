# @jcsoftdev/ui-site

Public site for the `@jcsoftdev/ui` library: a landing page with live components, documentation for people (Starlight) and documentation for LLMs (`llms.txt`, `llms-full.txt` and a Markdown copy of every page). Author: jcsoftdev.

Astro 7 with React islands, Starlight for `/docs`, Tailwind v4 through its Vite plugin. The output is fully static (`output: "static"`).

## Commands

Run from the repository root with `pnpm --filter @jcsoftdev/ui-site <script>` or from `site/`.

| Script      | What it does                                                                           |
| ----------- | -------------------------------------------------------------------------------------- |
| `dev`       | Generates the docs, then `astro dev` on `$SITE_PORT` (default 4321).                   |
| `build`     | Generates the docs, then `astro build` into `dist/` (Pagefind search included).        |
| `start`     | `astro preview` of `dist/`.                                                            |
| `typecheck` | Generates the docs, then `astro check` and `tsc --noEmit`.                             |
| `lint`      | `prettier --check .`                                                                   |
| `test`      | Node test runner over the docs generator (fixture package plus checks on the real UI). |

The site imports `@jcsoftdev/ui` from its `dist/`, so build it first: `pnpm --filter @jcsoftdev/ui build`.

Environment variables (both optional, read at build time):

- `SITE_URL`: public origin. Enables canonical URLs and absolute links in `llms.txt`.
- `PUBLIC_STORYBOOK_URL`: where Storybook is hosted. Defaults to `/storybook`; the site does not host Storybook itself.

## How the docs are generated

`scripts/build-docs.mjs` runs before every `dev`, `build` and `typecheck`. It reads `packages/ui` and writes:

- `src/content/docs/docs/components/<slug>.md`: one page per component.
- `src/content/docs/docs/reference/exports.md`, `docs/subpaths.md`, `docs/theming/tokens.md`.
- `src/generated/manifest.json` and `sidebar.json`.

How it works:

1. The TypeScript compiler API resolves every public subpath export (`@jcsoftdev/ui/<entry>`), including `export *`. A component is a capitalized export with a call signature that returns JSX.
2. Props come from the component's own declarations (native HTML props are flagged, not listed one by one), with defaults from destructuring initializers or `@default`.
3. Storybook CSF files are parsed statically for stories, story ids and a usage snippet synthesized from the args.
4. Pages are plain Markdown, so the same body serves the HTML page and its `.md` copy. When a component has a story, its frontmatter carries `example: { file, story }` and a Starlight override renders it as a live React island (`client:visible`).

The generated files are git-ignored: they are derived from the library and rebuilt on every run. Hand-written pages live in `src/content/docs/docs/` (`index`, `getting-started`, `theming`, `container-queries`, `accessibility`, `llms`).

### Routes

- `/` landing
- `/docs/` and the guides: `getting-started`, `subpaths`, `theming`, `customization`, `theming/tokens`, `container-queries`, `accessibility`, `llms`, `reference/exports`
- `/docs/components/<slug>/`: one page per component
- `/docs/<page>.md`: Markdown for every docs page (the docs root is `/docs/index.md`)
- `/llms.txt`, `/llms-full.txt`, `/manifest.json`

`starlight-llms-txt` was evaluated and not used: it does not emit a per-page `.md` for plain Markdown content. The endpoints are in `src/pages/` (`llms.txt.ts`, `llms-full.txt.ts`, `docs/[...slug].md.ts`) and share builders with the tests (`scripts/lib/llms.mjs`).

## Theming

The landing and the docs both import the library's `tokens.css`, `theme.css` and `base.css`. Starlight's `--sl-color-*` variables are mapped to the library's role tokens in `src/styles/starlight.css`, so the docs follow `data-style`, `data-accent`, `data-theme`, `data-density` and `data-radius` too. The preset switcher only sets those attributes on `<html>` and stores them in `localStorage` (guarded by try/catch); an inline head script restores them before first paint.

## Landing

`src/components/landing/` holds the React islands. Heavy demos use `client:visible` and render nothing until mounted, so server and client markup agree. Demo data is deterministic and in Spanish (a barbershop in Lima) on purpose: the library ships es-PE copy. Page copy is in English. Entrance animations are disabled under `prefers-reduced-motion`.

## Docker

```sh
docker build -f site/Dockerfile --build-arg SITE_URL=https://ui.example.com -t ui-site .
docker run --rm -p 8080:8080 ui-site
```

The build context is the repository root. The runtime image is `nginx-unprivileged` (non-root, port 8080) with `nginx.conf`, which serves `.md` as `text/markdown; charset=utf-8` and `.txt` as `text/plain; charset=utf-8`. Deployment itself is not part of this package.
