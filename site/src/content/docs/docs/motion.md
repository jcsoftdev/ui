---
title: Motion
description: Reveal, Stagger, CrossFade, Presence, CountUp and useHighlightRow, short enter, swap, count and highlight motion on the theme's motion tokens, safe for server rendering and reduced motion.
section: Guides
---

`@jcsoftdev/ui/motion` is a small set of motion building blocks for product screens: content that enters, panes that swap, numbers that count and rows that flash after a change. It adds no dependency: enters, swaps and pulses are CSS animations, and only `CountUp` steps in JavaScript, once per frame while it counts.

Every example below is type-checked against the built package (`pnpm check:docs-examples`).

## Rules every piece follows

- **Tokens only.** Durations and easing come from `--motion-duration` and `--motion-ease` (the `ease-style` utility in Tailwind). A theme that shortens them, or makes them `linear`, restyles all motion. The defaults give 180ms enters, a 270ms count and a 288ms pulse.
- **Opacity and transform.** Enter and leave animate only `opacity` and `transform`, so nothing reflows. The row pulse fades a background colour, which repaints the row but never lays it out.
- **Server HTML never animates.** Content rendered on the server, and the hydration that follows, shows its end state with no motion attribute, so markup matches and nothing flashes. Only content that mounts or changes on the client moves.
- **Reduced motion reaches the end state at once.** Under `prefers-reduced-motion: reduce`, `Reveal` and `Stagger` show their content, `CrossFade` swaps without a fade, `CountUp` shows the final value and rows do not pulse.
- **Nothing is hidden from assistive tech.** Hidden states use `opacity` only, never `visibility`, `display` or `aria-hidden`, so a screen reader reads content while it enters.
- **Short and quiet.** One run per change, no loops.

The rules ship as a `<style>` tag that React 19 hoists and dedupes, so there is no stylesheet to import. Every component renders it; `useHighlightRow` is a hook, so render `<MotionStyles />` once next to the rows (or anywhere on the page).

## Reveal

```tsx region=reveal
export function Welcome() {
  return (
    <Reveal>
      <Card className="p-card">Welcome back. Three tasks are waiting for you.</Card>
    </Reveal>
  );
}
```

`Reveal` fades its content in with a 6px rise when it mounts on the client. `delay` (ms) waits before starting, `inView` waits until the element first scrolls into view, and `asChild` animates the single child instead of adding a `div`. While it waits for the viewport its content is transparent but focusable: tabbing into it shows it at once.

## Stagger

```tsx region=stagger
export function DashboardCards({ titles }: { titles: string[] }) {
  return (
    <Stagger className="grid grid-cols-3 gap-6" inView>
      {titles.map((title) => (
        <Card key={title} className="p-card">
          {title}
        </Card>
      ))}
    </Stagger>
  );
}
```

`Stagger` enters its children one after another. Each step is a quarter of `--motion-duration`, and the gap between the first and the last start is capped by `maxStagger` (ms, default 1.5 durations), so a long list never takes longer than a short one. `as` picks the wrapper (`div`, `ul`, `ol`, `section`). Each child receives `data-motion` and a `style` variable, so it must pass `style` and `data-*` props to its DOM element, as every element and the library's components do.

## CrossFade

```tsx region=cross-fade
export function StudentDetail({ selected }: { selected: Student }) {
  return (
    <CrossFade contentKey={selected.id}>
      <Card className="grid gap-2 p-card">
        <h2>{selected.name}</h2>
        <Kpi label="Average" value={<CountUp value={selected.average} />} />
      </Card>
    </CrossFade>
  );
}
```

`CrossFade` swaps keyed content: a new `contentKey` fades the old content out and the new content in with a 4px rise. Use it for list-detail panes and tab panels. The old content stays mounted on top until it has faded, out of the layout so nothing jumps, with `aria-hidden` and `inert`. If focus was inside the old content it moves to the new content instead of falling to the page. Put layout classes on the content: `CrossFade` wraps each version in its own `div`.

### Presence

```tsx region=presence
export function Hint() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen((value) => !value)}>Show the hint</Button>
      <Presence present={open}>
        <p>Grades are published every Friday.</p>
      </Presence>
    </>
  );
}
```

`Presence` is a `CrossFade` between its children and nothing, for content that shows and hides.

## CountUp

```tsx region=count-up
const soles = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});

export function Revenue({ total }: { total: number }) {
  return <Kpi card label="Tuition collected" value={<CountUp value={total} formatter={soles} />} />;
}
```

`CountUp` counts to `value` on a client mount (from `from`, default 0) and on every change, over 1.5 `--motion-duration`s. `formatter` is anything with an `Intl.NumberFormat`-style `format`; without one it uses `Intl.NumberFormat` in the UI strings locale. Integer runs stay whole, so a formatter never flashes decimals. While it counts, assistive tech reads only the final value and the final text reserves its width. It works as the `value` of a `Kpi`; `KpiGroup` keeps its own `animate` prop.

## useHighlightRow

```tsx region=highlight-row
export function Applicants({ rows }: { rows: Student[] }) {
  const { highlight, rowProps } = useHighlightRow(rows.map((row) => row.id));
  return (
    <>
      <MotionStyles />
      <table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} {...rowProps(row.id)}>
              <td>{row.name}</td>
              <td>
                <Button onClick={() => approve(row.id).then(() => highlight(row.id))}>
                  Approve
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
```

`useHighlightRow(keys)` pulses rows that were inserted or updated: an accent tint that fades out. Pass the current row keys and every key that appears after the first render pulses on its own; call `highlight(key)` after an update (calling it again restarts the pulse). Spread `rowProps(key)` on the row element (`tr`, `li`, `div`); in a `tr` the cells carry the tint, so it shows through cell backgrounds. Rows from the first render and from server HTML never pulse.

## API

| Export            | Props                                                             |
| ----------------- | ----------------------------------------------------------------- |
| `Reveal`          | `delay`, `inView`, `asChild`, plus `div` props                    |
| `Stagger`         | `delay`, `inView`, `maxStagger`, `as`, plus element props         |
| `CrossFade`       | `contentKey`, plus `div` props                                    |
| `Presence`        | `present`, plus `div` props                                       |
| `CountUp`         | `value`, `formatter`, `from`, plus `span` props                   |
| `useHighlightRow` | `(keys?)` returns `{ highlight, rowProps }`                       |
| `MotionStyles`    | none: the motion rules, for pages that only use `useHighlightRow` |
