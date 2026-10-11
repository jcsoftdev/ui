# Third-party notices

`@jcsoftdev/ui` has no runtime dependencies. The code below was written for this package, but
it is derived from, or ports the behavior and constants of, the following open-source projects.
Their licenses require the notices to be kept.

## Lucide icons (ISC) and Feather (MIT)

The SVG sources in `icons/svg`, and the generated components in `src/icons` and
`dist/icons`, are vendored from [Lucide](https://lucide.dev) (lucide-react 1.53.0).

- Copyright (c) 2026 Lucide Icons and Contributors, ISC License.
- A subset of the icons derives from Feather: Copyright (c) 2013-present Cole Bemis, MIT License.

The full license text, including the list of Feather-derived icons, ships in
`icons/LICENSE-lucide`.

## tailwind-merge (MIT)

The class merge engine (`src/utils/class-merge.ts`, `class-groups.ts`, `class-validators.ts`) is a
new implementation that reproduces the conflict groups and resolution rules of
[tailwind-merge](https://github.com/dcastil/tailwind-merge) 3.x, and its output was verified
against that library. The class group table follows its structure.

Copyright (c) 2021 Dany Castillo, MIT License.

## cmdk and command-score (MIT)

The command menu (`src/primitives/command`) is a new implementation with the behavior and API shape
of [cmdk](https://github.com/pacocoursey/cmdk) (Copyright (c) 2022 Paco Coursey). The scorer
(`score.ts`) uses the scoring constants and approach of
[command-score](https://github.com/superhuman/command-score) (Copyright (c) 2017 Superhuman Labs
Inc.), as vendored by cmdk.

## Radix UI and sonner (MIT, behavior reference)

The dialog, popover, menu, tabs, switch, checkbox, radio group, progress, avatar and slot behavior,
and the toast API, follow the documented behavior and WAI-ARIA patterns of
[Radix UI Primitives](https://github.com/radix-ui/primitives) (Copyright (c) 2022 WorkOS) and
[sonner](https://github.com/emilkowalski/sonner) (Copyright (c) 2023 Emil Kowalski). No source
files from those projects are bundled; they are no longer dependencies.

## MIT License

Applies to Feather, tailwind-merge, cmdk, command-score, Radix UI and sonner above, each with the
copyright holder named in its section.

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
