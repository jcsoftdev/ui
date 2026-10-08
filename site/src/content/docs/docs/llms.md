---
title: Docs for LLMs
description: llms.txt, llms-full.txt and a Markdown version of every page, generated from the same source as the HTML docs.
section: Guides
---

This site is readable by language models and coding agents without scraping HTML.

| URL                                | What it is                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`/llms.txt`](/llms.txt)           | Index in the [llms.txt](https://llmstxt.org) format: a title, a one-line summary and sections of links to Markdown pages.             |
| [`/llms-full.txt`](/llms-full.txt) | Every documentation page concatenated into one file, including all components with their props.                                       |
| `/docs/<page>.md`                  | The Markdown of a single page, for example [`/docs/getting-started.md`](/docs/getting-started.md) or `/docs/components/data-grid.md`. |
| `/manifest.json`                   | Machine-readable list of every component: name, category, import path, props and Storybook story ids.                                 |

Every page has **Copy page as Markdown** and **Open .md** buttons under its title.

## Same source as the human docs

The Markdown is produced from the same files as the HTML pages. Component pages are generated from the TypeScript source of `@jcsoftdev/ui` (exports, prop types, defaults, JSDoc) on every build, so an agent never sees stale props.

## Tips for agents

- Start from `/llms.txt`, then fetch only the component pages you need.
- Import path rule: a component is imported from its category, for example `@jcsoftdev/ui/containers`, or from a single-component entry such as `@jcsoftdev/ui/containers/data-grid`.
- Theming is attribute driven: `data-theme`, `data-accent`, `data-style`, `data-density`, `data-radius` on `<html>` or any element.
- Use semantic Tailwind utilities (`bg-surface-card`, `text-ink`, `rounded-card`) instead of literal colors.
