import { formatNumber, formatPercent } from "@jcsoftdev/ui-core/chart/format";
import {
  assignUnits,
  largestRemainder,
  parliamentLayout,
} from "@jcsoftdev/ui-core/chart/parliament";
import { type DefineOptions, defineElement } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type DrawContext,
  type DrawResult,
  svg,
} from "../internal/chart-base.js";
import {
  adoptPolar,
  EASE,
  jsonAttr,
  numberAttr,
  paint,
  SideKeeper,
  text,
  warnDuplicates,
} from "../internal/e20-polar.js";

export interface ParliamentDatum {
  id: string;
  name: string;
  /** Number of seats (whole numbers). */
  value: number;
  color?: string;
}

const MAJORITY_SPACE = 20;
const MAX_SEATS = 2000;

/**
 * `<ui-parliament-chart>`: a hemicycle of seats. The arcs are worked out for the total, every arc
 * gets seats in proportion to its length and groups are laid left to right, so each one reads as a
 * wedge. React `ParliamentChart`. Marks are the groups (arrows wrap, Home, End). The pointer picks
 * the nearest seat within reach, so the space between seats never drops the group.
 *
 * Attributes: `data` (JSON `{ id, name, value, color? }[]`), `rows` (computed by default),
 * `inner-ratio` (.4), `seat-shape` (`circle`, `square`), `majority` (flag for half plus one, or a
 * seat count), `majority-label` ("Majority"), `center-label` (word under the total; omit to hide
 * it), `seat-label` ("Seats"), `max-seats` (seats drawn at most, 2000; more are sampled), `initial-hidden`, plus the chart attributes. Height defaults to 260.
 * Properties: `data`, `palette`.
 * Events: `chart-hover`, `chart-select`, `chart-series`.
 */
export class UiParliamentChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "data",
    "rows",
    "inner-ratio",
    "seat-shape",
    "majority",
    "majority-label",
    "center-label",
    "seat-label",
  ];
  #data: readonly ParliamentDatum[] | undefined;
  #warned = false;
  readonly #keeper = new SideKeeper();

  get data(): readonly ParliamentDatum[] {
    return this.#data ?? jsonAttr<ParliamentDatum[]>(this, "data", []);
  }
  set data(value: readonly ParliamentDatum[]) {
    this.#data = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "parliament-chart";
    adoptPolar(this);
    // TODO(E20): default height 260 through the base natural-height hook (no host writes);
    // seed `initial-hidden` with the base hook once it lands.
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return this.data.every((datum) => !(datum.value > 0));
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale } = ctx;
    const data = this.data;
    const innerRatio = numberAttr(this, "inner-ratio", 0.4);
    const rowsAttr = this.hasAttribute("rows") ? numberAttr(this, "rows", 0) : 0;
    const square = this.getAttribute("seat-shape") === "square";
    const majorityAttr = this.getAttribute("majority");
    const majorityLabel = this.getAttribute("majority-label") ?? text(this, "majority");
    const centerLabel = this.getAttribute("center-label");
    const seatLabel = this.getAttribute("seat-label") ?? text(this, "seats");
    warnDuplicates(
      this,
      data.map((datum) => datum.id),
    );
    const colors = data.map((datum, index) => ctx.color(index, datum.color));
    const seats = data.map((datum) =>
      Number.isFinite(datum.value) ? Math.max(0, Math.round(datum.value)) : 0,
    );
    const total = seats.reduce((acc, count) => acc + count, 0);
    const majorityAt =
      majorityAttr === null || majorityAttr === "false"
        ? null
        : majorityAttr === "" || majorityAttr === "true"
          ? Math.floor(total / 2) + 1
          : numberAttr(this, "majority", Math.floor(total / 2) + 1);

    // A huge chamber draws a proportional sample of seats; the numbers stay exact.
    const cap = Math.max(1, Math.round(numberAttr(this, "max-seats", MAX_SEATS)));
    const drawn = total > cap ? largestRemainder(seats, cap) : seats;
    if (total > cap && !this.#warned) {
      this.#warned = true;
      console.warn(
        `<ui-parliament-chart>: ${total} seats drawn as ${cap}; raise max-seats to draw more.`,
      );
    }
    const layout = parliamentLayout(Math.min(total, cap), {
      rows: rowsAttr > 0 ? rowsAttr : undefined,
      innerRatio,
    });
    const sr = layout.seatRadius;
    const top = majorityAt != null ? MAJORITY_SPACE : 2;
    const radius = Math.max(
      8,
      Math.min((width - 4) / (2 * (1 + sr)), (height - top - 2) / (1 + 2 * sr)),
    );
    const cx = width / 2;
    const cy = top + radius * (1 + sr);
    const owners = assignUnits(drawn);
    const rowSeats: number[][] = layout.radii.map(() => []);
    for (const [index, seat] of layout.seats.entries()) rowSeats[seat.row]?.push(index);
    const placed = layout.seats.map((seat, index) => ({
      owner: owners[index] ?? -1,
      x: cx + seat.x * radius,
      y: cy + seat.y * radius,
    }));
    const seatR = sr * radius;
    const innerEdge = (layout.radii[0] ?? innerRatio) - sr;
    const holeRadius = Math.max(0, innerEdge * radius);

    const seatEl = (x: number, y: number, color: string) =>
      paint(
        square
          ? svg("rect", {
              x: x - seatR * 0.9,
              y: y - seatR * 0.9,
              width: seatR * 1.8,
              height: seatR * 1.8,
              rx: seatR * 0.35,
            })
          : svg("circle", { cx: x, cy: y, r: seatR }),
        "fill",
        color,
      );

    // Seats of hidden groups stay as empty places.
    const empty = svg("g", { "aria-hidden": "true" });
    for (const seat of placed) {
      const datum = data[seat.owner];
      if (datum && this.isHidden(datum.id)) empty.append(seatEl(seat.x, seat.y, "var(--track)"));
    }
    root.append(empty);

    const groups: Array<SVGGElement | undefined> = [];
    const visibleSeats: Array<Array<{ x: number; y: number }>> = [];
    const popped: SVGElement[] = [];
    data.forEach((datum, category) => {
      const own = placed.filter((seat) => seat.owner === category);
      visibleSeats[category] = own;
      if (this.isHidden(datum.id) || !own.length) return;
      const group = svg("g", { "data-category": category, "data-series": datum.id });
      for (const seat of own) {
        const mark = seatEl(seat.x, seat.y, colors[category] as string);
        mark.style.transformBox = "fill-box";
        mark.style.transformOrigin = "center";
        popped.push(mark);
        group.append(mark);
      }
      groups[category] = group;
      root.append(group);
    });

    if (majorityAt != null) {
      const g = svg("g", { "aria-hidden": "true", "data-pointer-none": "" });
      g.append(
        svg("line", {
          x1: cx,
          x2: cx,
          y1: cy - holeRadius + 2,
          y2: cy - radius * (1 + sr) - 4,
          "stroke-width": 1.25,
          "stroke-dasharray": "3 3",
          style: "stroke:var(--ink-3)",
        }),
        svg(
          "text",
          {
            x: cx,
            y: cy - radius * (1 + sr) - 8,
            "text-anchor": "middle",
            style: "fill:var(--ink-2);font-size:11px;font-weight:600",
          },
          `${majorityLabel}: ${formatNumber(majorityAt, { locale })}`,
        ),
      );
      root.append(g);
    }
    if (centerLabel != null && holeRadius > 28) {
      const size = Math.max(14, Math.min(34, holeRadius * 0.62));
      const g = svg("g", {
        "aria-hidden": "true",
        "data-pointer-none": "",
        "text-anchor": "middle",
      });
      g.append(
        svg(
          "text",
          {
            x: cx,
            y: cy - 16,
            style: `fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums;font-size:${size}px`,
          },
          formatNumber(total, { locale }),
        ),
        svg("text", { x: cx, y: cy - 1, style: "fill:var(--ink-3);font-size:11px" }, centerLabel),
      );
      root.append(g);
    }

    if (ctx.animate) {
      const budget = Math.min(popped.length, 800);
      popped.slice(0, budget).forEach(
        (node, i) =>
          void node.animate(
            [
              { opacity: 0, transform: "scale(.2)" },
              { opacity: 1, transform: "scale(1)" },
            ],
            { duration: 380, delay: (i / budget) * 450, easing: EASE, fill: "backwards" },
          ),
      );
    }

    const available = data.map((_, index) => index).filter((index) => groups[index] != null);
    const share = (count: number) => formatPercent(total ? count / total : 0, { locale });
    const fmt = (count: number) => formatNumber(count, { locale });
    const reach = seatR * 2.4;
    const marks = available.map((category) => ({
      el: groups[category] as SVGGElement,
      label: `${data[category]?.name}: ${fmt(seats[category] ?? 0)} ${seatLabel} (${share(seats[category] ?? 0)})`,
    }));
    const title = this.getAttribute("label") ?? "";
    return {
      summary: data.map((datum, i) => `${datum.name} ${fmt(seats[i] ?? 0)}`).join(", "),
      marks,
      hit: (x, y, _target, pointerRadius) => {
        // Rows and angles are regular, so the candidates are the few seats around the pointer in
        // the two nearest rows: the space between seats keeps the group, whatever the seat count.
        const dx = x - cx;
        const dy = y - cy;
        const unit = Math.hypot(dx, dy) / radius;
        const raw = Math.atan2(-dy, dx);
        // Below the baseline the nearest end of the arc is the left or right one.
        const angle = raw >= 0 ? raw : dx < 0 ? Math.PI : 0;
        const nearRows = layout.radii
          .map((r, row) => ({ row, d: Math.abs(r - unit) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);
        let best = -1;
        let distance = Number.POSITIVE_INFINITY;
        for (const { row } of nearRows) {
          const list = rowSeats[row] ?? [];
          const guess =
            list.length > 1 ? Math.round(((Math.PI - angle) * (list.length - 1)) / Math.PI) : 0;
          for (let at = guess - 2; at <= guess + 2; at += 1) {
            const seat = placed[list[at] ?? -1];
            const position = seat ? available.indexOf(seat.owner) : -1;
            if (!seat || position < 0) continue;
            const d = Math.hypot(seat.x - x, seat.y - y);
            if (d < distance) {
              distance = d;
              best = position;
            }
          }
        }
        return distance <= reach + (pointerRadius > 12 ? 8 : 0) ? best : -1;
      },
      hover: (position) => {
        const category = available[position];
        const datum = category != null ? data[category] : undefined;
        if (category == null || !datum) return null;
        const own = visibleSeats[category] ?? [];
        const anchor = own[Math.floor(own.length / 2)] ?? { x: cx, y: cy };
        return {
          title: datum.name,
          rows: [
            {
              id: datum.id,
              name: seatLabel,
              value: fmt(seats[category] ?? 0),
              color: colors[category] as string,
              shape: square ? "square" : "dot",
              note: share(seats[category] ?? 0),
            },
          ],
          x: anchor.x,
          y: anchor.y,
          side: this.#keeper.pick(anchor.x, width),
          category,
        };
      },
      nav: (position, intent) => {
        const count = available.length;
        if (intent === "home") return 0;
        if (intent === "end") return count - 1;
        if (intent === "left" || intent === "up") return (position - 1 + count) % count;
        if (intent === "right" || intent === "down") return (position + 1) % count;
        return undefined;
      },
      maxHoverRows: 1,
      snapshot: () => ({
        title:
          majorityAt != null
            ? `${title}. ${majorityLabel}: ${fmt(majorityAt)}`.replace(/^\. /, "")
            : title,
        categoryHeader: text(this, "category"),
        categories: data.map((datum) => datum.name),
        series: [
          {
            id: "seats",
            name: seatLabel,
            color: colors[0] ?? "",
            values: seats,
            text: seats.map(fmt),
          },
          {
            id: "share",
            name: text(this, "share"),
            color: colors[0] ?? "",
            values: seats.map((count) => (total ? count / total : 0)),
            text: seats.map(share),
          },
        ],
        legend: data.map((datum, i) => ({
          id: datum.id,
          name: datum.name,
          color: colors[i] as string,
          shape: square ? ("square" as const) : ("dot" as const),
        })),
      }),
    };
  }
}

/** Registers `<ui-parliament-chart>` (or `<prefix>-parliament-chart`) and returns the tag. */
export function defineParliamentChart(options?: DefineOptions): string {
  return defineElement("parliament-chart", UiParliamentChart, options);
}
