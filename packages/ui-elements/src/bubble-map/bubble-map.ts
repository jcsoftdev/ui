import { seriesColor } from "@jcsoftdev/ui-core/chart/palette";
import { type Cluster, clusterPoints } from "@jcsoftdev/ui-core/geo/cluster";
import { greatCircle, routeArcPath, routePolylinePath } from "@jcsoftdev/ui-core/geo/routes";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_EVENT,
  type DrawContext,
  type DrawResult,
  join,
  svg,
} from "../internal/chart-base.js";
import {
  directionalNav,
  type MapPoint,
  type MapRoute,
  resolveRoutes,
} from "../internal/e24-geo.js";
import { GeoMapElement, type Stage } from "../internal/e24-map.js";
import css from "./bubble-map.css.js";

export type { MapPoint, MapRoute, MapRouteEnd } from "../internal/e24-geo.js";

export interface BubbleCategory {
  id: string;
  name: string;
  /** CSS color; the palette slot by order otherwise. */
  color?: string;
}

/** What mark `index` of the map stands for. */
export type BubbleMark =
  | { kind: "point"; points: [MapPoint] }
  | { kind: "cluster"; points: MapPoint[] }
  | { kind: "route"; route: MapRoute; name: string };

interface Item {
  key: string;
  cluster: Cluster;
  points: MapPoint[];
  color: string;
  category: string;
  radius: number;
}

interface Shape {
  route: MapRoute;
  name: string;
  width: number;
  d: string;
  mid: [number, number];
}

const ACCENT = "var(--accent-word)";

/**
 * `<ui-bubble-map>`: markers on a map by longitude and latitude, area-proportional to their value
 * and colored by category, with optional clustering and routes. Sizes stay in screen pixels while
 * you zoom. Hover, arrow keys (nearest bubble in that direction), Home and End show a marker; a
 * click, Enter or a tap pins it (`chart-select`), and a cluster zooms in instead. Drag pans, the
 * wheel (with Ctrl or Cmd, or always) and pinch zoom, `+`, `-` and `0` zoom and fit, Shift+arrows pan.
 * Routes are marks after the bubbles, so they take hover and the keyboard too; their dashes march
 * only when motion is allowed.
 *
 * Attributes: `map` (`world`, `peru`; or the `map` property with a `GeoMap`), `value-name`,
 * `projection`, `min-radius` (6), `max-radius` (28), `cluster`, `cluster-distance` (36 px),
 * `region-labels`, `route-style` (`curve` default, `great-circle`), `route-bend` (0.25),
 * `animate-routes="off"`, `zoomable="off"`, `wheel-zoom`, `max-zoom`, plus the chart attributes.
 * Properties: `points`, `categories` (legend entries and colors; derived from the points otherwise),
 * `routes`, `labels`; `markInfo(index)` says what a mark index stands for. Events: the chart events
 * (`chart-select` replaces React's `onPointClick`, with `markInfo(detail.index)`).
 */
export class UiBubbleMap extends GeoMapElement {
  static override observedAttributes = [
    ...GeoMapElement.observedAttributes,
    "value-name",
    "min-radius",
    "max-radius",
    "cluster",
    "cluster-distance",
    "region-labels",
    "route-style",
    "route-bend",
    "animate-routes",
  ];
  protected override highlightRegions = false;
  #points: readonly MapPoint[] = [];
  #categories: readonly BubbleCategory[] | undefined;
  #routes: readonly MapRoute[] = [];
  #marks: BubbleMark[] = [];
  #stage: Stage | undefined;
  #items: Item[] = [];
  #shapes: Shape[] = [];
  #anchors: Array<[number, number]> = [];
  #key = "";

  constructor() {
    super();
    // A cluster zooms in instead of staying selected.
    this.addEventListener(CHART_EVENT.select, (event) => {
      const detail = (event as CustomEvent<{ index: number } | null>).detail;
      if (!detail) return;
      const mark = this.#marks[detail.index];
      if (mark?.kind !== "cluster") return;
      const members = this.#items[detail.index]?.cluster.members ?? [];
      const base = this.#base(this.#visible());
      const xs = members.map((m) => (base[m] as { x: number }).x);
      const ys = members.map((m) => (base[m] as { y: number }).y);
      const pad = 14;
      this.viewer.focusBox([
        Math.min(...xs) - pad,
        Math.min(...ys) - pad,
        Math.max(...xs) + pad,
        Math.max(...ys) + pad,
      ]);
      this.select(null);
    });
  }

  get points(): readonly MapPoint[] {
    return this.#points;
  }
  set points(value: readonly MapPoint[]) {
    this.#points = value ?? [];
    this.requestDraw();
  }
  get categories(): readonly BubbleCategory[] | undefined {
    return this.#categories;
  }
  set categories(value: readonly BubbleCategory[] | undefined) {
    this.#categories = value;
    this.requestDraw();
  }
  get routes(): readonly MapRoute[] {
    return this.#routes;
  }
  set routes(value: readonly MapRoute[]) {
    this.#routes = value ?? [];
    this.requestDraw();
  }
  /** What mark `index` stands for: a point, a cluster of points or a route. */
  markInfo(index: number): BubbleMark | undefined {
    return this.#marks[index];
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "bubble-map";
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return this.#points.length === 0;
  }

  protected override revealAt(index: number) {
    return this.#anchors[index];
  }

  #categoryList(): BubbleCategory[] {
    if (this.#categories) return [...this.#categories];
    const seen: BubbleCategory[] = [];
    for (const point of this.#points) {
      const id = point.category ?? "";
      if (!seen.some((category) => category.id === id)) seen.push({ id, name: id });
    }
    return seen;
  }

  #visible(): MapPoint[] {
    return this.#points.filter((point) => !this.isHidden(point.category ?? ""));
  }

  #base(points: readonly MapPoint[]) {
    const project = this.#stage?.geo.projection.project;
    return points.map((point) => {
      const [x, y] = project ? project(point.lon, point.lat) : [0, 0];
      return { x, y, value: point.value ?? 0 };
    });
  }

  protected override draw(ctx: DrawContext): DrawResult | undefined {
    const stage = this.stage(ctx);
    if (!stage) return undefined;
    this.#stage = stage;
    const labels = this.mapLabels;
    const name = this.getAttribute("value-name") || labels.value;
    const categories = this.#categoryList();
    const colorOf = new Map(
      categories.map((category, index) => [category.id, seriesColor(index, category.color)]),
    );
    const colorFor = (point: MapPoint) => colorOf.get(point.category ?? "") ?? seriesColor(0);
    const visible = this.#visible();
    const minRadius = Number(this.getAttribute("min-radius")) || 6;
    const maxRadius = Number(this.getAttribute("max-radius")) || 28;
    const distance = Number(this.getAttribute("cluster-distance")) || 36;
    const zoom = stage.view.k;

    const key = `${stage.geo.projection.scale}|${stage.width}|${stage.height}|${visible.length}|${zoom}|${this.hasAttribute("cluster")}|${distance}`;
    if (key !== this.#key || !ctx.transient) {
      const base = this.#base(visible);
      const clusters: Cluster[] = this.hasAttribute("cluster")
        ? clusterPoints(base, distance / zoom)
        : base.map((point, index) => ({ ...point, members: [index] }));
      const top = Math.max(0, ...clusters.map((entry) => entry.value));
      this.#items = clusters.map((entry): Item => {
        const members = entry.members.map((index) => visible[index] as MapPoint);
        const weight = new Map<string, number>();
        for (const member of members)
          weight.set(colorFor(member), (weight.get(colorFor(member)) ?? 0) + (member.value ?? 1));
        const color =
          [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
          colorFor(members[0] as MapPoint);
        return {
          key: members.map((member) => member.id).join("+"),
          cluster: entry,
          points: members,
          color,
          category:
            (members.find((member) => colorFor(member) === color) ?? members[0])?.category ?? "",
          radius:
            top > 0 && entry.value > 0
              ? Math.max(minRadius, maxRadius * Math.sqrt(entry.value / top))
              : minRadius,
        };
      });
      this.#key = key;
    }
    const items = this.#items;
    this.#shapes = this.#routeShapes(stage);
    const shapes = this.#shapes;

    this.paintRegions(
      stage,
      stage.geo.features.map(() => "var(--surface-2)"),
    );
    this.paintLabels(
      stage,
      this.hasAttribute("region-labels")
        ? stage.geo.features.map((feature) => feature.name)
        : undefined,
    );

    // Routes live in the zoomed scene, bubbles in screen space.
    stage.scene.toggleAttribute(
      "data-flow",
      ctx.motion && this.getAttribute("animate-routes") !== "off",
    );
    const routeEls = join(
      stage.scene,
      shapes,
      (shape) => shape.route.id,
      () =>
        svg(
          "g",
          { "data-route": "" },
          svg("path", { "data-route-line": "" }),
          svg("path", { "data-route-dash": "" }),
          svg("path", { "data-route-hit": "" }),
        ),
      (el, shape, index) => {
        el.dataset.route = `${index}`;
        const color = shape.route.color ?? ACCENT;
        el.style.setProperty("--ui-route-color", color);
        el.style.setProperty("--ui-route-width", `${shape.width}`);
        for (const path of el.querySelectorAll("path"))
          if (path.getAttribute("d") !== shape.d) path.setAttribute("d", shape.d);
      },
    );

    const order = items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.radius - a.item.radius);
    const ordered = join(
      stage.overlay,
      order,
      ({ item }) => item.key,
      () =>
        svg(
          "g",
          { "data-bubble": "" },
          svg("circle", { "fill-opacity": 0.78 }),
          svg("text", { "text-anchor": "middle", "dominant-baseline": "central" }),
        ),
      (el, { item, index }) => {
        const [x, y] = stage.toScreen(item.cluster.x, item.cluster.y);
        el.dataset.i = `${index}`;
        el.dataset.series = item.category;
        const circle = el.firstElementChild as SVGCircleElement;
        circle.setAttribute("cx", `${x}`);
        circle.setAttribute("cy", `${y}`);
        circle.setAttribute("r", `${item.radius}`);
        circle.style.fill = item.color;
        const text = el.lastElementChild as SVGTextElement;
        const count = item.points.length > 1 && item.radius >= 8 ? `${item.points.length}` : "";
        if (text.textContent !== count) text.textContent = count;
        text.setAttribute("x", `${x}`);
        text.setAttribute("y", `${y}`);
      },
    );
    const bubbleEls: SVGElement[] = [];
    order.forEach(({ index }, position) => {
      bubbleEls[index] = ordered[position] as SVGElement;
    });

    this.#marks = [
      ...items.map(
        (item): BubbleMark =>
          item.points.length > 1
            ? { kind: "cluster", points: item.points }
            : { kind: "point", points: [item.points[0] as MapPoint] },
      ),
      ...shapes.map(
        (shape): BubbleMark => ({ kind: "route", route: shape.route, name: shape.name }),
      ),
    ];
    this.#anchors = [
      ...items.map((item): [number, number] => [item.cluster.x, item.cluster.y]),
      ...shapes.map((shape): [number, number] => shape.mid),
    ];
    const describe = (item: Item) =>
      item.points.length > 1 ? labels.cluster(item.points.length) : (item.points[0]?.name ?? "");
    const total = (item: Item) =>
      item.points.some((point) => point.value != null) ? ctx.format(item.cluster.value) : "";
    const categoryName = (point: MapPoint) =>
      categories.find((category) => category.id === (point.category ?? ""))?.name ?? "";

    const screenOf = items.map((item) => stage.toScreen(item.cluster.x, item.cluster.y));
    const showLegend =
      categories.length > 1 && categories.every((category) => category.name !== "");

    return {
      label: this.loadedMap?.name,
      summary: `${this.loadedMap?.name ?? ""}: ${visible.length} markers${shapes.length ? `, ${shapes.length} routes` : ""}`,
      marks: [
        ...items.map((item, index) => ({
          el: bubbleEls[index] as SVGElement,
          label: [describe(item), total(item) && `${name}: ${total(item)}`]
            .filter(Boolean)
            .join(", "),
        })),
        ...shapes.map((shape, index) => ({
          el: routeEls[index] as SVGElement,
          label:
            shape.route.value == null
              ? shape.name
              : `${shape.name}: ${name} ${ctx.format(shape.route.value)}`,
        })),
      ],
      hit: (x, y, target, radius) => {
        if (this.viewer.dragging) return -1;
        // Bubbles sit over routes; of overlapping bubbles the smaller one is drawn on top, and a
        // finger that misses everything takes the nearest bubble within reach.
        const slack = radius > 12 ? 10 : 2;
        let best = -1;
        let bestScore = Number.POSITIVE_INFINITY;
        screenOf.forEach(([sx, sy], index) => {
          const item = items[index] as Item;
          const d = Math.hypot(sx - x, sy - y);
          if (d > item.radius + slack) return;
          const score = d <= item.radius ? item.radius : 1000 + (d - item.radius);
          if (score < bestScore) {
            best = index;
            bestScore = score;
          }
        });
        if (best >= 0) return best;
        const route = target?.closest?.("[data-route]") as SVGElement | null | undefined;
        return route ? items.length + Number(route.dataset.route) : -1;
      },
      hover: (index) => {
        const item = items[index];
        if (item) {
          const [sx, sy] = screenOf[index] as [number, number];
          const first = item.points[0] as MapPoint;
          const sum = total(item);
          const category = item.points.length === 1 ? categoryName(first) : "";
          return {
            title: describe(item),
            rows: [
              ...(sum ? [{ id: "value", name, value: sum, color: item.color }] : []),
              ...(category
                ? [{ id: "category", name: category, value: "", color: item.color }]
                : []),
            ],
            x: Math.min(stage.width - 4, Math.max(4, sx)),
            y: Math.min(stage.height - 4, Math.max(4, sy - item.radius)),
            side: "top",
          };
        }
        const shape = shapes[index - items.length];
        if (!shape) return null;
        const at = this.anchorOf(stage, shape.mid[0], shape.mid[1]);
        return {
          title: shape.name,
          rows:
            shape.route.value == null
              ? []
              : [
                  {
                    id: "value",
                    name,
                    value: ctx.format(shape.route.value),
                    color: shape.route.color ?? ACCENT,
                    shape: "line",
                  },
                ],
          x: at.x,
          y: at.y,
          side: "top",
        };
      },
      nav: (index, intent) => directionalNav(this.#anchors, index, intent),
      maxHoverRows: 2,
      snapshot: () => ({
        title: this.getAttribute("label") || this.loadedMap?.name || "",
        categoryHeader: labels.region,
        categories: this.#points.map((point) => point.name),
        series: [
          {
            id: "value",
            name,
            color: ctx.color(0),
            values: this.#points.map((point) => point.value ?? null),
            text: this.#points.map((point) => (point.value == null ? "" : ctx.format(point.value))),
          },
          {
            id: "category",
            name: labels.category,
            color: ctx.color(1),
            values: this.#points.map((point) => categoryName(point)),
            text: this.#points.map((point) => categoryName(point)),
          },
          {
            id: "lon",
            name: labels.longitude,
            color: ctx.color(2),
            values: this.#points.map((point) => point.lon),
            text: this.#points.map((point) => point.lon.toFixed(4)),
          },
          {
            id: "lat",
            name: labels.latitude,
            color: ctx.color(3),
            values: this.#points.map((point) => point.lat),
            text: this.#points.map((point) => point.lat.toFixed(4)),
          },
        ],
        legend: showLegend
          ? categories.map((category, index) => ({
              id: category.id,
              name: category.name,
              color: seriesColor(index, category.color),
              shape: "dot" as const,
            }))
          : [],
      }),
    };
  }

  #routeShapes(stage: Stage): Shape[] {
    const routes = this.#routes;
    if (routes.length === 0) return [];
    const project = stage.geo.projection.project;
    const top = Math.max(0, ...routes.map((route) => route.value ?? 0));
    const bend =
      this.getAttribute("route-bend") === null ? 0.25 : Number(this.getAttribute("route-bend"));
    const great = this.getAttribute("route-style") === "great-circle";
    return resolveRoutes(routes, this.#points).map((resolved): Shape => {
      const { route, from, to } = resolved;
      const a = project(from[0], from[1]);
      const b = project(to[0], to[1]);
      const d = great
        ? routePolylinePath(
            greatCircle(from, to, 40).map((piece) => piece.map(([lon, lat]) => project(lon, lat))),
          )
        : routeArcPath(a, b, bend);
      return {
        route,
        name: resolved.name,
        width: top > 0 && route.value ? 1.5 + 3.5 * Math.sqrt(route.value / top) : 2,
        d,
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      };
    });
  }
}

/** Registers `<ui-bubble-map>` (or `<prefix>-bubble-map`) and returns the tag. */
export function defineBubbleMap(options?: DefineOptions): string {
  return defineElement("bubble-map", UiBubbleMap, options);
}
